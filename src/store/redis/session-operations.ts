/**
 * Basic CRUD operations for sessions
 * @module store/redis/session-operations
 * @nist au-3 "Audit logging for session operations"
 * @nist sc-28 "Protection of information at rest"
 */

import { randomUUID } from 'crypto';
import type { Session, SessionData } from '../../types/session.js';
import type { RedisClient, StoreLogger, OperationContext } from './types.js';
import { SessionSerializer } from './session-serializer.js';
import { SessionExpiryManager } from './session-expiry.js';
import { logDataAccess } from '../../utils/logger.js';

/**
 * Basic session CRUD operations for Redis
 */
export class SessionOperations {
  private logger: StoreLogger;
  private serializer: SessionSerializer;
  private expiryManager: SessionExpiryManager;
  private readonly SESSION_KEY_PREFIX = 'session:';
  private readonly USER_SESSIONS_KEY_PREFIX = 'user_sessions:';

  constructor(logger: StoreLogger) {
    this.logger = logger;
    this.serializer = new SessionSerializer(logger);
    this.expiryManager = new SessionExpiryManager(logger);
  }

  /**
   * Create a new session in Redis
   */
  async createSession(client: RedisClient, data: SessionData): Promise<string> {
    const id = randomUUID();
    const session = this.serializer.createSession(id, data);

    const ttl = this.expiryManager.calculateTTL(data.expiresAt);
    const sessionKey = this.getSessionKey(id);
    const userSessionsKey = this.getUserSessionsKey(data.userId);
    
    // Use pipeline for atomic operations
    const pipeline = client.pipeline();
    
    // Store session with TTL
    pipeline.setex(sessionKey, ttl, this.serializer.serialize(session));
    
    // Add session ID to user's session set
    pipeline.sadd(userSessionsKey, id);
    
    // Set TTL for user sessions set (longer than individual sessions)
    const userSetTTL = this.expiryManager.calculateUserSetTTL(ttl);
    pipeline.expire(userSessionsKey, userSetTTL);
    
    await pipeline.exec();
    
    this.logger.info({ sessionId: id, userId: data.userId, ttl }, 'Session created in Redis');

    // Audit log
    await this.logOperation('create', {
      sessionId: id,
      userId: data.userId,
      operation: 'create',
      timestamp: new Date().toISOString(),
      store: 'redis'
    });

    return id;
  }

  /**
   * Get session from Redis
   */
  async getSession(client: RedisClient, id: string): Promise<Session | null> {
    const sessionKey = this.getSessionKey(id);
    const data = await client.get(sessionKey);
    
    if (!data) {
      return null;
    }

    const session = this.serializer.deserialize(data);
    
    // Check if session is expired
    if (this.expiryManager.isSessionExpired(session)) {
      await this.deleteSession(client, id);
      return null;
    }

    return session;
  }

  /**
   * Update session in Redis
   */
  async updateSession(
    client: RedisClient,
    id: string,
    data: Partial<SessionData>
  ): Promise<Session | null> {
    const session = await this.getSession(client, id);
    if (!session) {
      return null;
    }

    const updatedSession = this.serializer.updateSession(session, data);
    const sessionKey = this.getSessionKey(id);
    const ttl = this.expiryManager.calculateTTL(updatedSession.data.expiresAt);
    
    // Update session with new TTL
    await client.setex(sessionKey, ttl, this.serializer.serialize(updatedSession));
    
    this.logger.info({ sessionId: id, ttl }, 'Session updated in Redis');

    // Audit log
    await this.logOperation('update', {
      sessionId: id,
      userId: session.data.userId,
      operation: 'update',
      timestamp: new Date().toISOString(),
      store: 'redis'
    });

    return updatedSession;
  }

  /**
   * Delete session from Redis
   */
  async deleteSession(client: RedisClient, id: string): Promise<boolean> {
    // First get the session to know the user ID
    const session = await this.getSession(client, id);
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
      await this.logOperation('delete', {
        sessionId: id,
        userId: session.data.userId,
        operation: 'delete',
        timestamp: new Date().toISOString(),
        store: 'redis'
      });
    }

    return Boolean(deleted);
  }

  /**
   * Check if session exists in Redis
   */
  async sessionExists(client: RedisClient, id: string): Promise<boolean> {
    const sessionKey = this.getSessionKey(id);
    const exists = await client.exists(sessionKey);
    return exists === 1;
  }

  /**
   * Touch session (update last accessed time)
   */
  async touchSession(client: RedisClient, id: string): Promise<boolean> {
    const session = await this.getSession(client, id);
    if (!session) {
      return false;
    }

    // Check if expired
    if (this.expiryManager.isSessionExpired(session)) {
      await this.deleteSession(client, id);
      return false;
    }

    // Update last accessed time
    const updatedSession: Session = {
      ...session,
      lastAccessedAt: new Date().toISOString(),
    };

    const sessionKey = this.getSessionKey(id);
    const ttl = this.expiryManager.calculateTTL(session.data.expiresAt);
    
    // Update session with refreshed TTL
    await client.setex(sessionKey, ttl, this.serializer.serialize(updatedSession));
    
    return true;
  }

  /**
   * Get all sessions for a user
   */
  async getSessionsByUserId(client: RedisClient, userId: string): Promise<Session[]> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    const sessionIds = await client.smembers(userSessionsKey);
    
    if (sessionIds.length === 0) {
      return [];
    }

    const sessions: Session[] = [];
    
    // Get all sessions for the user
    for (const sessionId of sessionIds) {
      const session = await this.getSession(client, sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Clear all sessions
   */
  async clearAllSessions(client: RedisClient): Promise<void> {
    // Delete all session keys
    const sessionKeys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
    const userSessionKeys = await client.keys(`${this.USER_SESSIONS_KEY_PREFIX}*`);
    
    const allKeys = [...sessionKeys, ...userSessionKeys];
    
    if (allKeys.length > 0) {
      await client.del(...allKeys);
    }
    
    this.logger.info('All sessions cleared from Redis');
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
   * Log operation for audit trail
   */
  private async logOperation(action: string, context: OperationContext): Promise<void> {
    try {
      await logDataAccess('WRITE', `session/${context.sessionId}`, {
        action,
        userId: context.userId,
        store: context.store,
        timestamp: context.timestamp
      });
    } catch (error) {
      this.logger.error({ error, context }, 'Failed to log session operation');
    }
  }
}