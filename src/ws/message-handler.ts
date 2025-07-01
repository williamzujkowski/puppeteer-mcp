/**
 * WebSocket message handler
 * @module ws/message-handler
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 * @nist ac-3 "Access enforcement"
 */

import { WebSocket } from 'ws';
import { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { SessionStore } from '../store/session-store.interface.js';
import { WSConnectionManager } from './connection-manager.js';
import { WSAuthHandler } from './auth-handler.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { sendResponse, sendError } from './message-handler-helpers.js';
import { WSSessionHandler } from './session-handler.js';
import {
  wsMessageSchema,
  type WSMessage,
  type WSRequestMessage,
  type WSSubscriptionMessage,
  type WSEventMessage,
  type WSAuthMessage,
  type WSConnectionState,
  WSMessageType,
} from '../types/websocket.js';

/**
 * WebSocket message handler
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */
export class WSMessageHandler {
  private logger: pino.Logger;
  private sessionStore: SessionStore;
  private connectionManager: WSConnectionManager;
  private authHandler: WSAuthHandler;
  private sessionHandler: WSSessionHandler;

  constructor(
    logger: pino.Logger,
    sessionStore: SessionStore,
    connectionManager: WSConnectionManager,
    authHandler: WSAuthHandler
  ) {
    this.logger = logger.child({ module: 'ws-message-handler' });
    this.sessionStore = sessionStore;
    this.connectionManager = connectionManager;
    this.authHandler = authHandler;
    this.sessionHandler = new WSSessionHandler(logger, sessionStore, authHandler, connectionManager);
  }

  /**
   * Handle incoming WebSocket message
   * @nist si-10 "Information input validation"
   * @nist au-3 "Content of audit records"
   * @evidence code, test
   */
  async handleMessage(
    ws: WebSocket,
    connectionId: string,
    rawMessage: unknown
  ): Promise<void> {
    try {
      // Validate message schema
      const message = wsMessageSchema.parse(rawMessage);
      
      this.logger.debug('Handling WebSocket message', {
        connectionId,
        type: message.type,
        id: message.id,
      });

      // Route message based on type
      switch (message.type) {
        case WSMessageType.AUTH:
          await this.handleAuthMessage(ws, connectionId, message);
          break;

        case WSMessageType.PING:
          this.handlePingMessage(ws, message);
          break;

        case WSMessageType.REQUEST:
          await this.handleRequestMessage(ws, connectionId, message);
          break;

        case WSMessageType.SUBSCRIBE:
        case WSMessageType.UNSUBSCRIBE:
          this.handleSubscriptionMessage(ws, connectionId, message);
          break;

        default:
          sendError({ ws, requestId: message.id, code: 'UNKNOWN_MESSAGE_TYPE', message: `Unknown message type: ${message.type}` }, this.logger);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.warn('Invalid message format', {
          connectionId,
          errors: error.errors,
        });
        
        sendError({ ws, requestId: undefined, code: 'INVALID_MESSAGE', message: 'Invalid message format', details: error.errors }, this.logger);
      } else {
        this.logger.error('Error handling message:', error);
        sendError({ ws, requestId: undefined, code: 'INTERNAL_ERROR', message: 'Failed to process message' }, this.logger);
      }
    }
  }

  /**
   * Handle authentication message
   * @nist ia-2 "Identification and authentication"
   */
  private async handleAuthMessage(
    ws: WebSocket,
    connectionId: string,
    message: WSMessage
  ): Promise<void> {
    const result = await this.authHandler.handleAuth(ws, connectionId, message as WSAuthMessage);
    
    if (result.success && result.userId !== undefined && result.userId !== null && result.userId.length > 0 && result.sessionId !== undefined && result.sessionId !== null && result.sessionId.length > 0) {
      // Update connection state
      this.connectionManager.authenticateConnection(
        connectionId,
        result.userId,
        result.sessionId
      );
    }
  }

  /**
   * Handle ping message
   */
  private handlePingMessage(ws: WebSocket, message: WSMessage): void {
    // Send pong response
    const pongMessage: WSMessage = {
      type: WSMessageType.PONG,
      id: message.id ?? uuidv4(),
      timestamp: new Date().toISOString(),
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(pongMessage));
    }
  }

  /**
   * Handle request message
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  private async handleRequestMessage(
    ws: WebSocket,
    connectionId: string,
    message: WSRequestMessage
  ): Promise<void> {
    try {
      // Check authentication
      const connectionState = this.connectionManager.getConnectionState(connectionId);
      if (connectionState?.authenticated !== true) {
        sendError({ ws, requestId: message.id, code: 'UNAUTHORIZED', message: 'Authentication required' }, this.logger);
        return;
      }

      // Log API access
      await logSecurityEvent(SecurityEventType.API_ACCESS, {
        resource: message.path,
        action: message.method,
        result: 'success',
        metadata: {
          connectionId,
          userId: connectionState.userId,
          requestId: message.id,
        },
      });

      // Route request based on path and method
      const response = await this.routeRequest(
        connectionState,
        message.method,
        message.path,
        message.data,
        message.headers
      );

      // Send response
      sendResponse({ ws, requestId: message.id, status: 200, data: response }, this.logger);

      // Log successful access
      await logSecurityEvent(SecurityEventType.API_ACCESS, {
        resource: message.path,
        action: message.method,
        result: 'success',
        metadata: {
          connectionId,
          userId: connectionState.userId,
          requestId: message.id,
        },
      });
    } catch (error) {
      this.logger.error('Request handling error:', error);
      
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      const errorCode = (error as { code?: string }).code ?? 'REQUEST_ERROR';
      const errorMessage = error instanceof Error ? error.message : 'Request failed';

      this.sendResponse(ws, message.id, statusCode, null, {
        code: errorCode,
        message: errorMessage,
      });

      // Log failed access
      await logSecurityEvent(SecurityEventType.API_ACCESS, {
        resource: message.path,
        action: message.method,
        result: 'failure',
        reason: errorMessage,
        metadata: {
          connectionId,
          userId: connectionState?.userId,
          requestId: message.id,
          statusCode,
        },
      });
    }
  }

  /**
   * Route request to appropriate handler
   * @nist ac-3 "Access enforcement"
   */
  private routeRequest(
    connectionState: WSConnectionState,
    method: string,
    path: string,
    data: unknown,
    _headers?: Record<string, string>
  ): Promise<unknown> {
    // Parse path
    const pathParts = path.split('/').filter(p => p);
    
    if (pathParts.length === 0) {
      throw new Error('Invalid path');
    }

    const resource = pathParts[0];
    const action = pathParts[1];

    // Route based on resource
    switch (resource) {
      case 'sessions': {
        const sessionId = pathParts[1];
        return this.sessionHandler.handleSessionRequest(connectionState, method, sessionId, data, action);
      }
      
      case 'contexts':
        return this.handleContextRequest(connectionState, method, action, data);
      
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }


  /**
   * Handle context-related requests
   * @nist ac-3 "Access enforcement"
   */
  private handleContextRequest(
    _connectionState: WSConnectionState,
    _method: string,
    _action: string,
    _data: unknown
  ): Promise<unknown> {
    // TODO: Implement context handling via WebSocket
    throw new Error('Context operations not yet implemented via WebSocket');
  }

  /**
   * Handle subscription message
   * @nist ac-3 "Access enforcement"
   */
  private handleSubscriptionMessage(
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