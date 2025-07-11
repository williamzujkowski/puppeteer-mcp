/**
 * Graceful shutdown handling
 * @module server/graceful-shutdown
 * @nist cm-7 "Least functionality"
 */

import { Logger } from 'pino';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { stopHttpServer } from './http-server.js';
import { stopGrpcServer } from './grpc-server.js';
import { stopWebSocketServer } from './websocket-server.js';
import { shutdownAllServices } from './service-registry.js';
import { stopHealthMonitoring } from './health-monitor.js';
import { ServerComponents, ServerDependencies, ShutdownSignal } from './types.js';

// Graceful shutdown tracking
let isShuttingDown = false;
let shutdownTimeout: NodeJS.Timeout | undefined;
let healthMonitoringInterval: NodeJS.Timeout | undefined;

/**
 * Set health monitoring interval for cleanup
 */
export function setHealthMonitoringInterval(interval: NodeJS.Timeout): void {
  healthMonitoringInterval = interval;
}

/**
 * Graceful shutdown handler
 * @nist cm-7 "Least functionality"
 */
export async function gracefulShutdown(
  signal: ShutdownSignal,
  components: ServerComponents,
  dependencies: ServerDependencies,
): Promise<void> {
  if (isShuttingDown) {
    dependencies.logger.warn(`${signal} received during shutdown, ignoring`);
    return;
  }

  isShuttingDown = true;
  dependencies.logger.info(`${signal} received, starting graceful shutdown...`);

  try {
    // Log system shutdown
    await logSecurityEvent(SecurityEventType.SERVICE_STOP, {
      reason: signal,
      result: 'success',
    });

    // Set a timeout to force exit if graceful shutdown takes too long
    shutdownTimeout = setTimeout(() => {
      dependencies.logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000); // 30 seconds

    // Stop health monitoring
    if (healthMonitoringInterval) {
      stopHealthMonitoring(healthMonitoringInterval, dependencies.logger);
    }

    // Shutdown servers in reverse order of startup
    await shutdownServers(components, dependencies.logger);

    // Shutdown all services
    await shutdownAllServices(
      dependencies.browserPool,
      dependencies.sessionStore,
      dependencies.logger,
    );

    // Clear the timeout since we completed gracefully
    if (shutdownTimeout !== undefined) {
      clearTimeout(shutdownTimeout);
    }

    dependencies.logger.info('Graceful shutdown completed successfully');

    // Exit cleanly after a brief delay to allow logger to flush
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (error) {
    dependencies.logger.error({ error }, 'Error during graceful shutdown');

    // Log shutdown failure
    await logSecurityEvent(SecurityEventType.SERVICE_STOP, {
      reason: signal,
      result: 'failure',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    process.exit(1);
  }
}

/**
 * Shutdown all servers
 */
async function shutdownServers(components: ServerComponents, logger: Logger): Promise<void> {
  const shutdownPromises: Promise<void>[] = [];

  // Stop HTTP server
  shutdownPromises.push(stopHttpServer(components.server, logger));

  // Stop WebSocket server if running
  if (components.wsServer) {
    shutdownPromises.push(stopWebSocketServer(components.wsServer, logger));
  }

  // Stop gRPC server
  shutdownPromises.push(stopGrpcServer(components.grpcServer, logger));

  // Wait for all servers to shutdown
  await Promise.all(shutdownPromises);
}

/**
 * Setup process signal handlers for graceful shutdown
 */
export function setupProcessHandlers(
  components: ServerComponents,
  dependencies: ServerDependencies,
): void {
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM', components, dependencies));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT', components, dependencies));
  process.on('SIGHUP', () => void gracefulShutdown('SIGHUP', components, dependencies));
}

/**
 * Setup uncaught exception and unhandled rejection handlers
 */
export function setupErrorHandlers(logger: Logger): void {
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    void (async () => {
      try {
        await logSecurityEvent(SecurityEventType.ERROR, {
          reason: 'Uncaught exception',
          result: 'failure',
          metadata: {
            error: error.message,
            stack: error.stack,
          },
        });
      } catch {
        // Ignore errors in error handler
      }
      process.exit(1);
    })();
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled rejection');
    void (async () => {
      try {
        await logSecurityEvent(SecurityEventType.ERROR, {
          reason: 'Unhandled promise rejection',
          result: 'failure',
          metadata: {
            reason: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
          },
        });
      } catch {
        // Ignore errors in error handler
      }
      process.exit(1);
    })();
  });
}

/**
 * Setup all process handlers
 */
export function setupAllProcessHandlers(
  components: ServerComponents,
  dependencies: ServerDependencies,
): void {
  setupProcessHandlers(components, dependencies);
  setupErrorHandlers(dependencies.logger);
}
