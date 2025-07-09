/**
 * gRPC server setup and service registration
 * @module server/grpc-server
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { Logger } from 'pino';
import { createGrpcServer, GrpcServer } from '../grpc/server.js';
import { SessionStore } from '../store/session-store.interface.js';
import { ServerConfig } from './types.js';

/**
 * Initialize gRPC server with dependencies
 */
export function createGrpcServerInstance(
  logger: Logger,
  sessionStore: SessionStore
): GrpcServer {
  return createGrpcServer(logger, sessionStore);
}

/**
 * Start gRPC server
 */
export async function startGrpcServer(
  grpcServer: GrpcServer,
  serverConfig: ServerConfig,
  logger: Logger
): Promise<void> {
  await grpcServer.start(serverConfig.grpcPort, serverConfig.grpcHost);
  logger.info(`gRPC server started on ${serverConfig.grpcHost}:${serverConfig.grpcPort}`);
}

/**
 * Stop gRPC server gracefully
 */
export async function stopGrpcServer(grpcServer: GrpcServer, logger: Logger): Promise<void> {
  await grpcServer.shutdown();
  logger.info('gRPC server shut down');
}