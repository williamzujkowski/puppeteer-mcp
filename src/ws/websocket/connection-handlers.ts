/**
 * WebSocket connection handler helpers
 * @module ws/websocket/connection-handlers
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import type { pino } from 'pino';
import type { WSMessage } from '../../types/websocket.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ConnectionManager } from './connection-manager.js';
import type { SecurityManager } from './security-manager.js';
import type { MiddlewarePipeline } from './middleware-pipeline.js';
import type { MessageRouter } from './message-router.js';
import type { AuthenticationHandler } from './authentication-handler.js';
import type { EventHandler } from './event-handler.js';
import type { ErrorHandler } from './error-handler.js';
import type { SessionManager } from './session-manager.js';
import type { HealthMonitor } from './health-monitor.js';

/**
 * Connection handler dependencies
 */
export interface ConnectionHandlerDependencies {
  logger: pino.Logger;
  connectionManager: ConnectionManager;
  securityManager: SecurityManager;
  middlewarePipeline: MiddlewarePipeline;
  messageRouter: MessageRouter;
  authHandler: AuthenticationHandler;
  eventHandler: EventHandler;
  errorHandler: ErrorHandler;
  sessionManager: SessionManager;
  healthMonitor: HealthMonitor;
}

/**
 * Handle incoming WebSocket message with validation and processing
 */
export async function handleIncomingMessage(
  ws: WebSocket,
  connectionId: string,
  data: Buffer,
  deps: ConnectionHandlerDependencies,
): Promise<void> {
  try {
    // Validate payload size
    if (!deps.securityManager.validatePayloadSize(data)) {
      await deps.errorHandler.handleValidationError(
        new Error('Payload size exceeds maximum allowed'),
        ws,
        connectionId,
      );
      return;
    }

    // Parse message
    const message = await parseMessage(data);
    if (!message.success) {
      await deps.errorHandler.handleValidationError(
        new Error(message.error ?? 'Invalid JSON message'),
        ws,
        connectionId,
      );
      return;
    }

    // Validate message structure
    const validation = deps.securityManager.validateMessageStructure(message.data);
    if (!validation.valid) {
      await deps.errorHandler.handleValidationError(
        new Error(validation.error ?? 'Invalid message structure'),
        ws,
        connectionId,
        message.data,
      );
      return;
    }

    // Check rate limits
    const rateLimitKey = `connection:${connectionId}`;
    const isAllowed = await deps.securityManager.checkMessageRateLimit(rateLimitKey);
    if (!isAllowed) {
      await deps.errorHandler.handleRateLimitError(
        ws,
        connectionId,
        'message_rate_limit',
        message.data,
      );
      return;
    }

    // Process through middleware pipeline
    const middlewareResult = await deps.middlewarePipeline.executeInbound(
      ws,
      connectionId,
      message.data!,
      deps.connectionManager,
      deps.securityManager,
    );

    if (!middlewareResult.success || !middlewareResult.shouldContinue) {
      if (middlewareResult.error) {
        await deps.errorHandler.handleMessageError(new Error(middlewareResult.error), {
          ws,
          connectionId,
          message: message.data!,
          connectionManager: deps.connectionManager,
        });
      }
      return;
    }

    // Route message to appropriate handler
    await deps.messageRouter.routeMessage(
      ws,
      connectionId,
      message.data!,
      deps.connectionManager,
      deps.authHandler,
      deps.eventHandler,
    );

    // Record successful message processing
    deps.healthMonitor.recordMessageProcessed();
  } catch (error) {
    await deps.errorHandler.handleMessageError(
      error instanceof Error ? error : new Error('Unknown message error'),
      { ws, connectionId, connectionManager: deps.connectionManager },
    );
  }
}

/**
 * Handle WebSocket connection close event
 */
export async function handleConnectionClose(
  connectionId: string,
  code: number,
  reason: Buffer,
  deps: ConnectionHandlerDependencies,
): Promise<void> {
  try {
    deps.logger.info('WebSocket connection closed', {
      connectionId,
      code,
      reason: reason.toString(),
    });

    // Record disconnection
    deps.healthMonitor.recordConnection('disconnected');

    // Clean up subscriptions
    deps.eventHandler.removeAllSubscriptions(connectionId);

    // Remove from session manager
    const state = deps.connectionManager.getConnectionState(connectionId);
    if (state?.sessionId) {
      await deps.sessionManager.removeConnectionFromSession(state.sessionId, connectionId);
    }

    // Handle rate limit cleanup
    const rateLimitKey = `connection:${connectionId}`;
    await deps.securityManager.handleConnectionClose(rateLimitKey);

    // Log disconnection event
    await logSecurityEvent(SecurityEventType.CONNECTION_CLOSED, {
      resource: 'websocket',
      action: 'disconnect',
      result: 'success',
      metadata: {
        connectionId,
        code,
        reason: reason.toString(),
      },
    });

    // Clean up connection
    deps.connectionManager.removeConnection(connectionId);
  } catch (error) {
    deps.logger.error('Error handling connection close', {
      connectionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Parse incoming message data
 */
async function parseMessage(data: Buffer): Promise<{
  success: boolean;
  data?: WSMessage;
  error?: string;
}> {
  try {
    const rawMessage = data.toString();
    const message = JSON.parse(rawMessage) as WSMessage;
    return { success: true, data: message };
  } catch (parseError) {
    return {
      success: false,
      error: parseError instanceof Error ? parseError.message : 'Invalid JSON',
    };
  }
}
