/**
 * WebSocket session state management
 * @module ws/websocket/session-manager
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * 
 * This file maintains backward compatibility while delegating to modular components
 */

import type { pino } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';
import type { ConnectionManager } from './connection-manager.js';
import type { WSComponentDependencies, SessionManagementOptions } from './types.js';
import { SessionFactory, type SessionManagerComponents } from './session/session-factory.js';
import type { SessionInfo, SessionStats } from './session/types.js';

/**
 * WebSocket session state management
 * Manages session lifecycle, validation, and cleanup
 * @nist ac-3 "Access enforcement"
 * 
 * This class now delegates to modular components while maintaining the original API
 */
export class SessionManager {
  private logger: pino.Logger;
  private options: SessionManagementOptions;
  private components: SessionManagerComponents;

  constructor(
    dependencies: WSComponentDependencies,
    options: SessionManagementOptions = {},
  ) {
    this.logger = dependencies.logger.child({ module: 'ws-session-manager' });
    this.options = {
      sessionTimeout: 3600000, // 1 hour default
      maxSessionsPerUser: 10,
      persistSessions: true,
      ...options,
    };

    // Create modular components
    this.components = SessionFactory.createComponents(dependencies, this.options);
  }

  /**
   * Start session management
   */
  start(): void {
    this.components.lifecycleManager.start();
    this.components.persistenceManager.start();
    void this.components.securityLogger.logManagementStart({
      sessionTimeout: this.options.sessionTimeout ?? 3600000,
      maxSessionsPerUser: this.options.maxSessionsPerUser ?? 10,
    });
  }

  /**
   * Stop session management
   */
  async stop(): Promise<void> {
    this.components.lifecycleManager.stop();
    await this.components.persistenceManager.stop();
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
      let session = this.components.stateManager.getSession(sessionId);
      
      if (session) {
        // Update existing session
        this.components.stateManager.addConnection(sessionId, connectionId);
        const updatedSession = this.components.stateManager.updateSession(sessionId, {
          lastActivity: new Date(),
          roles: options?.roles,
          permissions: options?.permissions,
          scopes: options?.scopes,
          metadata: options?.metadata ? { ...session.metadata, ...options.metadata } : session.metadata,
        });
        
        if (updatedSession) {
          this.components.eventEmitter.emit('session:updated', updatedSession, options ?? {});
          await this.components.persistenceManager.queueSession(updatedSession);
        }
      } else {
        // Create new session
        const newSession = await this.components.lifecycleManager.createSession(
          sessionId,
          userId,
          connectionId,
          options,
        );
        
        if (!newSession) {
          return false;
        }
        session = newSession;
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
    const session = this.components.stateManager.getSession(sessionId);
    if (!session) return;

    this.components.stateManager.removeConnection(sessionId, connectionId);
    this.components.eventEmitter.emit('connection:removed', sessionId, connectionId);

    // If no more connections, remove session
    if (session.connectionIds.size === 0) {
      await this.removeSession(sessionId);
    } else {
      // Update persistence
      await this.components.persistenceManager.queueSession(session);
    }
  }

  /**
   * Remove session entirely
   * @nist au-3 "Content of audit records"
   */
  async removeSession(sessionId: string): Promise<void> {
    await this.components.lifecycleManager.terminateSession(sessionId);
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.components.stateManager.getSession(sessionId);
  }

  /**
   * Get sessions for a user
   */
  getUserSessions(userId: string): SessionInfo[] {
    return this.components.stateManager.getUserSessions(userId);
  }

  /**
   * Validate session
   * @nist ac-3 "Access enforcement"
   */
  async validateSession(
    sessionId: string,
    connectionManager: ConnectionManager,
  ): Promise<boolean> {
    const result = await this.components.validationManager.validateSession(
      sessionId,
      connectionManager,
    );
    return result.valid;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): SessionStats {
    return this.components.statisticsManager.getSessionStats();
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    return this.components.lifecycleManager.cleanupExpiredSessions();
  }
}

// Re-export types for backward compatibility
export type { SessionInfo, SessionStats } from './session/types.js';