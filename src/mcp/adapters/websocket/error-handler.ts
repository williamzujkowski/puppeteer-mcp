/**
 * WebSocket Error Handler
 * @module mcp/adapters/websocket/error-handler
 * @description Error handling and recovery for WebSocket connections
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Logger } from 'pino';
import { AppError } from '../../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';
import type { MCPWebSocketConnection, PendingRequest } from './types.js';

/**
 * WebSocket error handler class
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */
export class WebSocketErrorHandler {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ module: 'ws-error-handler' });
  }

  /**
   * Handle WebSocket connection error
   * @nist au-3 "Content of audit records"
   */
  async handleConnectionError(
    connectionId: string,
    error: Error,
    userId?: string,
  ): Promise<void> {
    this.logger.error('WebSocket connection error', {
      connectionId,
      error: error.message,
      stack: error.stack,
    });

    await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
      userId: userId ?? connectionId,
      action: 'websocket_connection_error',
      resource: 'websocket',
      result: 'failure',
      reason: error.message,
    });
  }

  /**
   * Handle message parsing error
   * @nist ac-4 "Information flow enforcement"
   */
  handleParseError(connectionId: string, data: string, error: Error): void {
    this.logger.error('Failed to parse WebSocket message', {
      connectionId,
      error: error.message,
      dataLength: data.length,
      dataSample: data.substring(0, 100),
    });
  }

  /**
   * Handle authentication error
   * @nist ia-2 "Identification and authentication"
   * @nist au-3 "Content of audit records"
   */
  async handleAuthError(
    connectionId: string,
    error: Error,
    authType?: string,
  ): Promise<void> {
    this.logger.error('WebSocket authentication failed', {
      connectionId,
      error: error.message,
      authType,
    });

    await logSecurityEvent(SecurityEventType.AUTH_FAILURE, {
      userId: connectionId,
      action: 'websocket_auth',
      resource: 'websocket',
      result: 'failure',
      reason: error.message,
      metadata: { authType },
    });
  }

  /**
   * Handle operation error
   * @nist au-3 "Content of audit records"
   */
  async handleOperationError(
    operation: string,
    error: Error,
    sessionId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.error('WebSocket operation failed', {
      operation,
      error: error.message,
      sessionId,
      metadata,
    });

    await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
      userId: sessionId ?? 'unknown',
      action: `websocket_${operation}`,
      resource: 'websocket',
      result: 'failure',
      reason: error.message,
      metadata,
    });
  }

  /**
   * Handle request timeout
   */
  handleRequestTimeout(connectionId: string, requestId: string): AppError {
    this.logger.warn('WebSocket request timeout', {
      connectionId,
      requestId,
    });

    return new AppError('Request timeout', 408);
  }

  /**
   * Handle subscription error
   */
  handleSubscriptionError(
    connectionId: string,
    subscriptionId: string,
    error: Error,
  ): void {
    this.logger.error('WebSocket subscription error', {
      connectionId,
      subscriptionId,
      error: error.message,
    });
  }

  /**
   * Clean up pending requests with error
   */
  cleanupPendingRequests(
    pendingRequests: Map<string, PendingRequest>,
    error: Error,
  ): void {
    for (const [requestId, pending] of pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.logger.debug('Cleaned up pending request', { requestId });
    }
    pendingRequests.clear();
  }

  /**
   * Handle connection close
   */
  handleConnectionClose(connection: MCPWebSocketConnection, code: number, reason: string): void {
    this.logger.info('WebSocket connection closed', {
      connectionId: connection.connectionId,
      code,
      reason,
      pendingRequests: connection.pendingRequests.size,
      subscriptions: connection.subscriptions.size,
    });

    // Clean up all pending requests
    this.cleanupPendingRequests(
      connection.pendingRequests,
      new AppError('Connection closed', 503),
    );
  }

  /**
   * Determine if error is recoverable
   */
  isRecoverableError(error: Error): boolean {
    if (error instanceof AppError) {
      // Don't recover from client errors
      if (error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }
    }

    // Check for specific error messages
    const nonRecoverableMessages = [
      'authentication failed',
      'unauthorized',
      'forbidden',
      'invalid token',
    ];

    const message = error.message.toLowerCase();
    return !nonRecoverableMessages.some((msg) => message.includes(msg));
  }

  /**
   * Create error response
   */
  createErrorResponse(error: Error, requestId?: string): {
    type: string;
    id?: string;
    error: { code: string; message: string; details?: unknown };
  } {
    const errorCode = error instanceof AppError ? String(error.statusCode) : 'INTERNAL_ERROR';

    return {
      type: 'error',
      id: requestId,
      error: {
        code: errorCode,
        message: error.message,
        details: error instanceof AppError ? error.details : undefined,
      },
    };
  }
}