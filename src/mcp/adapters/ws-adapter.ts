/* eslint-disable max-lines */
/**
 * WebSocket Adapter for MCP
 * @module mcp/adapters/ws-adapter
 * @description Translates MCP API calls to WebSocket operations and handles real-time communication
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist ia-2 "Identification and authentication"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { WebSocket } from 'ws';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { pino } from 'pino';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ProtocolAdapter, MCPResponse, AuthParams } from './adapter.interface.js';
import { WSConnectionManager } from '../../ws/connection-manager.js';
import { WSSubscriptionManager } from '../../ws/subscription-manager.js';
import { 
  WSMessageType,
  type WSMessage,
  type WSRequestMessage,
  type WSResponseMessage,
  type WSEventMessage,
  type WSSubscriptionMessage,
  type WSAuthMessage
} from '../../types/websocket.js';

/**
 * WebSocket operation parameters
 */
const WebSocketOperationSchema = z.object({
  type: z.enum(['subscribe', 'unsubscribe', 'send', 'broadcast']),
  topic: z.string().optional(),
  event: z.string().optional(),
  data: z.unknown().optional(),
  filters: z.record(z.unknown()).optional(),
  duration: z.number().positive().optional(),
  timeout: z.number().positive().default(30000),
});

type WebSocketOperation = z.infer<typeof WebSocketOperationSchema>;

/**
 * WebSocket connection wrapper for MCP
 */
interface MCPWebSocketConnection {
  ws: WebSocket;
  connectionId: string;
  authenticated: boolean;
  pendingRequests: Map<string, {
    resolve: (response: MCPResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
  subscriptions: Map<string, {
    topic: string;
    filters?: Record<string, unknown>;
    handler: (data: unknown) => void;
  }>;
}

/**
 * WebSocket adapter for MCP protocol
 * @nist ac-3 "Access enforcement"
 * @nist ia-2 "Identification and authentication"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export class WebSocketAdapter implements ProtocolAdapter {
  private readonly logger: pino.Logger;
  private readonly connectionManager: WSConnectionManager;
  private readonly subscriptionManager: WSSubscriptionManager;
  private readonly activeConnections: Map<string, MCPWebSocketConnection> = new Map();
  private readonly eventEmitter: EventEmitter = new EventEmitter();

  constructor(
    logger: pino.Logger,
    connectionManager: WSConnectionManager,
    subscriptionManager: WSSubscriptionManager
  ) {
    this.logger = logger.child({ module: 'mcp-ws-adapter' });
    this.connectionManager = connectionManager;
    this.subscriptionManager = subscriptionManager;
    
    // Set up event listeners for subscription updates
    this.setupEventListeners();
  }

  /**
   * Execute a WebSocket operation through MCP
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async executeRequest(params: {
    operation: unknown;
    auth?: AuthParams;
    sessionId?: string;
    [key: string]: unknown;
  }): Promise<MCPResponse> {
    try {
      // Validate operation parameters
      const operation = WebSocketOperationSchema.parse(params.operation);
      
      // Ensure connection is established and authenticated
      const connection = await this.ensureConnection(params.auth, params.sessionId);
      
      // Log security event
      await logSecurityEvent(SecurityEventType.API_ACCESS, {
        userId: params.sessionId,
        action: `websocket_${operation.type}`,
        resource: operation.topic ?? 'websocket',
        result: 'success',
        metadata: { operation: operation.type },
      });

      // Execute operation based on type
      switch (operation.type) {
        case 'subscribe':
          return await this.handleSubscribe(connection, operation);
        case 'unsubscribe':
          return await this.handleUnsubscribe(connection, operation);
        case 'send':
          return await this.handleSend(connection, operation);
        case 'broadcast':
          return await this.handleBroadcast(connection, operation);
        default:
          throw new AppError('Invalid WebSocket operation', 400);
      }
    } catch (error) {
      // Log security event for failures
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        userId: params.sessionId,
        action: 'websocket_operation',
        resource: 'websocket',
        result: 'failure',
        reason: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Handle subscription operation
   * @nist ac-3 "Access enforcement"
   */
  private async handleSubscribe(
    connection: MCPWebSocketConnection,
    operation: WebSocketOperation
  ): Promise<MCPResponse> {
    if (!operation.topic) {
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
    await this.sendMessage(connection, subscriptionMessage);

    // Set up subscription handler
    const handler = (data: unknown) => {
      this.eventEmitter.emit(`subscription:${subscriptionId}`, data);
    };

    // Store subscription info
    connection.subscriptions.set(subscriptionId, {
      topic: operation.topic,
      filters: operation.filters,
      handler,
    });

    // Add to connection manager
    this.connectionManager.addSubscription(connection.connectionId, operation.topic);

    // Set up auto-cleanup if duration specified
    if (operation.duration) {
      setTimeout(() => {
        void this.cleanupSubscription(connection, subscriptionId);
      }, operation.duration);
    }

    return {
      content: [{
        type: 'text',
        text: `Subscribed to ${operation.topic}`,
      }],
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
  private async handleUnsubscribe(
    connection: MCPWebSocketConnection,
    operation: WebSocketOperation
  ): Promise<MCPResponse> {
    if (!operation.topic) {
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

    if (!subscriptionId) {
      throw new AppError('Subscription not found', 404);
    }

    // Clean up subscription
    await this.cleanupSubscription(connection, subscriptionId);

    return {
      content: [{
        type: 'text',
        text: `Unsubscribed from ${operation.topic}`,
      }],
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
  private async handleSend(
    connection: MCPWebSocketConnection,
    operation: WebSocketOperation
  ): Promise<MCPResponse> {
    const requestId = uuidv4();
    
    // Create request message
    const requestMessage: WSRequestMessage = {
      type: WSMessageType.REQUEST,
      id: requestId,
      timestamp: new Date().toISOString(),
      method: operation.event || 'send',
      path: operation.topic || '/',
      data: operation.data,
    };

    // Send request and wait for response
    const response = await this.sendRequestAndWaitForResponse(
      connection,
      requestMessage,
      operation.timeout
    );

    return response;
  }

  /**
   * Handle broadcast operation
   * @nist ac-3 "Access enforcement"
   */
  private handleBroadcast(
    _connection: MCPWebSocketConnection,
    operation: WebSocketOperation
  ): Promise<MCPResponse> {
    if (!operation.topic || !operation.event) {
      throw new AppError('Topic and event are required for broadcast', 400);
    }

    // Broadcast event through subscription manager
    this.subscriptionManager.broadcastEvent(
      operation.topic,
      operation.event,
      operation.data
    );

    return Promise.resolve({
      content: [{
        type: 'text',
        text: `Broadcast sent to topic ${operation.topic}`,
      }],
      metadata: {
        topic: operation.topic,
        event: operation.event,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Ensure WebSocket connection is established and authenticated
   * @nist ia-2 "Identification and authentication"
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  private async ensureConnection(
    auth?: AuthParams,
    sessionId?: string
  ): Promise<MCPWebSocketConnection> {
    const connectionId = sessionId || uuidv4();
    
    // Check if connection already exists
    let connection = this.activeConnections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      return connection;
    }

    // Create new connection
    const ws = await this.createWebSocketConnection();
    
    connection = {
      ws,
      connectionId,
      authenticated: false,
      pendingRequests: new Map(),
      subscriptions: new Map(),
    };

    // Store connection
    this.activeConnections.set(connectionId, connection);

    // Set up message handler
    ws.on('message', (data) => {
      this.handleIncomingMessage(connection, data.toString());
    });

    // Set up close handler
    ws.on('close', () => {
      this.cleanupConnection(connectionId);
    });

    // Authenticate if credentials provided
    if (auth) {
      await this.authenticateConnection(connection, auth);
    }

    return connection;
  }

  /**
   * Create WebSocket connection
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  private createWebSocketConnection(): Promise<WebSocket> {
    return new Promise((_, reject) => {
      // In a real implementation, this would connect to the WebSocket server
      // For this adapter, we're assuming we have access to the server-side WebSocket
      // This is a placeholder that would need to be adapted based on your architecture
      
      // For now, we'll throw an error indicating this needs implementation
      reject(new AppError(
        'WebSocket connection creation not implemented. This adapter needs to be integrated with your WebSocket server.',
        501
      ));
    });
  }

  /**
   * Authenticate WebSocket connection
   * @nist ia-2 "Identification and authentication"
   * @nist au-3 "Content of audit records"
   */
  private async authenticateConnection(
    connection: MCPWebSocketConnection,
    auth: AuthParams
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

    // Send auth message and wait for response
    const response = await this.sendRequestAndWaitForResponse(
      connection,
      authMessage,
      10000 // 10 second timeout for auth
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
  }

  /**
   * Send message through WebSocket
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  private sendMessage(
    connection: MCPWebSocketConnection,
    message: WSMessage
  ): Promise<void> {
    if (connection.ws.readyState !== WebSocket.OPEN) {
      throw new AppError('WebSocket connection not open', 503);
    }

    connection.ws.send(JSON.stringify(message));
    return Promise.resolve();
  }

  /**
   * Send request and wait for response
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  private sendRequestAndWaitForResponse(
    connection: MCPWebSocketConnection,
    message: WSMessage,
    timeout: number
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
      this.sendMessage(connection, { ...message, id: requestId }).catch(reject);
    });
  }

  /**
   * Handle incoming WebSocket message
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  private handleIncomingMessage(
    connection: MCPWebSocketConnection,
    data: string
  ): void {
    try {
      const message = JSON.parse(data) as WSMessage;

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
          this.logger.debug('Unhandled message type', { type: message.type });
      }
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message', error);
    }
  }

  /**
   * Handle response message
   */
  private handleResponseMessage(
    connection: MCPWebSocketConnection,
    message: WSResponseMessage
  ): void {
    const pending = connection.pendingRequests.get(message.id);
    if (pending) {
      clearTimeout(pending.timeout);
      connection.pendingRequests.delete(message.id);

      const mcpResponse: MCPResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify(message.data),
        }],
        metadata: {
          status: message.status,
          timestamp: message.timestamp,
          requestId: message.id,
        },
      };

      pending.resolve(mcpResponse);
    }
  }

  /**
   * Handle event message
   */
  private handleEventMessage(
    connection: MCPWebSocketConnection,
    message: WSEventMessage
  ): void {
    // Emit event for subscriptions
    const eventData = message.data as { topic?: string; data?: unknown };
    if (eventData.topic) {
      for (const [id, sub] of connection.subscriptions) {
        if (sub.topic === eventData.topic) {
          sub.handler(eventData.data);
          this.eventEmitter.emit(`subscription:${id}`, eventData.data);
        }
      }
    }
  }

  /**
   * Handle error message
   */
  private handleErrorMessage(
    connection: MCPWebSocketConnection,
    message: WSMessage
  ): void {
    const errorMessage = message as { error: { code: string; message: string } };
    const pending = connection.pendingRequests.get(message.id || '');
    
    if (pending) {
      clearTimeout(pending.timeout);
      connection.pendingRequests.delete(message.id || '');
      pending.reject(new AppError(
        errorMessage.error.message,
        400
      ));
    }
  }


  /**
   * Handle subscription update
   */
  private handleSubscriptionUpdate(
    connection: MCPWebSocketConnection,
    message: WSMessage
  ): void {
    const updateMessage = message as { topic: string; data: unknown };
    
    // Find matching subscriptions and emit events
    for (const [id, sub] of connection.subscriptions) {
      if (sub.topic === updateMessage.topic) {
        sub.handler(updateMessage.data);
        this.eventEmitter.emit(`subscription:${id}`, updateMessage.data);
      }
    }
  }

  /**
   * Clean up subscription
   */
  private async cleanupSubscription(
    connection: MCPWebSocketConnection,
    subscriptionId: string
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

    await this.sendMessage(connection, unsubscribeMessage);

    // Remove from connection manager
    this.connectionManager.removeSubscription(connection.connectionId, subscription.topic);

    // Remove subscription
    connection.subscriptions.delete(subscriptionId);
  }

  /**
   * Clean up connection
   */
  private cleanupConnection(connectionId: string): void {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return;
    }

    // Clear all pending requests
    for (const [, pending] of connection.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new AppError('Connection closed', 503));
    }

    // Clear all subscriptions
    for (const [id] of connection.subscriptions) {
      this.cleanupSubscription(connection, id).catch(error => {
        this.logger.error('Failed to cleanup subscription', error);
      });
    }

    // Remove from connection manager
    this.connectionManager.removeConnection(connectionId);

    // Remove from active connections
    this.activeConnections.delete(connectionId);

    this.logger.info('Connection cleaned up', { connectionId });
  }

  /**
   * Set up event listeners for real-time updates
   */
  private setupEventListeners(): void {
    // This would typically connect to your WebSocket server's event system
    // For now, this is a placeholder
    this.logger.debug('WebSocket adapter event listeners set up');
  }

  /**
   * List available WebSocket endpoints
   */
  listEndpoints(): Promise<MCPResponse> {
    return Promise.resolve({
      content: [{
        type: 'text',
        text: JSON.stringify({
          endpoints: [
            {
              operation: 'subscribe',
              description: 'Subscribe to real-time updates on a topic',
              parameters: {
                topic: 'string (required)',
                filters: 'object (optional)',
                duration: 'number in ms (optional)',
              },
            },
            {
              operation: 'unsubscribe',
              description: 'Unsubscribe from a topic',
              parameters: {
                topic: 'string (required)',
              },
            },
            {
              operation: 'send',
              description: 'Send a message through WebSocket',
              parameters: {
                topic: 'string (optional)',
                event: 'string (optional)',
                data: 'any (optional)',
                timeout: 'number in ms (default: 30000)',
              },
            },
            {
              operation: 'broadcast',
              description: 'Broadcast a message to all subscribers of a topic',
              parameters: {
                topic: 'string (required)',
                event: 'string (required)',
                data: 'any (optional)',
              },
            },
          ],
        }, null, 2),
      }],
    });
  }

  /**
   * Get WebSocket capabilities
   */
  getCapabilities(): Promise<{
    protocol: string;
    version: string;
    features: string[];
    [key: string]: unknown;
  }> {
    return Promise.resolve({
      protocol: 'websocket',
      version: '1.0.0',
      features: [
        'real-time-messaging',
        'pub-sub',
        'authentication',
        'heartbeat',
        'auto-reconnect',
        'message-filtering',
        'broadcast',
      ],
      authentication: ['jwt', 'apikey'],
      subscriptionTopics: [
        'sessions.*',
        'contexts.*',
        'system.*',
      ],
      messageTypes: Object.values(WSMessageType),
    });
  }

  /**
   * Create a streaming response helper for MCP
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  createStreamingResponse(subscriptionId: string): AsyncGenerator<MCPResponse> {
    const self = this;
    
    return (async function* () {
      const events: unknown[] = [];
      let resolveNext: ((value: unknown) => void) | null = null;

      // Set up event listener
      const handler = (data: unknown) => {
        if (resolveNext) {
          resolveNext(data);
          resolveNext = null;
        } else {
          events.push(data);
        }
      };

      self.eventEmitter.on(`subscription:${subscriptionId}`, handler);

      try {
        while (true) {
          // Get next event
          const data = events.shift() || await new Promise(resolve => {
            resolveNext = resolve;
          });

          // Yield MCP response
          yield {
            content: [{
              type: 'text',
              text: JSON.stringify(data),
            }],
            metadata: {
              subscriptionId,
              timestamp: new Date().toISOString(),
            },
          };
        }
      } finally {
        // Clean up listener
        self.eventEmitter.off(`subscription:${subscriptionId}`, handler);
      }
    })();
  }
}