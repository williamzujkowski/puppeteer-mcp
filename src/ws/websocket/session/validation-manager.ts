/**
 * Session validation management
 * @module ws/websocket/session/validation-manager
 * @nist ac-3 "Access enforcement"
 * @nist ia-2 "Identification and authentication"
 */

import type { SessionInfo, SessionValidationResult } from './types.js';
import type { SessionStateManager } from './state-manager.js';
import type { SessionEventEmitter } from './event-emitter.js';
import type { SessionSecurityLogger } from './security-logger.js';
import type { ConnectionManager } from '../connection-manager.js';
import type { pino } from 'pino';
import { SessionState } from './types.js';

/**
 * Validation rules for sessions
 */
export interface SessionValidationRules {
  maxIdleTime?: number;
  requireActiveConnection?: boolean;
  validatePermissions?: boolean;
  customValidators?: Array<(session: SessionInfo) => Promise<boolean>>;
}

/**
 * Manages session validation
 * @nist ac-3 "Access enforcement"
 * @nist ia-2 "Identification and authentication"
 */
export class SessionValidationManager {
  private validationRules: SessionValidationRules = {
    maxIdleTime: 300000, // 5 minutes
    requireActiveConnection: true,
    validatePermissions: true,
  };

  constructor(
    private readonly logger: pino.Logger,
    private readonly stateManager: SessionStateManager,
    private readonly eventEmitter: SessionEventEmitter,
    private readonly securityLogger: SessionSecurityLogger,
    private readonly sessionTimeout: number,
  ) {}

  /**
   * Set validation rules
   */
  setValidationRules(rules: SessionValidationRules): void {
    this.validationRules = { ...this.validationRules, ...rules };
    this.logger.info('Updated session validation rules', this.validationRules);
  }

  /**
   * Validate session
   * @nist ac-3 "Access enforcement"
   */
  async validateSession(
    sessionId: string,
    connectionManager?: ConnectionManager,
  ): Promise<SessionValidationResult> {
    const session = this.stateManager.getSession(sessionId);

    if (!session) {
      return {
        valid: false,
        reason: 'Session not found',
      };
    }

    // Check session state
    if (session.state === SessionState.TERMINATED) {
      return {
        valid: false,
        reason: 'Session terminated',
        sessionInfo: session,
      };
    }

    // Check session timeout
    const timeoutResult = this.validateTimeout(session);
    if (!timeoutResult.valid) {
      await this.handleValidationFailure(sessionId, timeoutResult.reason!);
      return timeoutResult;
    }

    // Check idle time
    const idleResult = this.validateIdleTime(session);
    if (!idleResult.valid) {
      await this.handleValidationFailure(sessionId, idleResult.reason!);
      return idleResult;
    }

    // Check connections if manager provided
    if (connectionManager && this.validationRules.requireActiveConnection) {
      const connectionResult = await this.validateConnections(session, connectionManager);
      if (!connectionResult.valid) {
        await this.handleValidationFailure(sessionId, connectionResult.reason!);
        return connectionResult;
      }
    }

    // Update session state if idle and has connections
    if (session.state === SessionState.IDLE && session.connectionIds.size > 0) {
      await this.stateManager.transitionState(sessionId, SessionState.ACTIVE);
    }

    // Check permissions if required
    if (this.validationRules.validatePermissions) {
      const permissionResult = this.validatePermissions(session);
      if (!permissionResult.valid) {
        await this.handleValidationFailure(sessionId, permissionResult.reason!);
        return permissionResult;
      }
    }

    // Run custom validators
    if (this.validationRules.customValidators) {
      for (const validator of this.validationRules.customValidators) {
        try {
          const isValid = await validator(session);
          if (!isValid) {
            const reason = 'Custom validation failed';
            await this.handleValidationFailure(sessionId, reason);
            return { valid: false, reason, sessionInfo: session };
          }
        } catch (error) {
          this.logger.error('Custom validator error', {
            sessionId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return {
      valid: true,
      sessionInfo: session,
    };
  }

  /**
   * Validate multiple sessions
   */
  async validateSessions(
    sessionIds: string[],
    connectionManager?: ConnectionManager,
  ): Promise<Map<string, SessionValidationResult>> {
    const results = new Map<string, SessionValidationResult>();

    await Promise.all(
      sessionIds.map(async (sessionId) => {
        const result = await this.validateSession(sessionId, connectionManager);
        results.set(sessionId, result);
      }),
    );

    return results;
  }

  /**
   * Validate session timeout
   */
  private validateTimeout(session: SessionInfo): SessionValidationResult {
    const now = Date.now();
    const sessionAge = now - session.lastActivity.getTime();

    if (sessionAge > this.sessionTimeout) {
      return {
        valid: false,
        reason: `Session expired (age: ${sessionAge}ms, timeout: ${this.sessionTimeout}ms)`,
        sessionInfo: session,
      };
    }

    return { valid: true, sessionInfo: session };
  }

  /**
   * Validate idle time
   */
  private validateIdleTime(session: SessionInfo): SessionValidationResult {
    if (!this.validationRules.maxIdleTime) {
      return { valid: true, sessionInfo: session };
    }

    const now = Date.now();
    const idleTime = now - session.lastActivity.getTime();

    if (session.state === SessionState.IDLE && idleTime > this.validationRules.maxIdleTime) {
      return {
        valid: false,
        reason: `Session idle too long (${idleTime}ms)`,
        sessionInfo: session,
      };
    }

    return { valid: true, sessionInfo: session };
  }

  /**
   * Validate connections
   */
  private validateConnections(
    session: SessionInfo,
    connectionManager: ConnectionManager,
  ): SessionValidationResult {
    const validConnections = new Set<string>();

    for (const connectionId of session.connectionIds) {
      if (connectionManager.getConnection(connectionId)) {
        validConnections.add(connectionId);
      }
    }

    // Update session with valid connections
    if (validConnections.size !== session.connectionIds.size) {
      session.connectionIds = validConnections;
      this.stateManager.updateSession(session.sessionId, { connectionIds: validConnections });
    }

    if (validConnections.size === 0) {
      return {
        valid: false,
        reason: 'No active connections',
        sessionInfo: session,
      };
    }

    return { valid: true, sessionInfo: session };
  }

  /**
   * Validate permissions
   */
  private validatePermissions(session: SessionInfo): SessionValidationResult {
    // Basic permission validation - can be extended
    if (!session.roles || session.roles.length === 0) {
      return {
        valid: false,
        reason: 'No roles assigned to session',
        sessionInfo: session,
      };
    }

    return { valid: true, sessionInfo: session };
  }

  /**
   * Handle validation failure
   */
  private async handleValidationFailure(sessionId: string, reason: string): Promise<void> {
    await this.securityLogger.logValidationFailure(sessionId, reason);
    this.eventEmitter.emit('validation:failed', sessionId, reason);

    this.logger.warn('Session validation failed', { sessionId, reason });
  }
}
