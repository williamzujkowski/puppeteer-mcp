/**
 * WebSocket error handling and recovery
 * @module ws/websocket/error-handler
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 */

import { WebSocket } from 'ws';
import { WSMessageType } from '../../types/websocket.js';
import type { WSMessage } from '../../types/websocket.js';
import type { ConnectionManager } from './connection-manager.js';
import type { HealthMonitor } from './health-monitor.js';
import type { WSComponentDependencies } from './types.js';
import { ErrorHandlerCore } from './error-handler-core.js';
import { ErrorType, ErrorSeverity, type ErrorInfo } from './error-types.js';

/**
 * WebSocket error handling and recovery
 * Handles error logging, recovery strategies, and client notifications
 * @nist au-3 "Content of audit records"
 */
export class ErrorHandler extends ErrorHandlerCore {
  constructor(dependencies: WSComponentDependencies) {
    super(dependencies);
  }

  /**
   * Handle WebSocket connection error
   * @nist au-3 "Content of audit records"
   */
  async handleConnectionError(
    error: Error,
    connectionId: string,
    connectionManager: ConnectionManager,
    healthMonitor?: HealthMonitor,
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      type: ErrorType.CONNECTION_ERROR,
      severity: ErrorSeverity.MEDIUM,
      message: error.message,
      connectionId,
      timestamp: new Date(),
      metadata: {
        errorStack: error.stack,
        connectionState: connectionManager.getConnectionState(connectionId),
      },
      recoveryStrategy: {
        shouldReconnect: false,
      },
    };

    await this.recordError(errorInfo);

    // Record error in health monitor
    if (healthMonitor) {
      healthMonitor.recordError(error);
    }

    // Clean up connection
    connectionManager.removeConnection(connectionId);

    this.logger.error('WebSocket connection error handled', {
      connectionId,
      error: error.message,
    });
  }

  /**
   * Handle message processing error
   * @nist au-3 "Content of audit records"
   */
  async handleMessageError(
    error: Error,
    connectionData: {
      ws: WebSocket;
      connectionId: string;
      message?: WSMessage;
      connectionManager?: ConnectionManager;
    },
  ): Promise<void> {
    const { ws, connectionId, message, connectionManager } = connectionData;
    const state = connectionManager?.getConnectionState(connectionId);
    
    const errorInfo: ErrorInfo = {
      type: ErrorType.MESSAGE_ERROR,
      severity: this.determineSeverity(error),
      message: error.message,
      connectionId,
      userId: state?.userId,
      sessionId: state?.sessionId,
      timestamp: new Date(),
      metadata: {
        messageType: message?.type,
        messageId: message?.id,
        errorStack: error.stack,
      },
    };

    await this.recordError(errorInfo);
    this.sendErrorToClient(ws, message?.id, {
      code: 'MESSAGE_PROCESSING_ERROR',
      message: 'Failed to process message',
      details: { type: error.name, message: error.message },
    });
  }

  /**
   * Handle authentication error
   * @nist au-3 "Content of audit records"
   */
  async handleAuthenticationError(
    error: Error,
    ws: WebSocket,
    connectionId: string,
    message?: WSMessage,
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      type: ErrorType.AUTHENTICATION_ERROR,
      severity: ErrorSeverity.HIGH,
      message: error.message,
      connectionId,
      timestamp: new Date(),
      metadata: {
        messageType: message?.type,
        messageId: message?.id,
        errorStack: error.stack,
      },
    };

    await this.recordError(errorInfo);

    // Send authentication error to client
    this.sendErrorToClient(ws, message?.id, {
      code: 'AUTHENTICATION_ERROR',
      message: 'Authentication failed',
      details: {
        reason: error.message,
      },
    });

    this.logger.warn('Authentication error handled', {
      connectionId,
      error: error.message,
    });
  }

  /**
   * Handle rate limiting error
   * @nist au-3 "Content of audit records"
   */
  async handleRateLimitError(
    ws: WebSocket,
    connectionId: string,
    rateLimitType: string,
    message?: WSMessage,
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      type: ErrorType.RATE_LIMIT_ERROR,
      severity: ErrorSeverity.LOW,
      message: `Rate limit exceeded: ${rateLimitType}`,
      connectionId,
      timestamp: new Date(),
      metadata: {
        rateLimitType,
        messageType: message?.type,
        messageId: message?.id,
      },
    };

    await this.recordError(errorInfo);

    // Send rate limit error to client
    this.sendErrorToClient(ws, message?.id, {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please slow down',
      details: {
        type: rateLimitType,
        retryAfter: 60, // seconds
      },
    });

    this.logger.warn('Rate limit error handled', {
      connectionId,
      rateLimitType,
    });
  }

  /**
   * Handle validation error
   * @nist au-3 "Content of audit records"
   */
  async handleValidationError(
    error: Error,
    ws: WebSocket,
    connectionId: string,
    message?: WSMessage,
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      type: ErrorType.VALIDATION_ERROR,
      severity: ErrorSeverity.LOW,
      message: error.message,
      connectionId,
      timestamp: new Date(),
      metadata: {
        messageType: message?.type,
        messageId: message?.id,
        validationError: error.message,
      },
    };

    await this.recordError(errorInfo);

    // Send validation error to client
    this.sendErrorToClient(ws, message?.id, {
      code: 'VALIDATION_ERROR',
      message: 'Invalid message format or content',
      details: {
        validation: error.message,
      },
    });

    this.logger.debug('Validation error handled', {
      connectionId,
      error: error.message,
    });
  }

  /**
   * Handle system error
   * @nist au-3 "Content of audit records"
   */
  async handleSystemError(
    error: Error,
    context?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      type: ErrorType.SYSTEM_ERROR,
      severity: ErrorSeverity.CRITICAL,
      message: error.message,
      timestamp: new Date(),
      metadata: {
        context,
        errorStack: error.stack,
        ...metadata,
      },
    };

    await this.recordError(errorInfo);

    this.logger.error('System error handled', {
      context,
      error: error.message,
      metadata,
    });
  }

  // The getErrorStats, clearErrorHistory, and recordError methods 
  // are now inherited from ErrorHandlerCore

  /**
   * Send error message to WebSocket client
   */
  private sendErrorToClient(
    ws: WebSocket,
    requestId: string | undefined,
    error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    },
  ): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const errorMessage: WSMessage = {
          type: WSMessageType.ERROR,
          id: requestId,
          timestamp: new Date().toISOString(),
          error,
        };

        ws.send(JSON.stringify(errorMessage));
      } catch (sendError) {
        this.logger.error('Failed to send error message to client', {
          error: sendError instanceof Error ? sendError.message : 'Unknown error',
          originalError: error,
        });
      }
    }
  }

  // The determineSeverity and initializeStats methods 
  // are now inherited from ErrorHandlerCore
}