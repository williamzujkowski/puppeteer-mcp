/**
 * Session data serialization/deserialization
 * @module store/redis/session-serializer
 * @nist sc-28 "Protection of information at rest"
 */

import type { Session, SessionData } from '../../types/session.js';
import type { SerializedSession, StoreLogger } from './types.js';

/**
 * Session serializer for Redis storage
 */
export class SessionSerializer {
  private logger: StoreLogger;

  constructor(logger: StoreLogger) {
    this.logger = logger;
  }

  /**
   * Serialize session data for Redis storage
   */
  serialize(session: Session): string {
    try {
      const serialized: SerializedSession = {
        id: session.id,
        data: session.data,
        lastAccessedAt: session.lastAccessedAt,
      };
      return JSON.stringify(serialized);
    } catch (error) {
      this.logger.error({ error, sessionId: session.id }, 'Failed to serialize session');
      throw new Error('Session serialization failed');
    }
  }

  /**
   * Deserialize session data from Redis
   */
  deserialize(data: string): Session {
    try {
      const parsed: SerializedSession = JSON.parse(data);
      
      // Validate required fields
      if (!parsed.id || !parsed.data || !parsed.lastAccessedAt) {
        throw new Error('Invalid session data structure');
      }

      return {
        id: parsed.id,
        data: parsed.data,
        lastAccessedAt: parsed.lastAccessedAt,
      };
    } catch (error) {
      this.logger.error({ error, data: data.substring(0, 100) }, 'Failed to deserialize session');
      throw new Error('Session deserialization failed');
    }
  }

  /**
   * Validate serialized session data
   */
  validateSerializedData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      return Boolean(
        parsed &&
        typeof parsed.id === 'string' &&
        parsed.data &&
        typeof parsed.lastAccessedAt === 'string'
      );
    } catch {
      return false;
    }
  }

  /**
   * Create session object from session data
   */
  createSession(id: string, data: SessionData): Session {
    return {
      id,
      data,
      lastAccessedAt: new Date().toISOString(),
    };
  }

  /**
   * Update session with new data
   */
  updateSession(session: Session, updates: Partial<SessionData>): Session {
    return {
      ...session,
      data: {
        ...session.data,
        ...updates,
      },
      lastAccessedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if session data is valid for serialization
   */
  isValidSession(session: Session): boolean {
    try {
      return Boolean(
        session &&
        typeof session.id === 'string' &&
        session.data &&
        typeof session.data.userId === 'string' &&
        typeof session.data.username === 'string' &&
        typeof session.data.expiresAt === 'string' &&
        typeof session.lastAccessedAt === 'string'
      );
    } catch {
      return false;
    }
  }

  /**
   * Sanitize session data for logging (remove sensitive info)
   */
  sanitizeForLogging(session: Session): Record<string, unknown> {
    return {
      id: session.id,
      userId: session.data.userId,
      username: session.data.username,
      lastAccessedAt: session.lastAccessedAt,
      expiresAt: session.data.expiresAt,
      // Exclude potentially sensitive data
    };
  }
}