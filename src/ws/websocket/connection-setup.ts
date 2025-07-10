/**
 * WebSocket connection setup and lifecycle
 * @module ws/websocket/connection-setup
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { pino } from 'pino';
import { handleIncomingMessage, handleConnectionClose } from './connection-handlers.js';
import {
  createConnectionState,
  createConnectionAckMessage,
  logConnectionEstablished,
  type ServerComponents,
} from './server-initialization.js';

/**
 * Connection setup dependencies
 */
export interface ConnectionSetupDependencies extends ServerComponents {
  logger: pino.Logger;
  emit: (event: string, ...args: unknown[]) => boolean;
}

/**
 * Handle new WebSocket connection setup
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export async function handleConnectionSetup(
  ws: WebSocket,
  req: {
    headers: Record<string, string | string[] | undefined>;
    socket: { remoteAddress?: string };
  },
  deps: ConnectionSetupDependencies,
  isShuttingDown: boolean,
): Promise<void> {
  if (isShuttingDown) {
    ws.close(1001, 'Server shutting down');
    return;
  }

  const connectionId = uuidv4();
  const clientIp = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress;

  try {
    // Create connection state
    const connectionState = createConnectionState(connectionId, clientIp, req.headers['user-agent']);

    // Add connection to manager
    deps.connectionManager.addConnection(connectionId, ws, connectionState);

    // Record connection in health monitor
    deps.healthMonitor.recordConnection('connected');

    // Set up connection-specific handlers
    setupConnectionHandlers(ws, connectionId, deps);

    // Send connection acknowledgment
    sendMessage(ws, createConnectionAckMessage(connectionId));

    // Log successful connection
    await logConnectionEstablished(connectionId, clientIp);

    deps.logger.info('WebSocket connection established', { connectionId, clientIp });

    // Emit connection event
    deps.emit('connection', connectionId, connectionState);
  } catch (error) {
    deps.logger.error('Error handling WebSocket connection', {
      connectionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    await deps.errorHandler.handleConnectionError(
      error instanceof Error ? error : new Error('Unknown connection error'),
      connectionId,
      deps.connectionManager,
      deps.healthMonitor,
    );

    ws.close(1011, 'Connection setup failed');
  }
}

/**
 * Setup handlers for individual WebSocket connection
 */
function setupConnectionHandlers(
  ws: WebSocket,
  connectionId: string,
  deps: ConnectionSetupDependencies,
): void {
  // Handle incoming messages
  ws.on('message', (data: Buffer) => {
    void handleIncomingMessage(ws, connectionId, data, deps);
  });

  // Handle pong responses
  ws.on('pong', () => {
    deps.connectionManager.updateLastActivity(connectionId);
  });

  // Handle connection close
  ws.on('close', (code, reason) => {
    void handleConnectionClose(connectionId, code, reason, deps).then(() => {
      deps.emit('disconnect', connectionId);
    });
  });

  // Handle connection errors
  ws.on('error', (error) => {
    void deps.errorHandler.handleConnectionError(
      error,
      connectionId,
      deps.connectionManager,
      deps.healthMonitor,
    );
  });
}

/**
 * Send message to WebSocket client
 */
function sendMessage(ws: WebSocket, message: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      // Error handling is done by the connection error handler
    }
  }
}