/**
 * WebSocket server implementation
 * @module ws/server
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

/* eslint-disable max-lines */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import type { SessionStore } from '../store/session-store.interface.js';
import { WSConnectionManager } from './connection-manager.js';
import { WSMessageHandler } from './message-handler.js';
import { WSAuthHandler } from './auth-handler.js';
import { config } from '../core/config.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { WSMessage, WSConnectionState, WSMessageType } from '../types/websocket.js';
import { WebSocketRateLimitPresets } from './rate-limiter.js';

/**
 * WebSocket server options
 */
export interface WSServerOptions {
  server: HttpServer;
  path?: string;
  maxPayload?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

/**
 * WebSocket server implementation
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-3 "Access enforcement"
 */
export class WSServer extends EventEmitter {
  private wss: WebSocketServer;
  private logger: pino.Logger;
  private connectionManager: WSConnectionManager;
  private messageHandler: WSMessageHandler;
  private authHandler: WSAuthHandler;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private rateLimiter = WebSocketRateLimitPresets.standard;

  constructor(logger: pino.Logger, sessionStore: SessionStore, options: WSServerOptions) {
    super();
    this.logger = logger.child({ module: 'ws-server' });

    // Initialize WebSocket server
    try {
      this.wss = new WebSocketServer({
        server: options.server,
        path: options.path ?? config.WS_PATH ?? '/ws',
        maxPayload: options.maxPayload ?? config.WS_MAX_PAYLOAD ?? 1024 * 1024, // 1MB
        perMessageDeflate: true,
        clientTracking: true,
        verifyClient: this.verifyClient.bind(this),
      });
    } catch (error) {
      this.logger.error({ error }, 'Failed to create WebSocket server');
      throw new Error(
        `WebSocket server initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Initialize handlers
    this.connectionManager = new WSConnectionManager(logger);
    this.authHandler = new WSAuthHandler(logger, sessionStore);
    this.messageHandler = new WSMessageHandler(
      logger,
      sessionStore,
      this.connectionManager,
      this.authHandler,
    );

    // Set up server event handlers
    this.setupServerHandlers();

    // Start heartbeat mechanism
    this.startHeartbeat(options.heartbeatInterval ?? config.WS_HEARTBEAT_INTERVAL ?? 30000);
  }

  /**
   * Verify client connection
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private verifyClient(
    info: {
      origin: string;
      secure: boolean;
      req: {
        headers: Record<string, string | string[] | undefined>;
        socket: { remoteAddress?: string };
      };
    },
    cb: (result: boolean, code?: number, message?: string) => void,
  ): void {
    try {
      const clientIp = Array.isArray(info.req.headers['x-forwarded-for']) 
        ? info.req.headers['x-forwarded-for'][0] 
        : info.req.headers['x-forwarded-for'] ?? info.req.socket.remoteAddress;

      // Log connection attempt
      void logSecurityEvent(SecurityEventType.CONNECTION_ATTEMPT, {
        resource: 'websocket',
        action: 'connect',
        result: 'success',
        metadata: {
          clientIp,
          origin: info.origin,
          secure: info.secure,
          userAgent: info.req.headers['user-agent'],
        },
      });

      // Check origin if configured
      const wsAllowedOrigins = config.ALLOWED_ORIGINS;
      if (wsAllowedOrigins !== undefined && wsAllowedOrigins.length > 0) {
        const allowedOrigins: string[] = Array.isArray(wsAllowedOrigins) 
          ? wsAllowedOrigins 
          : String(wsAllowedOrigins).split(',').map((origin: string) => origin.trim());
        if (Boolean(!allowedOrigins.includes('*')) && Boolean(!allowedOrigins.includes(info.origin))) {
          this.logger.warn('WebSocket connection rejected - invalid origin', {
            origin: info.origin,
            allowedOrigins,
          });
          cb(false, 403, 'Forbidden origin');
          return;
        }
      }

      // Connection allowed
      cb(true);
    } catch (error) {
      this.logger.error('Error in verifyClient:', error);
      cb(false, 500, 'Internal server error');
      return;
    }
  }

  /**
   * Set up WebSocket server event handlers
   */
  private setupServerHandlers(): void {
    this.wss.on('connection', (ws, req) => {
      void this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
      this.emit('error', error);
    });

    this.wss.on('close', () => {
      this.logger.info('WebSocket server closed');
      this.emit('close');
    });
  }

  /**
   * Handle new WebSocket connection
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async handleConnection(
    ws: WebSocket,
    req: {
      headers: Record<string, string | string[] | undefined>;
      socket: { remoteAddress?: string };
    },
  ): Promise<void> {
    const connectionId = uuidv4();
    const clientIp = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress;

    // Check rate limit for new connections
    const rateLimitKey = this.rateLimiter.extractKey(ws, req);
    const connectionAllowed = await this.rateLimiter.checkConnection(rateLimitKey);

    if (!connectionAllowed) {
      this.logger.warn(
        { connectionId, clientIp, rateLimitKey },
        'WebSocket connection rate limit exceeded',
      );
      ws.close(1008, 'Too many connections');
      return;
    }

    // Create connection state
    const connectionState: WSConnectionState = {
      id: connectionId,
      authenticated: false,
      subscriptions: new Set(),
      lastActivity: new Date(),
      connectedAt: new Date(),
      remoteAddress: typeof clientIp === 'string' ? clientIp : undefined,
      userAgent: Array.isArray(req.headers['user-agent']) 
        ? req.headers['user-agent'][0] 
        : req.headers['user-agent'],
      metadata: {
        clientIp,
        userAgent: Array.isArray(req.headers['user-agent']) 
          ? req.headers['user-agent'][0] 
          : req.headers['user-agent'],
        connectedAt: new Date().toISOString(),
      },
    };

    // Store connection
    this.connectionManager.addConnection(connectionId, ws, connectionState);

    // Log successful connection
    await logSecurityEvent(SecurityEventType.CONNECTION_ESTABLISHED, {
      resource: 'websocket',
      action: 'connect',
      result: 'success',
      metadata: {
        connectionId,
        clientIp,
      },
    });

    this.logger.info('WebSocket connection established', {
      connectionId,
      clientIp,
    });

    // Set up connection handlers
    this.setupConnectionHandlers(ws, connectionId, rateLimitKey);

    // Send connection acknowledgment
    this.sendMessage(ws, {
      type: WSMessageType.EVENT,
      event: 'connection_established',
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      data: {
        connectionId,
        heartbeatInterval: config.WS_HEARTBEAT_INTERVAL ?? 30000,
      },
    });

    // Emit connection event
    this.emit('connection', connectionId, connectionState);
  }

  /**
   * Set up handlers for individual WebSocket connection
   */
  private setupConnectionHandlers(ws: WebSocket, connectionId: string, rateLimitKey: string): void {
    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      void (async () => {
        try {
          // Check message rate limit
          const messageAllowed = await this.rateLimiter.checkMessage(rateLimitKey);
          if (!messageAllowed) {
            this.logger.warn(
              { connectionId, rateLimitKey },
              'WebSocket message rate limit exceeded',
            );
            this.sendMessage(ws, {
              type: WSMessageType.ERROR,
              id: uuidv4(),
              timestamp: new Date().toISOString(),
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many messages, please slow down',
              },
            });
            return;
          }

          // Update last activity
          const state = this.connectionManager.getConnectionState(connectionId);
          if (state) {
            state.lastActivity = new Date();
          }

          // Parse and handle message
          const message = JSON.parse(data.toString()) as WSMessage;
          this.messageHandler.handleMessage(ws, connectionId, message);
        } catch (error) {
          this.logger.error('Error handling WebSocket message:', error);

          // Send error response
          this.sendMessage(ws, {
            type: WSMessageType.ERROR,
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            error: {
              code: 'MESSAGE_ERROR',
              message: error instanceof Error ? error.message : 'Failed to process message',
            },
          });
        }
      })();
    });

    // Handle ping/pong for heartbeat
    ws.on('pong', () => {
      const state = this.connectionManager.getConnectionState(connectionId);
      if (state) {
        state.lastActivity = new Date();
      }
    });

    // Handle connection close
    ws.on('close', (code, reason) => {
      void (async () => {
        this.logger.info('WebSocket connection closed', {
          connectionId,
          code,
          reason: reason.toString(),
        });

        // Decrement connection count for rate limiting
        await this.rateLimiter.onConnectionClose(rateLimitKey);

        // Log disconnection
        await logSecurityEvent(SecurityEventType.CONNECTION_CLOSED, {
          resource: 'websocket',
          action: 'disconnect',
          result: 'success',
          metadata: {
            connectionId,
            code,
            reason: reason.toString(),
          },
        });

        // Clean up connection
        this.connectionManager.removeConnection(connectionId);

        // Emit disconnection event
        this.emit('disconnect', connectionId);
      })();
    });

    // Handle errors
    ws.on('error', (error) => {
      this.logger.error('WebSocket connection error:', {
        connectionId,
        error: error.message,
      });

      // Clean up connection
      this.connectionManager.removeConnection(connectionId);
    });
  }

  /**
   * Start heartbeat mechanism
   * @nist au-3 "Content of audit records"
   */
  private startHeartbeat(interval: number): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = interval * 2; // Allow one missed heartbeat

      this.connectionManager.getAllConnections().forEach(({ connectionId, ws, state }) => {
        const lastActivity = state.lastActivity.getTime();

        if (now - lastActivity > timeout) {
          // Connection timed out
          this.logger.warn('WebSocket connection timed out', { connectionId });
          ws.terminate();
          this.connectionManager.removeConnection(connectionId);
        } else if (ws.readyState === WebSocket.OPEN) {
          // Send ping
          ws.ping();
        }
      });
    }, interval);
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all authenticated clients
   * @nist ac-3 "Access enforcement"
   */
  broadcast(message: WSMessage, filter?: (state: WSConnectionState) => boolean): void {
    this.connectionManager.getAllConnections().forEach(({ ws, state }) => {
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
    this.connectionManager.getAllConnections().forEach(({ ws, state }) => {
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
    this.connectionManager.getConnectionsBySession(sessionId).forEach(({ ws }) => {
      this.sendMessage(ws, message);
    });
  }

  /**
   * Get server statistics
   */
  getStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    unauthenticatedConnections: number;
    subscriptions: number;
  } {
    const connections = this.connectionManager.getAllConnections();
    const authenticated = connections.filter(({ state }) => state.authenticated).length;

    return {
      totalConnections: connections.length,
      authenticatedConnections: authenticated,
      unauthenticatedConnections: connections.length - authenticated,
      subscriptions: connections.reduce((sum, { state }) => sum + state.subscriptions.size, 0),
    };
  }

  /**
   * Gracefully shutdown WebSocket server
   * @nist cm-7 "Least functionality"
   */
  shutdown(): Promise<void> {
    this.logger.info('Shutting down WebSocket server...');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    this.connectionManager.getAllConnections().forEach(({ ws }) => {
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
}

/**
 * Create and initialize WebSocket server
 */
export function createWebSocketServer(
  logger: pino.Logger,
  sessionStore: SessionStore,
  server: HttpServer,
): WSServer {
  return new WSServer(logger, sessionStore, { server });
}
