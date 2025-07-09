/**
 * WebSocket Protocol Handler
 * @module mcp/adapters/websocket/protocol-handler
 * @description MCP protocol-specific message handling
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ia-2 "Identification and authentication"
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import { AppError } from '../../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';
import { WSMessageType } from '../../../types/websocket.js';
import type {
  MCPWebSocketConnection,
  WSMessage,
  WSAuthMessage,
  ProtocolHandlerInterface,
} from './types.js';
import type { MCPResponse, AuthParams } from '../adapter.interface.js';

/**
 * WebSocket protocol handler
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ia-2 "Identification and authentication"
 */
export class WebSocketProtocolHandler implements ProtocolHandlerInterface {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ module: 'ws-protocol-handler' });
  }

  /**
   * Send message through WebSocket
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  sendMessage(connection: MCPWebSocketConnection, message: WSMessage): Promise<void> {
    if (connection.ws.readyState !== WebSocket.OPEN) {
      throw new AppError('WebSocket connection not open', 503);
    }

    try {
      const jsonMessage = JSON.stringify(message);
      connection.ws.send(jsonMessage);

      this.logger.debug('Message sent', {
        connectionId: connection.connectionId,
        messageId: message.id,
        messageType: message.type,
      });
      
      return Promise.resolve();
    } catch (error) {
      this.logger.error('Failed to send message', {
        connectionId: connection.connectionId,
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to send message', 500);
    }
  }

  /**
   * Send request and wait for response
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  async sendRequestAndWaitForResponse(
    connection: MCPWebSocketConnection,
    message: WSMessage,
    timeout: number,
  ): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      const requestId = message.id ?? uuidv4();

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        connection.pendingRequests.delete(requestId);
        reject(new AppError('Request timeout', 408));
      }, timeout);

      // Store pending request
      connection.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      // Send message
      this.sendMessage(connection, { ...message, id: requestId }).catch((error) => {
        connection.pendingRequests.delete(requestId);
        clearTimeout(timeoutHandle);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  /**
   * Authenticate WebSocket connection
   * @nist ia-2 "Identification and authentication"
   * @nist au-3 "Content of audit records"
   */
  async authenticateConnection(
    connection: MCPWebSocketConnection,
    auth: AuthParams,
  ): Promise<void> {
    const authMessage: WSAuthMessage = {
      type: WSMessageType.AUTH,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      data: {
        token: auth.type === 'jwt' ? auth.credentials : '',
        apiKey: auth.type === 'apikey' ? auth.credentials : undefined,
      },
    };

    try {
      // Send auth message and wait for response
      const response = await this.sendRequestAndWaitForResponse(
        connection,
        authMessage,
        10000, // 10 second timeout for auth
      );

      if (response.metadata?.status !== 200) {
        throw new AppError('Authentication failed', 401);
      }

      connection.authenticated = true;

      // Log security event
      await logSecurityEvent(SecurityEventType.AUTH_SUCCESS, {
        userId: connection.connectionId,
        action: 'websocket_auth',
        resource: 'websocket',
        result: 'success',
        metadata: { authType: auth.type },
      });

      this.logger.info('Connection authenticated', {
        connectionId: connection.connectionId,
        authType: auth.type,
      });
    } catch (error) {
      // Log security event for failure
      await logSecurityEvent(SecurityEventType.AUTH_FAILURE, {
        userId: connection.connectionId,
        action: 'websocket_auth',
        resource: 'websocket',
        result: 'failure',
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: { authType: auth.type },
      });

      throw error;
    }
  }

  /**
   * Parse WebSocket data to message
   */
  parseMessage(data: WebSocket.Data): WSMessage {
    let message: string;

    if (typeof data === 'string') {
      message = data;
    } else if (data instanceof Buffer) {
      message = data.toString('utf8');
    } else if (data instanceof ArrayBuffer) {
      message = new TextDecoder().decode(data);
    } else if (Array.isArray(data)) {
      // Handle array of buffers
      message = Buffer.concat(data).toString('utf8');
    } else {
      // For other types, use JSON.stringify for objects or String for primitives
      message = typeof data === 'object' ? JSON.stringify(data) : String(data);
    }

    try {
      return JSON.parse(message) as WSMessage;
    } catch (error) {
      this.logger.error('Failed to parse message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        dataSample: message.substring(0, 100),
      });
      throw new AppError('Invalid message format', 400);
    }
  }

  /**
   * Create MCP response from WebSocket message
   */
  createMCPResponse(message: WSMessage, metadata?: Record<string, unknown>): MCPResponse {
    const content = message.data
      ? [
          {
            type: 'text' as const,
            text: typeof message.data === 'string' ? message.data : JSON.stringify(message.data),
          },
        ]
      : [];

    return {
      content,
      metadata: {
        messageId: message.id,
        timestamp: message.timestamp,
        type: message.type,
        ...metadata,
      },
    };
  }

  /**
   * Validate message structure
   */
  validateMessage(message: unknown): message is WSMessage {
    if (!message || typeof message !== 'object') {
      return false;
    }

    const msg = message as Record<string, unknown>;
    return (
      typeof msg.type === 'string' &&
      typeof msg.id === 'string' &&
      typeof msg.timestamp === 'string'
    );
  }
}