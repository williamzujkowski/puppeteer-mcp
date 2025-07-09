/**
 * Redis-backed session store implementation
 * @module store/redis-session-store
 * @nist au-3 "Audit logging for session operations"
 * @nist sc-28 "Protection of information at rest"
 * @nist ac-12 "Session termination"
 */

import { randomUUID } from 'crypto';
import type { Session, SessionData } from '../types/session.js';
import type { SessionStore } from './session-store.interface.js';
import { getRedisClient, isRedisAvailable } from '../utils/redis-client.js';
import { InMemorySessionStore } from './in-memory-session-store.js';
import { pino } from 'pino';
import { logDataAccess } from '../utils/logger.js';
// import { config } from '../core/config.js';

/**
 * Redis implementation of SessionStore with fallback to in-memory store
 * Provides persistent session storage across server restarts
 */
export class RedisSessionStore implements SessionStore {
  private logger: pino.Logger;
  private fallbackStore: InMemorySessionStore;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly SESSION_KEY_PREFIX = 'session:';
  private readonly USER_SESSIONS_KEY_PREFIX = 'user_sessions:';

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino({ level: 'info' });
    this.fallbackStore = new InMemorySessionStore(logger);

    // Start cleanup interval for expired sessions
    this.cleanupInterval = setInterval(() => {
      void this.deleteExpired();
    }, 60000); // Run every minute

    // Make sure the interval doesn't keep the process alive
    this.cleanupInterval.unref();
  }

  /**
   * Get the primary Redis client or fallback to in-memory store
   */
  private getStore(): { redis: boolean; client: any } {
    const redisClient = getRedisClient();
    if (redisClient && isRedisAvailable()) {
      return { redis: true, client: redisClient };
    }
    
    this.logger.warn('Redis unavailable, using in-memory fallback');
    return { redis: false, client: this.fallbackStore };
  }

  /**
   * Generate Redis key for session
   */
  private getSessionKey(id: string): string {
    return `${this.SESSION_KEY_PREFIX}${id}`;
  }

  /**
   * Generate Redis key for user sessions
   */
  private getUserSessionsKey(userId: string): string {
    return `${this.USER_SESSIONS_KEY_PREFIX}${userId}`;
  }

  /**
   * Serialize session data for Redis storage
   */
  private serializeSession(session: Session): string {
    return JSON.stringify({
      id: session.id,
      data: session.data,
      lastAccessedAt: session.lastAccessedAt,
    });
  }

  /**
   * Deserialize session data from Redis
   */
  private deserializeSession(data: string): Session {
    const parsed = JSON.parse(data);
    return {
      id: parsed.id,
      data: parsed.data,
      lastAccessedAt: parsed.lastAccessedAt,
    };
  }

  /**
   * Calculate TTL for session based on expiration time
   */
  private calculateTTL(expiresAt: string): number {
    const expireTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const ttl = Math.max(0, Math.ceil((expireTime - now) / 1000));
    return ttl;
  }

  async create(data: SessionData): Promise<string> {
    const id = randomUUID();
    const session: Session = {
      id,
      data,
      lastAccessedAt: new Date().toISOString(),
    };

    const { redis, client } = this.getStore();

    try {
      if (redis) {
        const ttl = this.calculateTTL(data.expiresAt);
        const sessionKey = this.getSessionKey(id);
        const userSessionsKey = this.getUserSessionsKey(data.userId);
        
        // Use pipeline for atomic operations
        const pipeline = client.pipeline();
        
        // Store session with TTL
        pipeline.setex(sessionKey, ttl, this.serializeSession(session));
        
        // Add session ID to user's session set
        pipeline.sadd(userSessionsKey, id);
        
        // Set TTL for user sessions set (longer than individual sessions)
        pipeline.expire(userSessionsKey, ttl + 3600); // 1 hour buffer
        
        await pipeline.exec();
        
        this.logger.info({ sessionId: id, userId: data.userId, ttl }, 'Session created in Redis');
      } else {
        // Fallback to in-memory store
        await client.create(data);
      }

      // Audit log
      await logDataAccess('WRITE', `session/${id}`, {
        action: 'create',
        userId: data.userId,
        username: data.username,
        store: redis ? 'redis' : 'memory',
      });

      return id;
    } catch (error) {
      this.logger.error({ error, sessionId: id }, 'Failed to create session in Redis');
      
      // Fallback to in-memory store on error
      if (redis) {
        this.logger.warn('Falling back to in-memory store for session creation');
        return this.fallbackStore.create(data);
      }
      
      throw error;
    }
  }

  async get(id: string): Promise<Session | null> {
    const { redis, client } = this.getStore();

    try {
      if (redis) {
        const sessionKey = this.getSessionKey(id);
        const data = await client.get(sessionKey);
        
        if (!data) {
          return null;
        }

        const session = this.deserializeSession(data);
        
        // Check if session is expired (additional check)
        if (new Date(session.data.expiresAt) < new Date()) {
          await this.delete(id);
          return null;
        }

        return session;
      } else {
        // Fallback to in-memory store
        return await client.get(id);
      }
    } catch (error) {
      this.logger.error({ error, sessionId: id }, 'Failed to get session from Redis');
      
      // Fallback to in-memory store on error
      if (redis) {
        this.logger.warn('Falling back to in-memory store for session retrieval');
        return this.fallbackStore.get(id);
      }
      
      return null;
    }
  }

  async update(id: string, data: Partial<SessionData>): Promise<Session | null> {
    const { redis, client } = this.getStore();

    try {
      if (redis) {
        const session = await this.get(id);
        if (!session) {
          return null;
        }

        const updatedSession: Session = {
          ...session,
          data: {
            ...session.data,
            ...data,
          },
          lastAccessedAt: new Date().toISOString(),
        };

        const sessionKey = this.getSessionKey(id);
        const ttl = this.calculateTTL(updatedSession.data.expiresAt);
        
        // Update session with new TTL
        await client.setex(sessionKey, ttl, this.serializeSession(updatedSession));
        
        this.logger.info({ sessionId: id, ttl }, 'Session updated in Redis');

        // Audit log
        await logDataAccess('WRITE', `session/${id}`, {
          action: 'update',
          userId: session.data.userId,
          updatedFields: Object.keys(data),
          store: 'redis',
        });

        return updatedSession;
      } else {
        // Fallback to in-memory store
        return await client.update(id, data);
      }
    } catch (error) {
      this.logger.error({ error, sessionId: id }, 'Failed to update session in Redis');
      
      // Fallback to in-memory store on error
      if (redis) {
        this.logger.warn('Falling back to in-memory store for session update');
        return this.fallbackStore.update(id, data);
      }
      
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    const { redis, client } = this.getStore();

    try {
      if (redis) {
        // First get the session to know the user ID
        const session = await this.get(id);
        if (!session) {
          return false;
        }

        const sessionKey = this.getSessionKey(id);
        const userSessionsKey = this.getUserSessionsKey(session.data.userId);
        
        // Use pipeline for atomic operations
        const pipeline = client.pipeline();
        
        // Delete session
        pipeline.del(sessionKey);
        
        // Remove session ID from user's session set
        pipeline.srem(userSessionsKey, id);
        
        const results = await pipeline.exec();
        const deleted = results?.[0] && results[0][1] === 1;
        
        if (deleted) {
          this.logger.info({ sessionId: id, userId: session.data.userId }, 'Session deleted from Redis');
          
          // Audit log
          await logDataAccess('DELETE', `session/${id}`, {
            action: 'delete',
            userId: session.data.userId,
            store: 'redis',
          });
        }

        return Boolean(deleted);
      } else {
        // Fallback to in-memory store
        return await client.delete(id);
      }
    } catch (error) {
      this.logger.error({ error, sessionId: id }, 'Failed to delete session from Redis');
      
      // Fallback to in-memory store on error
      if (redis) {
        this.logger.warn('Falling back to in-memory store for session deletion');
        return this.fallbackStore.delete(id);
      }
      
      return false;
    }
  }

  async deleteExpired(): Promise<number> {
    const { redis, client } = this.getStore();

    try {
      if (redis) {
        // Redis TTL handles expiration automatically, but we can clean up
        // user session sets that might have expired session IDs
        let deletedCount = 0;
        
        // Get all user session keys
        const userSessionKeys = await client.keys(`${this.USER_SESSIONS_KEY_PREFIX}*`);
        
        for (const userKey of userSessionKeys) {
          const sessionIds = await client.smembers(userKey);
          
          for (const sessionId of sessionIds) {
            const sessionKey = this.getSessionKey(sessionId);
            const exists = await client.exists(sessionKey);
            
            if (!exists) {
              // Remove expired session from user's set
              await client.srem(userKey, sessionId);
              deletedCount++;
            }
          }
        }

        if (deletedCount > 0) {
          this.logger.info({ count: deletedCount }, 'Expired sessions cleaned up from Redis');
        }

        return deletedCount;
      } else {
        // Fallback to in-memory store
        return await client.deleteExpired();
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to clean up expired sessions in Redis');
      return 0;
    }
  }

  async getByUserId(userId: string): Promise<Session[]> {
    const { redis, client } = this.getStore();

    try {
      if (redis) {
        const userSessionsKey = this.getUserSessionsKey(userId);
        const sessionIds = await client.smembers(userSessionsKey);
        
        if (sessionIds.length === 0) {
          return [];
        }

        const sessions: Session[] = [];
        
        // Get all sessions for the user
        for (const sessionId of sessionIds) {
          const session = await this.get(sessionId);
          if (session) {
            sessions.push(session);
          }
        }

        return sessions;
      } else {
        // Fallback to in-memory store
        return await client.getByUserId(userId);
      }
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get sessions by user ID from Redis');
      
      // Fallback to in-memory store on error
      if (redis) {
        this.logger.warn('Falling back to in-memory store for user sessions retrieval');
        return this.fallbackStore.getByUserId(userId);
      }
      
      return [];
    }
  }

  async exists(id: string): Promise<boolean> {
    const { redis, client } = this.getStore();

    try {
      if (redis) {
        const sessionKey = this.getSessionKey(id);
        const exists = await client.exists(sessionKey);
        return exists === 1;
      } else {
        // Fallback to in-memory store
        return await client.exists(id);
      }
    } catch (error) {
      this.logger.error({ error, sessionId: id }, 'Failed to check session existence in Redis');
      
      // Fallback to in-memory store on error
      if (redis) {
        this.logger.warn('Falling back to in-memory store for session existence check');
        return this.fallbackStore.exists(id);
      }
      
      return false;
    }
  }

  async touch(id: string): Promise<boolean> {
    const { redis, client } = this.getStore();

    try {
      if (redis) {
        const session = await this.get(id);
        if (!session) {
          return false;
        }

        // Check if expired
        if (new Date(session.data.expiresAt) < new Date()) {
          await this.delete(id);
          return false;
        }

        // Update last accessed time
        const updatedSession: Session = {
          ...session,
          lastAccessedAt: new Date().toISOString(),
        };

        const sessionKey = this.getSessionKey(id);
        const ttl = this.calculateTTL(session.data.expiresAt);
        
        // Update session with refreshed TTL
        await client.setex(sessionKey, ttl, this.serializeSession(updatedSession));
        
        return true;
      } else {
        // Fallback to in-memory store
        return await client.touch(id);
      }
    } catch (error) {
      this.logger.error({ error, sessionId: id }, 'Failed to touch session in Redis');
      
      // Fallback to in-memory store on error
      if (redis) {
        this.logger.warn('Falling back to in-memory store for session touch');
        return this.fallbackStore.touch(id);
      }
      
      return false;
    }
  }

  /**
   * Clear all sessions (for testing)
   */
  async clear(): Promise<void> {
    const { redis, client } = this.getStore();

    try {
      if (redis) {
        // Delete all session keys
        const sessionKeys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
        const userSessionKeys = await client.keys(`${this.USER_SESSIONS_KEY_PREFIX}*`);
        
        const allKeys = [...sessionKeys, ...userSessionKeys];
        
        if (allKeys.length > 0) {
          await client.del(...allKeys);
        }
        
        this.logger.info('All sessions cleared from Redis');
      } else {
        // Fallback to in-memory store
        await client.clear();
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to clear sessions from Redis');
      
      // Also clear fallback store
      await this.fallbackStore.clear();
    }
  }

  /**
   * Destroy the session store and clean up resources
   */
  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    await this.fallbackStore.destroy();
    this.logger.info('Redis session store destroyed');
  }

  /**
   * Get health status of the session store
   */
  async healthCheck(): Promise<{
    redis: { available: boolean; latency?: number; error?: string };
    fallback: { available: boolean };
  }> {
    const redisClient = getRedisClient();
    let redisHealth: { available: boolean; latency?: number; error?: string } = { available: false, error: 'Redis not configured' };

    if (redisClient && isRedisAvailable()) {
      try {
        const start = Date.now();
        await redisClient.ping();
        const latency = Date.now() - start;
        redisHealth = { available: true, latency };
      } catch (error) {
        redisHealth = {
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return {
      redis: redisHealth,
      fallback: { available: true }, // In-memory fallback is always available
    };
  }
}