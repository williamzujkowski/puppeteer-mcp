/**
 * Session security event logging
 * @module ws/websocket/session/security-logger
 * @nist au-3 "Content of audit records"
 * @nist au-8 "Time stamps"
 */

import { logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';
import type { SessionInfo } from './types.js';
import type { pino } from 'pino';

/**
 * Handles security event logging for sessions
 * @nist au-3 "Content of audit records"
 */
export class SessionSecurityLogger {
  constructor(private readonly logger: pino.Logger) {}

  /**
   * Log session creation
   * @nist au-3 "Content of audit records"
   */
  async logSessionCreated(session: SessionInfo): Promise<void> {
    await logSecurityEvent(SecurityEventType.SESSION_CREATED, {
      resource: 'websocket',
      action: 'create_session',
      result: 'success',
      metadata: {
        sessionId: session.sessionId,
        userId: session.userId,
        connectionCount: session.connectionIds.size,
        roleCount: session.roles?.length ?? 0,
        permissionCount: session.permissions?.length ?? 0,
        state: session.state,
      },
    });

    this.logger.info('Session created', {
      sessionId: session.sessionId,
      userId: session.userId,
      state: session.state,
    });
  }

  /**
   * Log session termination
   * @nist au-3 "Content of audit records"
   */
  async logSessionTerminated(session: SessionInfo): Promise<void> {
    const duration = Date.now() - session.createdAt.getTime();

    await logSecurityEvent(SecurityEventType.SESSION_TERMINATED, {
      resource: 'websocket',
      action: 'terminate_session',
      result: 'success',
      metadata: {
        sessionId: session.sessionId,
        userId: session.userId,
        duration,
        connectionCount: session.connectionIds.size,
        state: session.state,
      },
    });

    this.logger.info('Session terminated', {
      sessionId: session.sessionId,
      userId: session.userId,
      duration,
      state: session.state,
    });
  }

  /**
   * Log session limit exceeded
   * @nist au-3 "Content of audit records"
   */
  async logSessionLimitExceeded(userId: string, limit: number): Promise<void> {
    await logSecurityEvent(SecurityEventType.SESSION_LIMIT_EXCEEDED, {
      resource: 'websocket',
      action: 'create_session',
      result: 'failure',
      metadata: {
        userId,
        maxAllowed: limit,
      },
    });

    this.logger.warn('Session limit exceeded', {
      userId,
      maxAllowed: limit,
    });
  }

  /**
   * Log session validation failure
   * @nist au-3 "Content of audit records"
   */
  async logValidationFailure(sessionId: string, reason: string): Promise<void> {
    await logSecurityEvent(SecurityEventType.SESSION_INVALID, {
      resource: 'websocket',
      action: 'validate_session',
      result: 'failure',
      metadata: {
        sessionId,
        reason,
      },
    });

    this.logger.warn('Session validation failed', {
      sessionId,
      reason,
    });
  }

  /**
   * Log session state change
   * @nist au-3 "Content of audit records"
   */
  async logStateChange(
    sessionId: string,
    userId: string,
    fromState: string,
    toState: string,
  ): Promise<void> {
    await logSecurityEvent(SecurityEventType.SESSION_STATE_CHANGE, {
      resource: 'websocket',
      action: 'change_state',
      result: 'success',
      metadata: {
        sessionId,
        userId,
        fromState,
        toState,
      },
    });

    this.logger.debug('Session state changed', {
      sessionId,
      userId,
      fromState,
      toState,
    });
  }

  /**
   * Log session management start
   * @nist au-3 "Content of audit records"
   */
  async logManagementStart(config: {
    sessionTimeout: number;
    maxSessionsPerUser: number;
  }): Promise<void> {
    await logSecurityEvent(SecurityEventType.SESSION_MANAGEMENT_START, {
      resource: 'websocket',
      action: 'session_manager_start',
      result: 'success',
      metadata: config,
    });
  }
}
