/**
 * WebSocket Connection Manager
 * @module mcp/adapters/websocket/connection-manager
 * @description WebSocket connection management and lifecycle
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-3 "Access enforcement"
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import { AppError } from '../../../core/errors/app-error.js';
import type {
  MCPWebSocketConnection,
  ConnectionManagerInterface,
} from './types.js';
import type { AuthParams } from '../adapter.interface.js';
import { WebSocketProtocolHandler } from './protocol-handler.js';
import { WebSocketMessageHandler } from './message-handler.js';
import { WebSocketErrorHandler } from './error-handler.js';
import { WebSocketEventEmitter, WebSocketEventType } from './event-emitter.js';
import { WebSocketSessionManager } from './session-manager.js';

/**
 * WebSocket connection manager
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-3 "Access enforcement"
 */
export class WebSocketConnectionManager implements ConnectionManagerInterface {
  private readonly logger: Logger;
  private readonly activeConnections: Map<string, MCPWebSocketConnection> = new Map();
  private readonly protocolHandler: WebSocketProtocolHandler;
  private readonly messageHandler: WebSocketMessageHandler;
  private readonly errorHandler: WebSocketErrorHandler;
  private readonly eventEmitter: WebSocketEventEmitter;
  private readonly sessionManager: WebSocketSessionManager;

  constructor(
    logger: Logger,
    eventEmitter: WebSocketEventEmitter,
    sessionManager: WebSocketSessionManager,
  ) {
    this.logger = logger.child({ module: 'ws-connection-manager' });
    this.eventEmitter = eventEmitter;
    this.sessionManager = sessionManager;
    this.protocolHandler = new WebSocketProtocolHandler(logger);
    this.messageHandler = new WebSocketMessageHandler(logger, eventEmitter);
    this.errorHandler = new WebSocketErrorHandler(logger);
  }

  /**
   * Ensure WebSocket connection is established and authenticated
   * @nist ia-2 "Identification and authentication"
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  async ensureConnection(auth?: AuthParams, sessionId?: string): Promise<MCPWebSocketConnection> {
    const connectionId = sessionId ?? uuidv4();

    // Check if connection already exists
    let connection = this.activeConnections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      this.sessionManager.updateActivity(connectionId);
      return connection;
    }

    try {
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
      this.sessionManager.createSession(connectionId);

      // Set up connection handlers
      this.setupConnectionHandlers(connection);

      // Emit connection open event
      this.eventEmitter.emitConnectionEvent(WebSocketEventType.CONNECTION_OPEN, {
        connectionId,
        timestamp: new Date().toISOString(),
      });

      // Authenticate if credentials provided
      if (auth) {
        await this.protocolHandler.authenticateConnection(connection, auth);
      }

      this.logger.info('Connection established', {
        connectionId,
        authenticated: connection.authenticated,
      });

      return connection;
    } catch (error) {
      // Clean up on failure
      if (connectionId) {
        this.cleanupConnection(connectionId);
      }

      await this.errorHandler.handleConnectionError(
        connectionId,
        error as Error,
        sessionId,
      );

      throw error;
    }
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

      reject(
        new AppError(
          'WebSocket connection creation not implemented. This adapter needs to be integrated with your WebSocket server.',
          501,
        ),
      );
    });
  }

  /**
   * Set up connection handlers
   */
  private setupConnectionHandlers(connection: MCPWebSocketConnection): void {
    const { ws, connectionId } = connection;

    // Message handler
    ws.on('message', (data) => {
      try {
        const message = this.protocolHandler.parseMessage(data);
        this.messageHandler.handleIncomingMessage(connection, JSON.stringify(message));
        this.sessionManager.updateActivity(connectionId);
      } catch (error) {
        this.errorHandler.handleParseError(
          connectionId,
          data instanceof Buffer ? data.toString() : String(data),
          error as Error,
        );
      }
    });

    // Error handler
    ws.on('error', (error) => {
      this.errorHandler.handleConnectionError(connectionId, error).catch((err) => {
        this.logger.error('Failed to handle connection error', err);
      });

      this.eventEmitter.emitConnectionEvent(WebSocketEventType.CONNECTION_ERROR, {
        connectionId,
        timestamp: new Date().toISOString(),
        metadata: { error: error.message },
      });
    });

    // Close handler
    ws.on('close', (code, reason) => {
      this.errorHandler.handleConnectionClose(
        connection,
        code,
        reason.toString(),
      );

      this.eventEmitter.emitConnectionEvent(WebSocketEventType.CONNECTION_CLOSE, {
        connectionId,
        timestamp: new Date().toISOString(),
        metadata: { code, reason: reason.toString() },
      });

      this.cleanupConnection(connectionId);
    });

    // Ping/pong for keep-alive
    ws.on('pong', () => {
      this.logger.debug('Received pong', { connectionId });
      this.sessionManager.updateActivity(connectionId);
    });
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): MCPWebSocketConnection | undefined {
    return this.activeConnections.get(connectionId);
  }

  /**
   * Clean up connection
   */
  cleanupConnection(connectionId: string): void {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return;
    }

    // Clean up pending requests
    this.errorHandler.cleanupPendingRequests(
      connection.pendingRequests,
      new AppError('Connection closed', 503),
    );

    // Clean up subscriptions
    for (const [subscriptionId] of connection.subscriptions) {
      this.cleanupSubscription(connection, subscriptionId);
    }

    // Close WebSocket if still open
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.close();
    }

    // Remove from active connections
    this.activeConnections.delete(connectionId);

    // Remove session
    this.sessionManager.removeSession(connectionId);

    this.logger.info('Connection cleaned up', {
      connectionId,
      totalConnections: this.activeConnections.size,
    });
  }

  /**
   * Clean up subscription
   */
  private cleanupSubscription(
    connection: MCPWebSocketConnection,
    subscriptionId: string,
  ): void {
    const subscription = connection.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    // Remove from connection
    connection.subscriptions.delete(subscriptionId);

    // Remove from session manager
    this.sessionManager.removeSubscription(connection.connectionId, subscriptionId);

    this.logger.debug('Subscription cleaned up', {
      connectionId: connection.connectionId,
      subscriptionId,
      topic: subscription.topic,
    });
  }

  /**
   * Get active connection count
   */
  getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }

  /**
   * Get connection stats
   */
  getConnectionStats(): {
    activeConnections: number;
    totalPendingRequests: number;
    totalSubscriptions: number;
  } {
    let totalPendingRequests = 0;
    let totalSubscriptions = 0;

    for (const connection of this.activeConnections.values()) {
      totalPendingRequests += connection.pendingRequests.size;
      totalSubscriptions += connection.subscriptions.size;
    }

    return {
      activeConnections: this.activeConnections.size,
      totalPendingRequests,
      totalSubscriptions,
    };
  }

  /**
   * Clean up all connections
   */
  cleanup(): void {
    this.logger.info('Cleaning up all connections', {
      count: this.activeConnections.size,
    });

    for (const connectionId of this.activeConnections.keys()) {
      this.cleanupConnection(connectionId);
    }
  }
}