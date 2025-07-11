/**
 * Session lifecycle management
 * @module ws/websocket/session/lifecycle-manager
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { SessionInfo } from './types.js';
import type { SessionStateManager } from './state-manager.js';
import type { SessionEventEmitter } from './event-emitter.js';
import type { SessionSecurityLogger } from './security-logger.js';
import type { pino } from 'pino';

/**
 * Session lifecycle options
 */
export interface SessionLifecycleOptions {
  sessionTimeout: number;
  maxSessionsPerUser: number;
  cleanupInterval?: number;
}

/**
 * Manages session creation, validation, and termination
 * @nist ac-3 "Access enforcement"
 */
export class SessionLifecycleManager {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: pino.Logger,
    private readonly stateManager: SessionStateManager,
    private readonly eventEmitter: SessionEventEmitter,
    private readonly securityLogger: SessionSecurityLogger,
    private readonly options: SessionLifecycleOptions,
  ) {
    // Validate required fields
    if (!options.sessionTimeout || !options.maxSessionsPerUser) {
      throw new Error('SessionLifecycleOptions must include sessionTimeout and maxSessionsPerUser');
    }
  }

  /**
   * Start lifecycle management
   */
  start(): void {
    this.logger.info('Starting session lifecycle management', {
      sessionTimeout: this.options.sessionTimeout,
      maxSessionsPerUser: this.options.maxSessionsPerUser,
    });

    // Start periodic cleanup
    this.startCleanup();

    // Emit lifecycle start event
    this.eventEmitter.emit('lifecycle:start', {
      sessionTimeout: this.options.sessionTimeout,
      maxSessionsPerUser: this.options.maxSessionsPerUser,
    });
  }

  /**
   * Stop lifecycle management
   */
  stop(): void {
    this.logger.info('Stopping session lifecycle management');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.eventEmitter.emit('lifecycle:stop', {});
  }

  /**
   * Create new session
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async createSession(
    sessionId: string,
    userId: string,
    connectionId: string,
    options?: {
      roles?: string[];
      permissions?: string[];
      scopes?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<SessionInfo | null> {
    try {
      // Check if user can create session
      if (!(await this.canUserCreateSession(userId))) {
        await this.securityLogger.logSessionLimitExceeded(userId, this.options.maxSessionsPerUser);
        return null;
      }

      const session = await this.stateManager.createSession(
        sessionId,
        userId,
        connectionId,
        options,
      );

      await this.securityLogger.logSessionCreated(session);
      this.eventEmitter.emit('session:created', session);

      return session;
    } catch (error) {
      this.logger.error('Failed to create session', {
        sessionId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Validate session is still active
   * @nist ac-3 "Access enforcement"
   */
  async validateSession(sessionId: string): Promise<boolean> {
    const session = this.stateManager.getSession(sessionId);
    if (!session) return false;

    // Check if session has expired
    const now = Date.now();
    const sessionAge = now - session.lastActivity.getTime();

    if (sessionAge > this.options.sessionTimeout) {
      this.logger.warn('Session expired', {
        sessionId,
        userId: session.userId,
        age: sessionAge,
        timeout: this.options.sessionTimeout,
      });

      await this.terminateSession(sessionId);
      return false;
    }

    return true;
  }

  /**
   * Terminate session
   * @nist au-3 "Content of audit records"
   */
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.stateManager.getSession(sessionId);
    if (!session) return;

    await this.stateManager.removeSession(sessionId);
    await this.securityLogger.logSessionTerminated(session);
    this.eventEmitter.emit('session:terminated', session);

    this.logger.info('Session terminated', {
      sessionId,
      userId: session.userId,
      duration: Date.now() - session.createdAt.getTime(),
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    const sessions = this.stateManager.getAllSessions();
    const expiredSessions: string[] = [];

    for (const session of sessions) {
      const sessionAge = now - session.lastActivity.getTime();
      if (sessionAge > this.options.sessionTimeout) {
        expiredSessions.push(session.sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.terminateSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      this.logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
      this.eventEmitter.emit('cleanup:completed', { count: expiredSessions.length });
    }

    return expiredSessions.length;
  }

  /**
   * Check if user can create session
   */
  private canUserCreateSession(userId: string): boolean {
    const userSessions = this.stateManager.getUserSessions(userId);
    const maxSessions = this.options.maxSessionsPerUser ?? 10;
    return userSessions.length < maxSessions;
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    const interval = this.options.cleanupInterval ?? 60000; // Default 1 minute
    this.cleanupInterval = setInterval(() => {
      void this.cleanupExpiredSessions();
    }, interval);
  }
}
