/**
 * WebSocket Operation Handlers
 * @module mcp/adapters/websocket/operation-handlers
 * @description Handlers for WebSocket operations
 * @nist ac-3 "Access enforcement"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../../core/errors/app-error.js';
import { WSMessageType } from '../../../types/websocket.js';
import type { MCPResponse } from '../adapter.interface.js';
import type {
  MCPWebSocketConnection,
  WebSocketOperation,
  WSRequestMessage,
  WSSubscriptionMessage,
  SubscriptionInfo,
} from './types.js';
import type { WebSocketProtocolHandler } from './protocol-handler.js';
import type { WebSocketEventEmitter } from './event-emitter.js';
import type { WebSocketSessionManager } from './session-manager.js';
import type { WSConnectionManager } from '../../../ws/connection-manager.js';
import type { WSSubscriptionManager } from '../../../ws/subscription-manager.js';

/**
 * WebSocket operation handlers configuration
 */
export interface OperationHandlersConfig {
  protocolHandler: WebSocketProtocolHandler;
  eventEmitter: WebSocketEventEmitter;
  sessionManager: WebSocketSessionManager;
  wsConnectionManager: WSConnectionManager;
  wsSubscriptionManager: WSSubscriptionManager;
}

/**
 * WebSocket operation handlers
 * @nist ac-3 "Access enforcement"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export class WebSocketOperationHandlers {
  private readonly protocolHandler: WebSocketProtocolHandler;
  private readonly eventEmitter: WebSocketEventEmitter;
  private readonly sessionManager: WebSocketSessionManager;
  private readonly wsConnectionManager: WSConnectionManager;
  private readonly wsSubscriptionManager: WSSubscriptionManager;

  constructor(config: OperationHandlersConfig) {
    this.protocolHandler = config.protocolHandler;
    this.eventEmitter = config.eventEmitter;
    this.sessionManager = config.sessionManager;
    this.wsConnectionManager = config.wsConnectionManager;
    this.wsSubscriptionManager = config.wsSubscriptionManager;
  }

  /**
   * Handle subscription operation
   * @nist ac-3 "Access enforcement"
   */
  async handleSubscribe(
    connection: MCPWebSocketConnection,
    operation: WebSocketOperation,
  ): Promise<MCPResponse> {
    if (operation.topic === null || operation.topic === undefined || operation.topic === '') {
      throw new AppError('Topic is required for subscription', 400);
    }

    const subscriptionId = uuidv4();

    // Create subscription message
    const subscriptionMessage: WSSubscriptionMessage = {
      type: WSMessageType.SUBSCRIBE,
      id: subscriptionId,
      timestamp: new Date().toISOString(),
      topic: operation.topic,
      filters: operation.filters,
    };

    // Send subscription request
    await this.protocolHandler.sendMessage(connection, subscriptionMessage);

    // Set up subscription handler
    const handler = (data: unknown): void => {
      this.eventEmitter.emit(`subscription:${subscriptionId}`, data);
    };

    // Store subscription info
    const subscriptionInfo: SubscriptionInfo = {
      topic: operation.topic,
      filters: operation.filters,
      handler,
    };

    connection.subscriptions.set(subscriptionId, subscriptionInfo);
    this.sessionManager.addSubscription(connection.connectionId, subscriptionId, subscriptionInfo);

    // Add to WebSocket connection manager
    this.wsConnectionManager.addSubscription(connection.connectionId, operation.topic);

    // Set up auto-cleanup if duration specified
    if (operation.duration !== null && operation.duration !== undefined && operation.duration > 0) {
      setTimeout(() => {
        void this.cleanupSubscription(connection, subscriptionId);
      }, operation.duration);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Subscribed to ${operation.topic}`,
        },
      ],
      metadata: {
        subscriptionId,
        topic: operation.topic,
        filters: operation.filters,
        duration: operation.duration,
      },
    };
  }

  /**
   * Handle unsubscribe operation
   * @nist ac-3 "Access enforcement"
   */
  async handleUnsubscribe(
    connection: MCPWebSocketConnection,
    operation: WebSocketOperation,
  ): Promise<MCPResponse> {
    if (operation.topic === null || operation.topic === undefined || operation.topic === '') {
      throw new AppError('Topic is required for unsubscription', 400);
    }

    // Find subscription by topic
    let subscriptionId: string | undefined;
    for (const [id, sub] of connection.subscriptions) {
      if (sub.topic === operation.topic) {
        subscriptionId = id;
        break;
      }
    }

    if (subscriptionId === null || subscriptionId === undefined || subscriptionId === '') {
      throw new AppError('Subscription not found', 404);
    }

    // Clean up subscription
    await this.cleanupSubscription(connection, subscriptionId);

    return {
      content: [
        {
          type: 'text',
          text: `Unsubscribed from ${operation.topic}`,
        },
      ],
      metadata: {
        topic: operation.topic,
      },
    };
  }

  /**
   * Handle send operation
   * @nist ac-3 "Access enforcement"
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  async handleSend(
    connection: MCPWebSocketConnection,
    operation: WebSocketOperation,
  ): Promise<MCPResponse> {
    const requestId = uuidv4();

    // Create request message
    const requestMessage: WSRequestMessage = {
      type: WSMessageType.REQUEST,
      id: requestId,
      timestamp: new Date().toISOString(),
      method: operation.event ?? 'send',
      path: operation.topic ?? '/',
      data: operation.data,
    };

    // Send request and wait for response
    const response = await this.protocolHandler.sendRequestAndWaitForResponse(
      connection,
      requestMessage,
      operation.timeout,
    );

    return response;
  }

  /**
   * Handle broadcast operation
   * @nist ac-3 "Access enforcement"
   */
  handleBroadcast(
    _connection: MCPWebSocketConnection,
    operation: WebSocketOperation,
  ): Promise<MCPResponse> {
    if (operation.topic === null || operation.topic === undefined || operation.topic === '' || operation.event === null || operation.event === undefined || operation.event === '') {
      throw new AppError('Topic and event are required for broadcast', 400);
    }

    // Broadcast event through subscription manager
    this.wsSubscriptionManager.broadcastEvent(operation.topic, operation.event, operation.data);

    return Promise.resolve({
      content: [
        {
          type: 'text',
          text: `Broadcast sent to topic ${operation.topic}`,
        },
      ],
      metadata: {
        topic: operation.topic,
        event: operation.event,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Clean up subscription
   */
  async cleanupSubscription(
    connection: MCPWebSocketConnection,
    subscriptionId: string,
  ): Promise<void> {
    const subscription = connection.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    // Send unsubscribe message
    const unsubscribeMessage: WSSubscriptionMessage = {
      type: WSMessageType.UNSUBSCRIBE,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      topic: subscription.topic,
    };

    await this.protocolHandler.sendMessage(connection, unsubscribeMessage);

    // Remove from WebSocket connection manager
    this.wsConnectionManager.removeSubscription(connection.connectionId, subscription.topic);

    // Remove subscription
    connection.subscriptions.delete(subscriptionId);
    this.sessionManager.removeSubscription(connection.connectionId, subscriptionId);

    // Clean up event listeners
    this.eventEmitter.removeAllListeners(`subscription:${subscriptionId}`);
  }
}