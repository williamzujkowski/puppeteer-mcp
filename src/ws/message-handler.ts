/**
 * WebSocket message handler
 * @module ws/message-handler
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 * @nist ac-3 "Access enforcement"
 */

import { WebSocket } from 'ws';
import { pino } from 'pino';
import type { SessionStore } from '../store/session-store.interface.js';
import { WSConnectionManager } from './connection-manager.js';
import { WSAuthHandler } from './auth-handler.js';
import { WSMessageRouter } from './message-router.js';

/**
 * WebSocket message handler
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */
export class WSMessageHandler {
  private logger: pino.Logger;
  private messageRouter: WSMessageRouter;

  constructor(
    logger: pino.Logger,
    sessionStore: SessionStore,
    connectionManager: WSConnectionManager,
    authHandler: WSAuthHandler
  ) {
    this.logger = logger.child({ module: 'ws-message-handler' });
    this.messageRouter = new WSMessageRouter(logger, sessionStore, connectionManager, authHandler);
  }

  /**
   * Handle incoming WebSocket message
   * @nist si-10 "Information input validation"
   * @nist au-3 "Content of audit records"
   * @evidence code, test
   */
  handleMessage(
    ws: WebSocket,
    connectionId: string,
    rawMessage: unknown
  ): void {
    void this.messageRouter.handleMessage(ws, connectionId, rawMessage);
  }

  /**
   * Broadcast event to subscribed connections
   * @nist ac-3 "Access enforcement"
   */
  broadcastEvent(topic: string, event: string, data: unknown): void {
    this.messageRouter.broadcastEvent(topic, event, data);
  }
}