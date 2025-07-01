/**
 * WebSocket message router
 * @module ws/message-router
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
import { WSRequestProcessor } from './request-processor.js';
import { WSSubscriptionManager } from './subscription-manager.js';
import { sendError } from './message-handler-helpers.js';
import {
  wsMessageSchema,
  type WSMessage,
  type WSAuthMessage,
  WSMessageType,
} from '../types/websocket.js';

/**
 * WebSocket message router
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */
export class WSMessageRouter {
  private logger: pino.Logger;
  private connectionManager: WSConnectionManager;
  private authHandler: WSAuthHandler;
  private requestProcessor: WSRequestProcessor;
  private subscriptionManager: WSSubscriptionManager;

  constructor(
    logger: pino.Logger,
    sessionStore: SessionStore,
    connectionManager: WSConnectionManager,
    authHandler: WSAuthHandler
  ) {
    this.logger = logger.child({ module: 'ws-message-router' });
    this.connectionManager = connectionManager;
    this.authHandler = authHandler;
    this.requestProcessor = new WSRequestProcessor(logger, sessionStore, connectionManager, authHandler);
    this.subscriptionManager = new WSSubscriptionManager(logger, connectionManager);
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
          await this.requestProcessor.handleRequestMessage(ws, connectionId, message);
          break;

        case WSMessageType.SUBSCRIBE:
        case WSMessageType.UNSUBSCRIBE:
          this.subscriptionManager.handleSubscriptionMessage(ws, connectionId, message);
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
   * Broadcast event to subscribed connections
   * @nist ac-3 "Access enforcement"
   */
  broadcastEvent(topic: string, event: string, data: unknown): void {
    this.subscriptionManager.broadcastEvent(topic, event, data);
  }
}