/**
 * Session TTL and expiration management
 * @module store/redis/session-expiry
 * @nist ac-12 "Session termination"
 */

import type { Session } from '../../types/session.js';
import type { RedisClient, StoreLogger } from './types.js';

/**
 * Session expiry manager for TTL and cleanup operations
 */
export class SessionExpiryManager {
  private logger: StoreLogger;
  private readonly SESSION_KEY_PREFIX = 'session:';
  private readonly USER_SESSIONS_KEY_PREFIX = 'user_sessions:';

  constructor(logger: StoreLogger) {
    this.logger = logger;
  }

  /**
   * Calculate TTL for session based on expiration time
   */
  calculateTTL(expiresAt: string): number {
    const expireTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const ttl = Math.max(0, Math.ceil((expireTime - now) / 1000));
    return ttl;
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(session: Session): boolean {
    return new Date(session.data.expiresAt) < new Date();
  }

  /**
   * Get remaining TTL for a session
   */
  getRemainingTTL(session: Session): number {
    const now = Date.now();
    const expireTime = new Date(session.data.expiresAt).getTime();
    return Math.max(0, expireTime - now);
  }

  /**
   * Extend session expiration by given duration
   */
  extendExpiration(session: Session, extensionMs: number): Session {
    const currentExpiry = new Date(session.data.expiresAt);
    const newExpiry = new Date(currentExpiry.getTime() + extensionMs);
    
    return {
      ...session,
      data: {
        ...session.data,
        expiresAt: newExpiry.toISOString(),
      },
      lastAccessedAt: new Date().toISOString(),
    };
  }

  /**
   * Set TTL for session in Redis
   */
  async setSessionTTL(
    client: RedisClient,
    sessionKey: string,
    ttl: number
  ): Promise<boolean> {
    try {
      const result = await client.expire(sessionKey, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error({ error, sessionKey, ttl }, 'Failed to set session TTL');
      return false;
    }
  }

  /**
   * Clean up expired sessions from user session sets
   */
  async cleanupExpiredUserSessions(client: RedisClient): Promise<number> {
    let deletedCount = 0;
    
    try {
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
        this.logger.info({ count: deletedCount }, 'Expired sessions cleaned up from user sets');
      }

      return deletedCount;
    } catch (error) {
      this.logger.error({ error }, 'Failed to cleanup expired user sessions');
      return 0;
    }
  }

  /**
   * Get session key with prefix
   */
  private getSessionKey(id: string): string {
    return `${this.SESSION_KEY_PREFIX}${id}`;
  }

  /**
   * Validate expiration date format
   */
  isValidExpirationDate(expiresAt: string): boolean {
    try {
      const date = new Date(expiresAt);
      return !isNaN(date.getTime()) && date.getTime() > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Calculate buffer TTL for user session sets
   */
  calculateUserSetTTL(sessionTTL: number): number {
    // Add 1 hour buffer to prevent premature cleanup
    return sessionTTL + 3600;
  }

  /**
   * Create expiration date for new session
   */
  createExpirationDate(durationMs: number): string {
    const expiryTime = new Date(Date.now() + durationMs);
    return expiryTime.toISOString();
  }

  /**
   * Batch cleanup expired sessions with limit
   */
  async batchCleanupExpired(
    client: RedisClient,
    batchSize: number = 100
  ): Promise<{ processed: number; deleted: number }> {
    let processed = 0;
    let deleted = 0;

    try {
      const userSessionKeys = await client.keys(`${this.USER_SESSIONS_KEY_PREFIX}*`);
      
      for (let i = 0; i < userSessionKeys.length; i += batchSize) {
        const batch = userSessionKeys.slice(i, i + batchSize);
        
        for (const userKey of batch) {
          const sessionIds = await client.smembers(userKey);
          processed += sessionIds.length;
          
          for (const sessionId of sessionIds) {
            const sessionKey = this.getSessionKey(sessionId);
            const exists = await client.exists(sessionKey);
            
            if (!exists) {
              await client.srem(userKey, sessionId);
              deleted++;
            }
          }
        }
      }

      this.logger.info({ processed, deleted }, 'Batch cleanup completed');
      return { processed, deleted };
    } catch (error) {
      this.logger.error({ error }, 'Batch cleanup failed');
      return { processed, deleted };
    }
  }
}