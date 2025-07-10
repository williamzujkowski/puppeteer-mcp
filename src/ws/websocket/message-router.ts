/**
 * WebSocket message routing and protocol handling
 * @module ws/websocket/message-router
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import type { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import type {
  WSMessage,
  WSMessageType,
  WSAuthMessage,
  WSRequestMessage,
  WSSubscriptionMessage,
  WSPingPongMessage,
} from '../../types/websocket.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ConnectionManager } from './connection-manager.js';
import type { AuthenticationHandler } from './authentication-handler.js';
import type { EventHandler } from './event-handler.js';
import type { WSComponentDependencies } from './types.js';

/**
 * Message routing and protocol handling
 * Routes WebSocket messages to appropriate handlers
 * @nist ac-3 "Access enforcement"
 */
export class MessageRouter {
  private logger: pino.Logger;

  constructor({ logger }: WSComponentDependencies) {
    this.logger = logger.child({ module: 'ws-message-router' });
  }

  /**
   * Route incoming message to appropriate handler
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async routeMessage(
    ws: WebSocket,
    connectionId: string,
    message: WSMessage,
    connectionManager: ConnectionManager,
    authHandler: AuthenticationHandler,
    eventHandler: EventHandler,
  ): Promise<void> {
    try {
      // Update connection activity
      connectionManager.updateLastActivity(connectionId);

      // Log message routing
      this.logger.debug('Routing message', {
        connectionId,
        type: message.type,
        messageId: message.id,
      });

      // Route based on message type
      switch (message.type) {
        case 'auth':
          await this.handleAuthMessage(ws, connectionId, message as WSAuthMessage, connectionManager, authHandler);
          break;

        case 'request':
          await this.handleRequestMessage(ws, connectionId, message as WSRequestMessage, connectionManager, authHandler);
          break;

        case 'subscribe':
        case 'unsubscribe':
          await this.handleSubscriptionMessage(ws, connectionId, message as WSSubscriptionMessage, connectionManager, eventHandler, authHandler);
          break;

        case 'ping':
          await this.handlePingMessage(ws, connectionId, message as WSPingPongMessage);
          break;

        case 'pong':
          await this.handlePongMessage(connectionId, message as WSPingPongMessage);
          break;

        default:
          this.logger.warn('Unknown message type', {
            connectionId,
            type: message.type,
            messageId: message.id,
          });
          
          this.sendErrorMessage(ws, message.id, {
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unknown message type: ${message.type}`,
          });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown routing error';
      
      this.logger.error('Message routing error', {
        connectionId,
        messageType: message.type,
        messageId: message.id,
        error: errorMessage,
      });

      // Log security event for routing errors
      await logSecurityEvent(SecurityEventType.REQUEST_PROCESSING_ERROR, {
        resource: 'websocket',
        action: 'route_message',
        result: 'error',
        metadata: {
          connectionId,
          messageType: message.type,
          messageId: message.id,
          error: errorMessage,
        },
      });

      this.sendErrorMessage(ws, message.id, {
        code: 'MESSAGE_ROUTING_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * Handle authentication message
   */
  private async handleAuthMessage(
    ws: WebSocket,
    connectionId: string,
    message: WSAuthMessage,
    connectionManager: ConnectionManager,
    authHandler: AuthenticationHandler,
  ): Promise<void> {
    const responseMessage = await authHandler.handleAuthentication(ws, connectionId, message, connectionManager);
    this.sendMessage(ws, responseMessage);
  }

  /**
   * Handle request message
   */
  private async handleRequestMessage(
    ws: WebSocket,
    connectionId: string,
    message: WSRequestMessage,
    connectionManager: ConnectionManager,
    authHandler: AuthenticationHandler,
  ): Promise<void> {
    // Check authentication
    const state = connectionManager.getConnectionState(connectionId);
    if (!state?.authenticated) {
      this.sendErrorMessage(ws, message.id, {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for requests',
      });
      return;
    }

    // Log the request
    await logSecurityEvent(SecurityEventType.REQUEST_RECEIVED, {
      resource: 'websocket',
      action: 'request',
      result: 'received',
      metadata: {
        connectionId,
        userId: state.userId,
        sessionId: state.sessionId,
        method: message.method,
        path: message.path,
        requestId: message.id,
      },
    });

    // For now, send a not implemented response
    // This would be where you'd integrate with your request processing logic
    this.sendMessage(ws, {
      type: 'response',
      id: message.id,
      timestamp: new Date().toISOString(),
      status: 501,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Request processing not yet implemented in modular structure',
      },
    });
  }

  /**
   * Handle subscription message
   */
  private async handleSubscriptionMessage(
    ws: WebSocket,
    connectionId: string,
    message: WSSubscriptionMessage,
    connectionManager: ConnectionManager,
    eventHandler: EventHandler,
    authHandler: AuthenticationHandler,
  ): Promise<void> {
    // Check authentication
    const state = connectionManager.getConnectionState(connectionId);
    if (!state?.authenticated) {
      this.sendErrorMessage(ws, message.id, {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for subscriptions',
      });
      return;
    }

    try {
      if (message.type === 'subscribe') {
        const success = await eventHandler.subscribe(connectionId, message.topic, message.filters);
        
        if (success) {
          this.sendMessage(ws, {
            type: 'event',
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            event: 'subscription_confirmed',
            data: {
              topic: message.topic,
              filters: message.filters,
            },
          });
        } else {
          this.sendErrorMessage(ws, message.id, {
            code: 'SUBSCRIPTION_FAILED',
            message: `Failed to subscribe to topic: ${message.topic}`,
          });
        }
      } else {
        const success = eventHandler.unsubscribe(connectionId, message.topic);
        
        if (success) {
          this.sendMessage(ws, {
            type: 'event',
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            event: 'subscription_cancelled',
            data: {
              topic: message.topic,
            },
          });
        } else {
          this.sendErrorMessage(ws, message.id, {
            code: 'UNSUBSCRIBE_FAILED',
            message: `Failed to unsubscribe from topic: ${message.topic}`,
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Subscription error';
      this.sendErrorMessage(ws, message.id, {
        code: 'SUBSCRIPTION_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * Handle ping message
   */
  private async handlePingMessage(
    ws: WebSocket,
    connectionId: string,
    message: WSPingPongMessage,
  ): Promise<void> {
    this.logger.debug('Ping received', { connectionId });
    
    this.sendMessage(ws, {
      type: 'pong',
      id: message.id,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle pong message
   */
  private async handlePongMessage(
    connectionId: string,
    message: WSPingPongMessage,
  ): Promise<void> {
    this.logger.debug('Pong received', { connectionId, messageId: message.id });
    // Pong messages are handled by updating lastActivity in connectionManager
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        this.logger.error('Failed to send message', {
          error: error instanceof Error ? error.message : 'Unknown error',
          messageType: message.type,
          messageId: message.id,
        });
      }
    }
  }

  /**
   * Send error message to WebSocket client
   */
  private sendErrorMessage(
    ws: WebSocket,
    requestId: string | undefined,
    error: { code: string; message: string },
  ): void {
    this.sendMessage(ws, {
      type: 'error' as WSMessageType,
      id: requestId,
      timestamp: new Date().toISOString(),
      error,
    });
  }
}