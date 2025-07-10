/**
 * WebSocket session state management
 * @module ws/websocket/session-manager
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { pino } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ConnectionManager } from './connection-manager.js';
import type { WSComponentDependencies, SessionManagementOptions } from './types.js';

/**
 * Session information
 */
interface SessionInfo {
  sessionId: string;
  userId: string;
  connectionIds: Set<string>;
  createdAt: Date;
  lastActivity: Date;
  roles?: string[];
  permissions?: string[];
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Session statistics
 */
interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalUsers: number;
  averageConnectionsPerSession: number;
  sessionsPerUser: Array<{ userId: string; sessionCount: number }>;
}

/**
 * WebSocket session state management
 * Manages session lifecycle, validation, and cleanup
 * @nist ac-3 "Access enforcement"
 */
export class SessionManager {
  private logger: pino.Logger;
  private sessionStore: SessionStore;
  private sessions: Map<string, SessionInfo> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private options: SessionManagementOptions;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    { logger, sessionStore }: WSComponentDependencies,
    options: SessionManagementOptions = {},
  ) {
    this.logger = logger.child({ module: 'ws-session-manager' });
    this.sessionStore = sessionStore;
    this.options = {
      sessionTimeout: 3600000, // 1 hour default
      maxSessionsPerUser: 10,
      persistSessions: true,
      ...options,
    };
  }

  /**
   * Start session management
   */
  start(): void {
    this.logger.info('Starting session management', {
      sessionTimeout: this.options.sessionTimeout,
      maxSessionsPerUser: this.options.maxSessionsPerUser,
    });

    // Start periodic cleanup
    this.startCleanup();

    // Log session manager start
    void logSecurityEvent(SecurityEventType.SESSION_MANAGEMENT_START, {
      resource: 'websocket',
      action: 'session_manager_start',
      result: 'success',
      metadata: {
        sessionTimeout: this.options.sessionTimeout,
        maxSessionsPerUser: this.options.maxSessionsPerUser,
      },
    });
  }

  /**
   * Stop session management
   */
  stop(): void {
    this.logger.info('Stopping session management');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Create or update session
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async createOrUpdateSession(
    sessionId: string,
    userId: string,
    connectionId: string,
    options?: {
      roles?: string[];
      permissions?: string[];
      scopes?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<boolean> {
    try {
      // Check session limits for user
      if (!this.sessions.has(sessionId) && !this.canCreateSession(userId)) {
        return false;
      }

      const session = await this.getOrCreateSession(sessionId, userId, connectionId, options);
      
      // Persist session if enabled
      if (this.options.persistSessions) {
        await this.persistSession(session);
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to create/update session', {
        sessionId,
        userId,
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Remove connection from session
   * @nist au-3 "Content of audit records"
   */
  async removeConnectionFromSession(sessionId: string, connectionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.connectionIds.delete(connectionId);

    // If no more connections, remove session
    if (session.connectionIds.size === 0) {
      await this.removeSession(sessionId);
    } else {
      // Update last activity
      session.lastActivity = new Date();
      
      if (this.options.persistSessions) {
        await this.persistSession(session);
      }
    }
  }

  /**
   * Remove session entirely
   * @nist au-3 "Content of audit records"
   */
  async removeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove from user sessions mapping
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // Remove session
    this.sessions.delete(sessionId);

    // Log session removal
    await logSecurityEvent(SecurityEventType.SESSION_TERMINATED, {
      resource: 'websocket',
      action: 'remove_session',
      result: 'success',
      metadata: {
        sessionId,
        userId: session.userId,
        duration: Date.now() - session.createdAt.getTime(),
        connectionCount: session.connectionIds.size,
      },
    });

    this.logger.info('Session removed', {
      sessionId,
      userId: session.userId,
      duration: Date.now() - session.createdAt.getTime(),
    });

    // Remove from persistent store if enabled
    if (this.options.persistSessions) {
      try {
        await this.sessionStore.deleteSession(sessionId);
      } catch (error) {
        this.logger.warn('Failed to remove session from persistent store', {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get sessions for a user
   */
  getUserSessions(userId: string): SessionInfo[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    return Array.from(sessionIds)
      .map((id) => this.sessions.get(id))
      .filter((session): session is SessionInfo => session !== undefined);
  }

  /**
   * Validate session
   * @nist ac-3 "Access enforcement"
   */
  async validateSession(
    sessionId: string,
    connectionManager: ConnectionManager,
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if session has expired
    const now = Date.now();
    const sessionAge = now - session.lastActivity.getTime();
    
    if (sessionAge > this.options.sessionTimeout!) {
      this.logger.warn('Session expired', {
        sessionId,
        userId: session.userId,
        age: sessionAge,
        timeout: this.options.sessionTimeout,
      });

      await this.removeSession(sessionId);
      return false;
    }

    // Validate connections still exist
    const validConnections = new Set<string>();
    session.connectionIds.forEach((connectionId) => {
      if (connectionManager.getConnection(connectionId)) {
        validConnections.add(connectionId);
      }
    });

    session.connectionIds = validConnections;

    // Remove session if no valid connections
    if (validConnections.size === 0) {
      await this.removeSession(sessionId);
      return false;
    }

    return true;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): SessionStats {
    const now = Date.now();
    const activeSessions = Array.from(this.sessions.values()).filter(
      (session) => now - session.lastActivity.getTime() < this.options.sessionTimeout!,
    );

    const totalConnections = Array.from(this.sessions.values())
      .reduce((sum, session) => sum + session.connectionIds.size, 0);

    const averageConnections = this.sessions.size > 0 ? totalConnections / this.sessions.size : 0;

    const sessionsPerUser = Array.from(this.userSessions.entries()).map(([userId, sessions]) => ({
      userId,
      sessionCount: sessions.size,
    }));

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      totalUsers: this.userSessions.size,
      averageConnectionsPerSession: averageConnections,
      sessionsPerUser,
    };
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      const sessionAge = now - session.lastActivity.getTime();
      if (sessionAge > this.options.sessionTimeout!) {
        expiredSessions.push(sessionId);
      }
    });

    for (const sessionId of expiredSessions) {
      await this.removeSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      this.logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
    }

    return expiredSessions.length;
  }

  /**
   * Get user session count
   */
  private getUserSessionCount(userId: string): number {
    const userSessions = this.userSessions.get(userId);
    return userSessions ? userSessions.size : 0;
  }

  /**
   * Check if session can be created for user
   */
  private async canCreateSession(userId: string): Promise<boolean> {
    const userSessionCount = this.getUserSessionCount(userId);
    if (userSessionCount >= (this.options.maxSessionsPerUser ?? 10)) {
      this.logger.warn('Maximum sessions per user exceeded', {
        userId,
        sessionCount: userSessionCount,
        maxAllowed: this.options.maxSessionsPerUser,
      });

      // Log session limit exceeded
      await logSecurityEvent(SecurityEventType.SESSION_LIMIT_EXCEEDED, {
        resource: 'websocket',
        action: 'create_session',
        result: 'denied',
        metadata: {
          userId,
          sessionCount: userSessionCount,
          maxAllowed: this.options.maxSessionsPerUser,
        },
      });

      return false;
    }
    return true;
  }

  /**
   * Get or create session
   */
  private async getOrCreateSession(
    sessionId: string,
    userId: string,
    connectionId: string,
    options?: {
      roles?: string[];
      permissions?: string[];
      scopes?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<SessionInfo> {
    let session = this.sessions.get(sessionId);
    const now = new Date();

    if (session) {
      // Update existing session
      session.connectionIds.add(connectionId);
      session.lastActivity = now;
      if (options?.roles) session.roles = options.roles;
      if (options?.permissions) session.permissions = options.permissions;
      if (options?.scopes) session.scopes = options.scopes;
      if (options?.metadata) {
        session.metadata = { ...session.metadata, ...options.metadata };
      }
    } else {
      // Create new session
      session = {
        sessionId,
        userId,
        connectionIds: new Set([connectionId]),
        createdAt: now,
        lastActivity: now,
        roles: options?.roles,
        permissions: options?.permissions,
        scopes: options?.scopes,
        metadata: options?.metadata,
      };

      this.sessions.set(sessionId, session);

      // Add to user sessions mapping
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      const userSessionSet = this.userSessions.get(userId);
      if (userSessionSet) {
        userSessionSet.add(sessionId);
      }

      // Log session creation
      await logSecurityEvent(SecurityEventType.SESSION_CREATED, {
        resource: 'websocket',
        action: 'create_session',
        result: 'success',
        metadata: {
          sessionId,
          userId,
          connectionId,
          roleCount: session.roles?.length ?? 0,
          permissionCount: session.permissions?.length ?? 0,
        },
      });

      this.logger.info('Session created', { sessionId, userId, connectionId });
    }

    return session;
  }

  /**
   * Persist session to store
   */
  private async persistSession(session: SessionInfo): Promise<void> {
    try {
      await this.sessionStore.updateSession(session.sessionId, {
        userId: session.userId,
        roles: session.roles ?? [],
        permissions: session.permissions ?? [],
        scopes: session.scopes ?? [],
        metadata: {
          ...session.metadata,
          wsConnections: Array.from(session.connectionIds),
          lastActivity: session.lastActivity.toISOString(),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to persist session', {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, 60000); // Run every minute
  }
}