/**
 * In-memory session store implementation
 * @module store/in-memory-session-store
 * @nist au-3 "Audit logging for session operations"
 */

import { randomUUID } from 'crypto';
import type { Session, SessionData } from '../types/session.js';
import type { SessionStore } from './session-store.interface.js';
import { pino } from 'pino';
import { logDataAccess } from '../utils/logger.js';

/**
 * In-memory implementation of SessionStore
 * Note: This is for development/testing only. Use Redis or similar for production.
 */
export class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private logger: pino.Logger;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino({ level: 'info' });

    // Start cleanup interval for expired sessions
    this.cleanupInterval = setInterval(() => {
      void this.deleteExpired();
    }, 60000); // Run every minute

    // Make sure the interval doesn't keep the process alive
    this.cleanupInterval.unref();
  }

  async create(data: SessionData): Promise<string> {
    const id = randomUUID();
    const session: Session = {
      id,
      data,
      lastAccessedAt: new Date().toISOString(),
    };

    this.sessions.set(id, session);

    // Track user sessions
    if (!this.userSessions.has(data.userId)) {
      this.userSessions.set(data.userId, new Set());
    }
    const userSessionSet = this.userSessions.get(data.userId);
    if (userSessionSet !== undefined) {
      userSessionSet.add(id);
    }

    this.logger.info({ sessionId: id, userId: data.userId }, 'Session created');

    // Audit log
    await logDataAccess('WRITE', `session/${id}`, {
      action: 'create',
      userId: data.userId,
      username: data.username,
    });

    return id;
  }

  async get(id: string): Promise<Session | null> {
    const session = this.sessions.get(id);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (new Date(session.data.expiresAt) < new Date()) {
      await this.delete(id);
      return null;
    }

    return session;
  }

  async update(id: string, data: Partial<SessionData>): Promise<Session | null> {
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

    this.sessions.set(id, updatedSession);
    this.logger.info({ sessionId: id }, 'Session updated');

    // Audit log
    await logDataAccess('WRITE', `session/${id}`, {
      action: 'update',
      userId: session.data.userId,
      updatedFields: Object.keys(data),
    });

    return updatedSession;
  }

  async delete(id: string): Promise<boolean> {
    const session = this.sessions.get(id);

    if (!session) {
      return false;
    }

    this.sessions.delete(id);

    // Remove from user sessions
    const userSessions = this.userSessions.get(session.data.userId);
    if (userSessions) {
      userSessions.delete(id);
      if (userSessions.size === 0) {
        this.userSessions.delete(session.data.userId);
      }
    }

    this.logger.info({ sessionId: id, userId: session.data.userId }, 'Session deleted');

    // Audit log
    await logDataAccess('DELETE', `session/${id}`, {
      action: 'delete',
      userId: session.data.userId,
    });

    return true;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (new Date(session.data.expiresAt) < now) {
        await this.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.logger.info({ count: deletedCount }, 'Expired sessions deleted');
    }

    return deletedCount;
  }

  async getByUserId(userId: string): Promise<Session[]> {
    const sessionIds = this.userSessions.get(userId);

    if (!sessionIds || sessionIds.size === 0) {
      return [];
    }

    const sessions: Session[] = [];

    for (const id of sessionIds) {
      const session = await this.get(id);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async exists(id: string): Promise<boolean> {
    const session = await this.get(id);
    return session !== null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async touch(id: string): Promise<boolean> {
    const session = this.sessions.get(id);

    if (!session) {
      return false;
    }

    // Check if expired
    if (new Date(session.data.expiresAt) < new Date()) {
      this.sessions.delete(id);
      return false;
    }

    session.lastAccessedAt = new Date().toISOString();
    this.sessions.set(id, session);

    return true;
  }

  /**
   * Clear all sessions (for testing)
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async clear(): Promise<void> {
    this.sessions.clear();
    this.userSessions.clear();

    // Clear interval if running
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.logger.info('All sessions cleared');
  }
}
