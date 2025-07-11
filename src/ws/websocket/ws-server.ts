/**
 * Main WebSocket server class - Compact version
 * @module ws/websocket/ws-server
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type { pino } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';
import type { WSMessage } from '../../types/websocket.js';

// Import modular components
import { HealthMonitor } from './health-monitor.js';
import { SessionManager } from './session-manager.js';
import { ErrorHandler } from './error-handler.js';

import type {
  WSServerOptions,
  WSServerStats,
  MessageFilter,
  WSComponentDependencies,
} from './types.js';
import {
  initializeComponents,
  initializeWebSocketServer,
  type ServerComponents,
} from './server-initialization.js';
import { handleConnectionSetup } from './connection-setup.js';

/**
 * Main WebSocket server implementation
 * Integrates all modular components into a cohesive WebSocket server
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-3 "Access enforcement"
 */
export class WSServer extends EventEmitter {
  private wss: WebSocketServer;
  private logger: pino.Logger;
  private components: ServerComponents;
  private dependencies: WSComponentDependencies;
  private isShuttingDown = false;

  constructor(logger: pino.Logger, sessionStore: SessionStore, options: WSServerOptions) {
    super();

    this.logger = logger.child({ module: 'ws-server' });
    this.dependencies = { logger: this.logger, sessionStore };

    // Initialize components
    this.components = initializeComponents(this.dependencies);

    // Initialize WebSocket server
    this.wss = initializeWebSocketServer(options, this.components.securityManager);
    this.setupServerEventHandlers();

    // Start background services
    this.startBackgroundServices();
  }

  /**
   * Broadcast message to all authenticated clients
   * @nist ac-3 "Access enforcement"
   */
  broadcast(message: WSMessage, filter?: MessageFilter): void {
    this.components.connectionManager.getAllConnections().forEach(({ ws, state }) => {
      if (state.authenticated && (filter === undefined || filter(state))) {
        this.sendMessage(ws, message);
      }
    });
  }

  /**
   * Send message to specific user
   * @nist ac-3 "Access enforcement"
   */
  sendToUser(userId: string, message: WSMessage): void {
    this.components.connectionManager.getAllConnections().forEach(({ ws, state }) => {
      if (state.authenticated && state.userId === userId) {
        this.sendMessage(ws, message);
      }
    });
  }

  /**
   * Send message to specific session
   * @nist ac-3 "Access enforcement"
   */
  sendToSession(sessionId: string, message: WSMessage): void {
    this.components.connectionManager.getConnectionsBySession(sessionId).forEach(({ ws }) => {
      this.sendMessage(ws, message);
    });
  }

  /**
   * Broadcast event to topic subscribers
   * @nist ac-3 "Access enforcement"
   */
  async broadcastToTopic(topic: string, data: unknown, filter?: MessageFilter): Promise<number> {
    return this.components.eventHandler.broadcastToTopic(
      topic,
      data,
      this.components.connectionManager,
      filter,
    );
  }

  /**
   * Get server statistics
   */
  getStats(): WSServerStats {
    const connections = this.components.connectionManager.getAllConnections();
    const authenticated = connections.filter(({ state }) => state.authenticated).length;
    const subscriptionStats = this.components.eventHandler.getSubscriptionStats();

    return {
      totalConnections: connections.length,
      authenticatedConnections: authenticated,
      unauthenticatedConnections: connections.length - authenticated,
      subscriptions: subscriptionStats.totalSubscriptions,
    };
  }

  /**
   * Get detailed server health status
   */
  getHealthStatus(): ReturnType<HealthMonitor['getHealthStatus']> {
    return this.components.healthMonitor.getHealthStatus(
      this.components.connectionManager,
      this.components.securityManager,
      this.components.eventHandler,
    );
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ReturnType<ErrorHandler['getErrorStats']> {
    return this.components.errorHandler.getErrorStats();
  }

  /**
   * Get session statistics
   */
  getSessionStats(): ReturnType<SessionManager['getSessionStats']> {
    return this.components.sessionManager.getSessionStats();
  }

  /**
   * Add custom middleware to the pipeline
   */
  useMiddleware(
    name: string,
    middleware: (context: unknown, next: () => Promise<void>) => Promise<void>,
  ): void {
    this.components.middlewarePipeline.use(name, middleware);
  }

  /**
   * Gracefully shutdown WebSocket server
   * @nist cm-7 "Least functionality"
   */
  shutdown(): Promise<void> {
    this.logger.info('Shutting down WebSocket server...');
    this.isShuttingDown = true;

    // Stop background services
    this.components.healthMonitor.stop();
    this.components.sessionManager.stop();

    // Close all connections gracefully
    this.components.connectionManager.getAllConnections().forEach(({ ws }) => {
      ws.close(1001, 'Server shutting down');
    });

    // Close server
    return new Promise<void>((resolve) => {
      this.wss.close(() => {
        this.logger.info('WebSocket server shut down successfully');
        resolve();
      });

      // Force close after timeout
      setTimeout(() => {
        this.logger.warn('WebSocket server shutdown timeout, forcing close');
        resolve();
      }, 10000);
    });
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupServerEventHandlers(): void {
    this.wss.on('connection', (ws, req) => {
      const deps = { logger: this.logger, emit: this.emit.bind(this), ...this.components };
      void handleConnectionSetup(ws, req, deps, this.isShuttingDown);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
      void this.components.errorHandler.handleSystemError(error, 'websocket_server');
      this.emit('error', error);
    });

    this.wss.on('close', () => {
      this.logger.info('WebSocket server closed');
      this.emit('close');
    });
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        this.logger.error('Failed to send message', {
          error: error instanceof Error ? error.message : 'Unknown error',
          messageType: message.type,
          messageId: message.id,
        });
      }
    }
  }

  /**
   * Start background services
   */
  private startBackgroundServices(): void {
    this.components.healthMonitor.start(
      this.components.connectionManager,
      this.components.securityManager,
      this.components.eventHandler,
    );

    this.components.sessionManager.start();
  }
}
