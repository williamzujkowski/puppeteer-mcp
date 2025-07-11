/**
 * WebSocket server setup and management
 * @module server/websocket-server
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { Logger } from 'pino';
import { createWebSocketServer, WSServer } from '../ws/server.js';
import { SessionStore } from '../store/session-store.interface.js';
import { ServerInstance, ServerConfig } from './types.js';

/**
 * Initialize WebSocket server
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export function createWebSocketServerInstance(
  logger: Logger,
  sessionStore: SessionStore,
  httpServer: ServerInstance,
): WSServer {
  return createWebSocketServer(logger, sessionStore, httpServer);
}

/**
 * Start WebSocket server (automatically starts when HTTP server is listening)
 */
export function startWebSocketServer(
  logger: Logger,
  sessionStore: SessionStore,
  httpServer: ServerInstance,
  serverConfig: ServerConfig,
): WSServer {
  const wsServer = createWebSocketServerInstance(logger, sessionStore, httpServer);
  logger.info(`WebSocket endpoint: ${serverConfig.wsPath}`);
  return wsServer;
}

/**
 * Stop WebSocket server gracefully
 */
export async function stopWebSocketServer(wsServer: WSServer, logger: Logger): Promise<void> {
  await wsServer.shutdown();
  logger.info('WebSocket server shut down');
}
