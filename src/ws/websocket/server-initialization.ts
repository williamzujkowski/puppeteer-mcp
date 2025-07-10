/**
 * WebSocket server initialization helpers
 * @module ws/websocket/server-initialization
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { WSConnectionState, WSMessage } from '../../types/websocket.js';
import { WSMessageType } from '../../types/websocket.js';
import { config } from '../../core/config.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';

// Import component classes
import { ConnectionManager } from './connection-manager.js';
import { AuthenticationHandler } from './authentication-handler.js';
import { MessageRouter } from './message-router.js';
import { EventHandler } from './event-handler.js';
import { SecurityManager } from './security-manager.js';
import { HealthMonitor } from './health-monitor.js';
import { SessionManager } from './session-manager.js';
import { MiddlewarePipeline } from './middleware-pipeline.js';
import { ErrorHandler } from './error-handler.js';

import type { WSServerOptions, WSComponentDependencies } from './types.js';

/**
 * Component collection
 */
export interface ServerComponents {
  connectionManager: ConnectionManager;
  authHandler: AuthenticationHandler;
  messageRouter: MessageRouter;
  eventHandler: EventHandler;
  securityManager: SecurityManager;
  healthMonitor: HealthMonitor;
  sessionManager: SessionManager;
  middlewarePipeline: MiddlewarePipeline;
  errorHandler: ErrorHandler;
}

/**
 * Initialize all WebSocket server components
 */
export function initializeComponents(dependencies: WSComponentDependencies): ServerComponents {
  return {
    connectionManager: new ConnectionManager(dependencies),
    authHandler: new AuthenticationHandler(dependencies),
    messageRouter: new MessageRouter(dependencies),
    eventHandler: new EventHandler(dependencies),
    securityManager: new SecurityManager(dependencies),
    healthMonitor: new HealthMonitor(dependencies),
    sessionManager: new SessionManager(dependencies),
    middlewarePipeline: new MiddlewarePipeline(dependencies),
    errorHandler: new ErrorHandler(dependencies),
  };
}

/**
 * Initialize WebSocket server instance
 */
export function initializeWebSocketServer(
  options: WSServerOptions,
  securityManager: SecurityManager,
): WebSocketServer {
  try {
    return new WebSocketServer({
      server: options.server,
      path: options.path ?? config.WS_PATH ?? '/ws',
      maxPayload: options.maxPayload ?? config.WS_MAX_PAYLOAD ?? 1024 * 1024, // 1MB
      perMessageDeflate: true,
      clientTracking: true,
      verifyClient: (info, callback) => {
        securityManager.verifyClient(info, callback);
      },
    });
  } catch (error) {
    throw new Error(
      `WebSocket server initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Create initial connection state
 */
export function createConnectionState(
  connectionId: string,
  clientIp: string | string[] | undefined,
  userAgent: string | string[] | undefined,
): WSConnectionState {
  return {
    id: connectionId,
    authenticated: false,
    subscriptions: new Set(),
    lastActivity: new Date(),
    connectedAt: new Date(),
    remoteAddress: typeof clientIp === 'string' ? clientIp : undefined,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    metadata: {
      clientIp,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
      connectedAt: new Date().toISOString(),
    },
  };
}

/**
 * Create connection acknowledgment message
 */
export function createConnectionAckMessage(connectionId: string): WSMessage {
  return {
    type: WSMessageType.EVENT,
    event: 'connection_established',
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    data: {
      connectionId,
      heartbeatInterval: config.WS_HEARTBEAT_INTERVAL ?? 30000,
    },
  };
}

/**
 * Log successful connection establishment
 */
export async function logConnectionEstablished(
  connectionId: string,
  clientIp: string | string[] | undefined,
): Promise<void> {
  await logSecurityEvent(SecurityEventType.CONNECTION_ESTABLISHED, {
    resource: 'websocket',
    action: 'connect',
    result: 'success',
    metadata: {
      connectionId,
      clientIp,
    },
  });
}