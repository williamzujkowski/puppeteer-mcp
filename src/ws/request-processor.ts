/**
 * WebSocket request processor
 * @module ws/request-processor
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import { pino } from 'pino';
import type { SessionStore } from '../store/session-store.interface.js';
import { WSConnectionManager } from './connection-manager.js';
import { WSAuthHandler } from './auth-handler.js';
import { WSSessionHandler } from './session-handler.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { sendResponse, sendError } from './message-handler-helpers.js';
import {
  type WSRequestMessage,
  type WSConnectionState,
} from '../types/websocket.js';

interface SendResponseOptions {
  ws: WebSocket;
  requestId: string;
  statusCode: number;
  data: unknown;
  error?: { code: string; message: string };
}

/**
 * Route request parameters
 */
interface RouteRequestParams {
  connectionState: WSConnectionState;
  method: string;
  path: string;
  data: unknown;
  headers?: Record<string, string>;
}

/**
 * WebSocket request processor
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */
export class WSRequestProcessor {
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
    this.logger = logger.child({ module: 'ws-request-processor' });
    this.sessionStore = sessionStore;
    this.connectionManager = connectionManager;
    this.authHandler = authHandler;
    this.sessionHandler = new WSSessionHandler(sessionStore, authHandler, connectionManager);
  }

  /**
   * Handle request message
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  async handleRequestMessage(
    ws: WebSocket,
    connectionId: string,
    message: WSRequestMessage
  ): Promise<void> {
    // Check authentication
    const connectionState = this.connectionManager.getConnectionState(connectionId);
    
    try {
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
      const response = await this.routeRequest({
        connectionState,
        method: message.method,
        path: message.path,
        data: message.data,
        headers: message.headers
      });

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

      this.sendResponse({
        ws,
        requestId: message.id,
        statusCode,
        data: null,
        error: {
          code: errorCode,
          message: errorMessage,
        }
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
  private routeRequest(params: RouteRequestParams): Promise<unknown> {
    const { connectionState, method, path, data } = params;
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
        return this.sessionHandler.handleSessionRequest({
          connectionState,
          method,
          sessionId,
          data,
          action
        });
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
   * Send response message
   */
  private sendResponse(options: SendResponseOptions): void {
    const { ws, requestId, statusCode, data, error } = options;
    if (error) {
      sendError({ ws, requestId, code: error.code, message: error.message }, this.logger);
    } else {
      sendResponse({ ws, requestId, status: statusCode, data }, this.logger);
    }
  }
}