/**
 * Session indexing and search capabilities
 * @module store/redis/session-indexing
 * @nist au-3 "Audit logging for session operations"
 */

import type { Session } from '../../types/session.js';
import type { RedisClient, StoreLogger, SessionQuery } from './types.js';
import { SessionOperations } from './session-operations.js';

/**
 * Session indexing and search operations
 */
export class SessionIndexing {
  private logger: StoreLogger;
  private sessionOps: SessionOperations;
  private readonly SESSION_KEY_PREFIX = 'session:';
  private readonly USER_SESSIONS_KEY_PREFIX = 'user_sessions:';
  private readonly SESSION_INDEX_PREFIX = 'session_idx:';

  constructor(logger: StoreLogger) {
    this.logger = logger;
    this.sessionOps = new SessionOperations(logger);
  }

  /**
   * Search sessions by pattern
   */
  async searchSessions(client: RedisClient, query: SessionQuery): Promise<Session[]> {
    try {
      let sessionIds: string[] = [];

      if (query.userId) {
        // Get sessions for specific user
        const userSessionsKey = this.getUserSessionsKey(query.userId);
        sessionIds = await client.smembers(userSessionsKey);
      } else if (query.pattern) {
        // Search by pattern
        const keys = await client.keys(`${this.SESSION_KEY_PREFIX}${query.pattern}`);
        sessionIds = keys.map((key) => key.replace(this.SESSION_KEY_PREFIX, ''));
      } else {
        // Get all session keys
        const keys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
        sessionIds = keys.map((key) => key.replace(this.SESSION_KEY_PREFIX, ''));
      }

      // Get actual sessions
      const sessions: Session[] = [];
      for (const sessionId of sessionIds) {
        const session = await this.sessionOps.getSession(client, sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      // Apply sorting
      const sortedSessions = this.sortSessions(sessions, query);

      // Apply pagination
      const paginatedSessions = this.paginateSessions(sortedSessions, query);

      return paginatedSessions;
    } catch (error) {
      this.logger.error({ error, query }, 'Failed to search sessions');
      return [];
    }
  }

  /**
   * Get sessions by username pattern
   */
  async getSessionsByUsername(client: RedisClient, usernamePattern: string): Promise<Session[]> {
    try {
      const allSessionKeys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
      const matchingSessions: Session[] = [];

      for (const key of allSessionKeys) {
        const sessionId = key.replace(this.SESSION_KEY_PREFIX, '');
        const session = await this.sessionOps.getSession(client, sessionId);

        if (session && this.matchesPattern(session.data.username, usernamePattern)) {
          matchingSessions.push(session);
        }
      }

      return matchingSessions;
    } catch (error) {
      this.logger.error({ error, usernamePattern }, 'Failed to get sessions by username');
      return [];
    }
  }

  /**
   * Get active sessions (non-expired)
   */
  async getActiveSessions(client: RedisClient): Promise<Session[]> {
    try {
      const allSessionKeys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
      const activeSessions: Session[] = [];

      for (const key of allSessionKeys) {
        const sessionId = key.replace(this.SESSION_KEY_PREFIX, '');
        const session = await this.sessionOps.getSession(client, sessionId);

        if (session && new Date(session.data.expiresAt) > new Date()) {
          activeSessions.push(session);
        }
      }

      return activeSessions;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get active sessions');
      return [];
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(client: RedisClient): Promise<{
    total: number;
    active: number;
    expired: number;
    byUser: Record<string, number>;
  }> {
    try {
      const allSessionKeys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
      let total = 0;
      let active = 0;
      let expired = 0;
      const byUser: Record<string, number> = {};

      for (const key of allSessionKeys) {
        const sessionId = key.replace(this.SESSION_KEY_PREFIX, '');
        const session = await this.sessionOps.getSession(client, sessionId);

        if (session) {
          total++;
          const isActive = new Date(session.data.expiresAt) > new Date();

          if (isActive) {
            active++;
          } else {
            expired++;
          }

          const userId = session.data.userId;
          byUser[userId] = (byUser[userId] || 0) + 1;
        }
      }

      return { total, active, expired, byUser };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get session statistics');
      return { total: 0, active: 0, expired: 0, byUser: {} };
    }
  }

  /**
   * Find sessions expiring soon
   */
  async getExpiringSessionsSoon(
    client: RedisClient,
    withinMinutes: number = 30,
  ): Promise<Session[]> {
    try {
      const allSessionKeys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
      const expiringSessions: Session[] = [];
      const thresholdTime = new Date(Date.now() + withinMinutes * 60 * 1000);

      for (const key of allSessionKeys) {
        const sessionId = key.replace(this.SESSION_KEY_PREFIX, '');
        const session = await this.sessionOps.getSession(client, sessionId);

        if (session) {
          const expiryTime = new Date(session.data.expiresAt);
          if (expiryTime <= thresholdTime && expiryTime > new Date()) {
            expiringSessions.push(session);
          }
        }
      }

      return expiringSessions;
    } catch (error) {
      this.logger.error({ error, withinMinutes }, 'Failed to get expiring sessions');
      return [];
    }
  }

  /**
   * Get user sessions key
   */
  private getUserSessionsKey(userId: string): string {
    return `${this.USER_SESSIONS_KEY_PREFIX}${userId}`;
  }

  /**
   * Check if string matches pattern (simple wildcard support)
   */
  private matchesPattern(value: string, pattern: string): boolean {
    // Convert pattern to lowercase for case-insensitive matching
    const lowerValue = value.toLowerCase();
    const lowerPattern = pattern.toLowerCase();

    // Simple wildcard matching without RegExp
    let valueIndex = 0;
    let patternIndex = 0;

    while (patternIndex < lowerPattern.length && valueIndex < lowerValue.length) {
      if (lowerPattern[patternIndex] === '*') {
        // Skip consecutive asterisks
        while (patternIndex < lowerPattern.length && lowerPattern[patternIndex] === '*') {
          patternIndex++;
        }
        if (patternIndex === lowerPattern.length) return true;

        // Find next matching character
        while (
          valueIndex < lowerValue.length &&
          lowerValue[valueIndex] !== lowerPattern[patternIndex] &&
          lowerPattern[patternIndex] !== '?'
        ) {
          valueIndex++;
        }
      } else if (
        lowerPattern[patternIndex] === '?' ||
        lowerPattern[patternIndex] === lowerValue[valueIndex]
      ) {
        patternIndex++;
        valueIndex++;
      } else {
        return false;
      }
    }

    // Handle trailing asterisks
    while (patternIndex < lowerPattern.length && lowerPattern[patternIndex] === '*') {
      patternIndex++;
    }

    return patternIndex === lowerPattern.length && valueIndex === lowerValue.length;
  }

  /**
   * Sort sessions based on query parameters
   */
  private sortSessions(sessions: Session[], query: SessionQuery): Session[] {
    if (!query.sortBy) {
      return sessions;
    }

    return sessions.sort((a, b) => {
      let aValue: string;
      let bValue: string;

      switch (query.sortBy) {
        case 'lastAccessedAt':
          aValue = a.lastAccessedAt;
          bValue = b.lastAccessedAt;
          break;
        case 'createdAt':
          aValue = a.data.createdAt || a.lastAccessedAt;
          bValue = b.data.createdAt || b.lastAccessedAt;
          break;
        default:
          return 0;
      }

      const comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
      return query.sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Apply pagination to sessions
   */
  private paginateSessions(sessions: Session[], query: SessionQuery): Session[] {
    const offset = query.offset || 0;
    const limit = query.limit;

    if (limit === undefined) {
      return sessions.slice(offset);
    }

    return sessions.slice(offset, offset + limit);
  }

  /**
   * Create index entries for faster searching
   */
  async createSessionIndex(client: RedisClient, session: Session): Promise<void> {
    try {
      const indexKey = `${this.SESSION_INDEX_PREFIX}user:${session.data.userId}`;
      await client.sadd(indexKey, session.id);

      // Set TTL on index to match session expiry
      const ttl = Math.ceil((new Date(session.data.expiresAt).getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await client.expire(indexKey, ttl + 3600); // 1 hour buffer
      }
    } catch (error) {
      this.logger.error({ error, sessionId: session.id }, 'Failed to create session index');
    }
  }

  /**
   * Remove session from indices
   */
  async removeFromIndex(client: RedisClient, session: Session): Promise<void> {
    try {
      const indexKey = `${this.SESSION_INDEX_PREFIX}user:${session.data.userId}`;
      await client.srem(indexKey, session.id);
    } catch (error) {
      this.logger.error({ error, sessionId: session.id }, 'Failed to remove session from index');
    }
  }
}
