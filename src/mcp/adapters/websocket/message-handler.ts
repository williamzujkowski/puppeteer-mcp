/**
 * WebSocket Message Handler
 * @module mcp/adapters/websocket/message-handler
 * @description Message processing and routing for WebSocket connections
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-3 "Access enforcement"
 */

import type { Logger } from 'pino';
import { WSMessageType } from '../../../types/websocket.js';
import type {
  MCPWebSocketConnection,
  MessageHandlers,
  WSMessage,
  WSResponseMessage,
  WSEventMessage,
} from './types.js';
import type { MCPResponse } from '../adapter.interface.js';
import { AppError } from '../../../core/errors/app-error.js';
import { WebSocketEventEmitter, WebSocketEventType } from './event-emitter.js';

/**
 * WebSocket message handler
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-3 "Access enforcement"
 */
export class WebSocketMessageHandler implements MessageHandlers {
  private readonly logger: Logger;
  private readonly eventEmitter: WebSocketEventEmitter;

  constructor(logger: Logger, eventEmitter: WebSocketEventEmitter) {
    this.logger = logger.child({ module: 'ws-message-handler' });
    this.eventEmitter = eventEmitter;
  }

  /**
   * Handle incoming WebSocket message
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  handleIncomingMessage(connection: MCPWebSocketConnection, data: string): void {
    try {
      const message = JSON.parse(data) as WSMessage;

      this.logger.debug('Handling incoming message', {
        connectionId: connection.connectionId,
        messageId: message.id,
        messageType: message.type,
      });

      // Emit message received event
      this.eventEmitter.emitMessageEvent(WebSocketEventType.MESSAGE_RECEIVED, {
        connectionId: connection.connectionId,
        messageId: message.id ?? 'unknown',
        type: message.type,
        timestamp: message.timestamp,
        data: 'data' in message ? message.data : undefined,
      });

      // Route message based on type
      switch (message.type) {
        case WSMessageType.RESPONSE:
          this.handleResponseMessage(connection, message);
          break;
        case WSMessageType.EVENT:
          this.handleEventMessage(connection, message);
          break;
        case WSMessageType.ERROR:
          this.handleErrorMessage(connection, message);
          break;
        case WSMessageType.SUBSCRIPTION_UPDATE:
          this.handleSubscriptionUpdate(connection, message);
          break;
        default:
          this.logger.debug('Unhandled message type', {
            type: message.type,
            connectionId: connection.connectionId,
          });
      }
    } catch (error) {
      this.logger.error('Failed to handle incoming message', {
        connectionId: connection.connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        dataSample: data.substring(0, 100),
      });
    }
  }

  /**
   * Handle response message
   */
  handleResponseMessage(connection: MCPWebSocketConnection, message: WSResponseMessage): void {
    const pending = connection.pendingRequests.get(message.id);
    if (!pending) {
      this.logger.debug('No pending request for response', {
        connectionId: connection.connectionId,
        messageId: message.id,
      });
      return;
    }

    clearTimeout(pending.timeout);
    connection.pendingRequests.delete(message.id);

    const mcpResponse: MCPResponse = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(message.data),
        },
      ],
      metadata: {
        status: message.status,
        timestamp: message.timestamp,
        requestId: message.id,
      },
    };

    pending.resolve(mcpResponse);

    this.logger.debug('Response handled', {
      connectionId: connection.connectionId,
      messageId: message.id,
      status: message.status,
    });
  }

  /**
   * Handle event message
   */
  handleEventMessage(connection: MCPWebSocketConnection, message: WSEventMessage): void {
    const eventData = message.data as { topic?: string; data?: unknown } | undefined;

    if (eventData?.topic === null || eventData.topic === undefined || eventData.topic === '') {
      this.logger.debug('Event message without topic', {
        connectionId: connection.connectionId,
        messageId: message.id,
      });
      return;
    }

    // Find matching subscriptions and emit events
    let matched = false;
    for (const [subscriptionId, subscription] of connection.subscriptions) {
      if (subscription.topic === eventData.topic) {
        matched = true;
        subscription.handler(eventData.data);

        // Emit subscription update event
        this.eventEmitter.emitSubscriptionEvent(WebSocketEventType.SUBSCRIPTION_UPDATE, {
          connectionId: connection.connectionId,
          subscriptionId,
          topic: subscription.topic,
          timestamp: message.timestamp,
          data: eventData.data,
        });
      }
    }

    if (!matched) {
      this.logger.debug('No matching subscription for event', {
        connectionId: connection.connectionId,
        topic: eventData.topic,
      });
    }
  }

  /**
   * Handle error message
   */
  handleErrorMessage(connection: MCPWebSocketConnection, message: WSMessage): void {
    const errorMessage = message as WSMessage & {
      error?: { code: string; message: string };
    };

    const messageId = message.id ?? '';
    if (messageId === '') {
      return;
    }
    
    const pending = connection.pendingRequests.get(messageId);

    if (pending) {
      clearTimeout(pending.timeout);
      connection.pendingRequests.delete(messageId);

      const errorCode = parseInt(errorMessage.error?.code ?? '400', 10);
      pending.reject(
        new AppError(
          errorMessage.error?.message ?? 'Unknown error',
          isNaN(errorCode) ? 400 : errorCode,
        ),
      );

      this.logger.debug('Error message handled', {
        connectionId: connection.connectionId,
        messageId: message.id,
        error: errorMessage.error,
      });
    } else {
      this.logger.warn('Error message without pending request', {
        connectionId: connection.connectionId,
        messageId: message.id,
        error: errorMessage.error,
      });
    }
  }

  /**
   * Handle subscription update
   */
  handleSubscriptionUpdate(connection: MCPWebSocketConnection, message: WSMessage): void {
    const updateMessage = message as WSMessage & {
      topic?: string;
      data?: unknown;
    };

    if (updateMessage.topic === null || updateMessage.topic === undefined || updateMessage.topic === '') {
      this.logger.debug('Subscription update without topic', {
        connectionId: connection.connectionId,
        messageId: message.id,
      });
      return;
    }

    // Find matching subscriptions and emit events
    let matched = false;
    for (const [subscriptionId, subscription] of connection.subscriptions) {
      if (subscription.topic === updateMessage.topic) {
        matched = true;
        subscription.handler(updateMessage.data);

        // Emit subscription update event
        this.eventEmitter.emitSubscriptionEvent(WebSocketEventType.SUBSCRIPTION_UPDATE, {
          connectionId: connection.connectionId,
          subscriptionId,
          topic: subscription.topic,
          timestamp: message.timestamp,
          data: updateMessage.data,
        });
      }
    }

    if (!matched) {
      this.logger.debug('No matching subscription for update', {
        connectionId: connection.connectionId,
        topic: updateMessage.topic,
      });
    }
  }
}