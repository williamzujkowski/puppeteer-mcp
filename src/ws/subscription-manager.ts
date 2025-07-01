/**
 * WebSocket subscription manager
 * @module ws/subscription-manager
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { WSConnectionManager } from './connection-manager.js';
import { sendError } from './message-handler-helpers.js';
import {
  type WSSubscriptionMessage,
  type WSEventMessage,
  type WSConnectionState,
  WSMessageType,
} from '../types/websocket.js';
import { Permission, hasPermission } from '../auth/permissions.js';

/**
 * WebSocket subscription manager
 * @nist ac-3 "Access enforcement"
 */
export class WSSubscriptionManager {
  private logger: pino.Logger;
  private connectionManager: WSConnectionManager;

  constructor(
    logger: pino.Logger,
    connectionManager: WSConnectionManager
  ) {
    this.logger = logger.child({ module: 'ws-subscription-manager' });
    this.connectionManager = connectionManager;
  }

  /**
   * Handle subscription message
   * @nist ac-3 "Access enforcement"
   */
  handleSubscriptionMessage(
    ws: WebSocket,
    connectionId: string,
    message: WSSubscriptionMessage
  ): void {
    // Check authentication
    const connectionState = this.connectionManager.getConnectionState(connectionId);
    if (connectionState?.authenticated !== true) {
      this.sendError(ws, message.id ?? '', 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    const { topic, filters } = message;

    try {
      if (message.type === WSMessageType.SUBSCRIBE) {
        this.handleSubscribe(ws, connectionId, connectionState, message, topic, filters);
      } else {
        this.handleUnsubscribe(ws, connectionId, connectionState, topic);
      }
    } catch (error) {
      this.logger.error('Subscription error:', error);
      this.sendError(ws, message.id ?? '', 'SUBSCRIPTION_ERROR', 'Failed to process subscription');
    }
  }

  private handleSubscribe(params: {
    ws: WebSocket;
    connectionId: string;
    connectionState: WSConnectionState;
    message: WSSubscriptionMessage;
    topic: string;
    filters?: Record<string, unknown>;
  }): void {
    const { ws, connectionId, connectionState, message, topic, filters } = params;
    // Validate subscription permission
    if (!this.validateSubscriptionPermission(connectionState, topic)) {
      this.sendError(ws, message.id ?? '', 'FORBIDDEN', 'Access denied to topic');
      return;
    }

    // Add subscription
    const added = this.connectionManager.addSubscription(connectionId, topic);
    
    if (added) {
      this.logger.info('Client subscribed to topic', {
        connectionId,
        userId: connectionState.userId ?? 'unknown',
        topic,
      });

      // Send confirmation
      this.sendEvent(ws, 'subscription_confirmed', {
        topic,
        filters,
      });
    }
  }

  private handleUnsubscribe(
    ws: WebSocket,
    connectionId: string,
    connectionState: WSConnectionState,
    topic: string
  ): void {
    // Remove subscription
    const removed = this.connectionManager.removeSubscription(connectionId, topic);
    
    if (removed) {
      this.logger.info('Client unsubscribed from topic', {
        connectionId,
        userId: connectionState.userId ?? 'unknown',
        topic,
      });

      // Send confirmation
      this.sendEvent(ws, 'unsubscription_confirmed', {
        topic,
      });
    }
  }

  /**
   * Validate subscription permission
   * @nist ac-3 "Access enforcement"
   */
  private validateSubscriptionPermission(connectionState: WSConnectionState, topic: string): boolean {
    // Parse topic to check permissions
    const topicParts = topic.split('.');
    
    if (topicParts.length === 0) {
      return false;
    }

    const resource = topicParts[0];
    
    // Delegate to specific validation methods
    switch (resource) {
      case 'sessions':
        return this.validateSessionsSubscription(topicParts, connectionState);
      case 'contexts':
        return this.validateContextsSubscription(connectionState);
      case 'system':
        return this.validateSystemSubscription(connectionState);
      default:
        return false;
    }
  }

  private validateSessionsSubscription(topicParts: string[], connectionState: WSConnectionState): boolean {
    // Users can only subscribe to their own session events
    const targetUserId = topicParts[1];
    if (targetUserId && targetUserId !== connectionState.userId) {
      return false;
    }
    return true;
  }

  private validateContextsSubscription(connectionState: WSConnectionState): boolean {
    // Users can subscribe to contexts in their sessions
    return hasPermission(
      connectionState.roles ?? [],
      Permission.SUBSCRIPTION_READ,
      connectionState.scopes
    );
  }

  private validateSystemSubscription(connectionState: WSConnectionState): boolean {
    // System events require admin role
    return hasPermission(
      connectionState.roles ?? [],
      Permission.ADMIN_ALL,
      connectionState.scopes
    );
  }

  /**
   * Send event message
   */
  private sendEvent(ws: WebSocket, event: string, data: unknown): void {
    const message: WSEventMessage = {
      type: WSMessageType.EVENT,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      event,
      data,
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(ws: WebSocket, requestId: string, code: string, message: string): void {
    sendError({ ws, requestId, code, message }, this.logger);
  }

  /**
   * Broadcast event to subscribed connections
   * @nist ac-3 "Access enforcement"
   */
  broadcastEvent(topic: string, event: string, data: unknown): void {
    const connections = this.connectionManager.getConnectionsByTopic(topic);
    
    connections.forEach(({ ws, state }) => {
      // Additional permission check if needed
      if (this.validateSubscriptionPermission(state, topic)) {
        this.sendEvent(ws, event, {
          topic,
          data,
        });
      }
    });
  }
}