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
      this.sendError(ws, message.id, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    const { topic, filters } = message;

    try {
      if (message.type === WSMessageType.SUBSCRIBE) {
        // Validate subscription permission
        if (!this.validateSubscriptionPermission(connectionState, topic)) {
          this.sendError(ws, message.id, 'FORBIDDEN', 'Access denied to topic');
          return;
        }

        // Add subscription
        const added = this.connectionManager.addSubscription(connectionId, topic);
        
        if (added) {
          this.logger.info('Client subscribed to topic', {
            connectionId,
            userId: connectionState.userId,
            topic,
          });

          // Send confirmation
          this.sendEvent(ws, 'subscription_confirmed', {
            topic,
            filters,
          });
        }
      } else {
        // Remove subscription
        const removed = this.connectionManager.removeSubscription(connectionId, topic);
        
        if (removed) {
          this.logger.info('Client unsubscribed from topic', {
            connectionId,
            userId: connectionState.userId,
            topic,
          });

          // Send confirmation
          this.sendEvent(ws, 'unsubscription_confirmed', {
            topic,
          });
        }
      }
    } catch (error) {
      this.logger.error('Subscription error:', error);
      this.sendError(ws, message.id, 'SUBSCRIPTION_ERROR', 'Failed to process subscription');
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
    
    // Check resource-specific permissions
    switch (resource) {
      case 'sessions':
        // Users can only subscribe to their own session events
        if (topicParts[1] !== null && topicParts[1] !== undefined && topicParts[1].length > 0 && topicParts[1] !== connectionState.userId) {
          return false;
        }
        break;

      case 'contexts':
        // Users can subscribe to contexts in their sessions
        // TODO: Implement more granular permission checking
        break;

      case 'system':
        // System events require admin role
        // TODO: Add roles to connection state or check via session
        return false;
        break;

      default:
        // Unknown topics are denied by default
        return false;
    }

    return true;
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
          ...data,
        });
      }
    });
  }
}