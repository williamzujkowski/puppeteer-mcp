/**
 * Health checks and server monitoring
 * @module server/health-monitor
 * @nist si-4 "Information system monitoring"
 */

import { Logger } from 'pino';
import { BrowserPool } from '../puppeteer/pool/browser-pool.js';
import { SessionStore } from '../store/session-store.interface.js';
import { HealthCheckStatus, ServerComponents } from './types.js';

/**
 * Check browser pool health
 */
async function checkBrowserPoolHealth(browserPool: BrowserPool): Promise<{
  status: 'up' | 'down' | 'warning';
  message?: string;
}> {
  try {
    const stats = await browserPool.getMetrics();

    if (stats.activeBrowsers === 0 && stats.idleBrowsers === 0) {
      return {
        status: 'warning',
        message: 'No browsers available in pool',
      };
    }

    if (stats.utilizationPercentage > 90) {
      return {
        status: 'warning',
        message: 'Browser pool utilization > 90%',
      };
    }

    return { status: 'up' };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check session store health
 */
async function checkSessionStoreHealth(sessionStore: SessionStore): Promise<{
  status: 'up' | 'down' | 'warning';
  message?: string;
}> {
  try {
    // Simple health check - try to call a basic method
    if ('list' in sessionStore && typeof sessionStore.list === 'function') {
      await sessionStore.list();
    }
    return { status: 'up' };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check HTTP server health
 */
function checkHttpServerHealth(components: ServerComponents): {
  status: 'up' | 'down' | 'warning';
  message?: string;
} {
  try {
    if (!components.server.listening) {
      return {
        status: 'down',
        message: 'HTTP server not listening',
      };
    }
    return { status: 'up' };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check gRPC server health
 */
async function checkGrpcServerHealth(components: ServerComponents): Promise<{
  status: 'up' | 'down' | 'warning';
  message?: string;
}> {
  try {
    // Simple health check for gRPC server
    if (components.grpcServer !== undefined && 'isRunning' in components.grpcServer) {
      const isRunning = await (
        components.grpcServer as { isRunning: () => Promise<boolean> }
      ).isRunning();
      return isRunning ? { status: 'up' } : { status: 'down', message: 'gRPC server not running' };
    }
    return { status: 'up' };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check WebSocket server health
 */
function checkWebSocketServerHealth(components: ServerComponents): {
  status: 'up' | 'down' | 'warning';
  message?: string;
} {
  try {
    if (!components.wsServer) {
      return {
        status: 'warning',
        message: 'WebSocket server not initialized',
      };
    }
    return { status: 'up' };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(
  components: ServerComponents,
  browserPool: BrowserPool,
  sessionStore: SessionStore,
  logger: Logger,
): Promise<HealthCheckStatus> {
  const startTime = Date.now();

  try {
    // Run all health checks in parallel
    const [
      browserPoolHealth,
      sessionStoreHealth,
      httpServerHealth,
      grpcServerHealth,
      wsServerHealth,
    ] = await Promise.all([
      checkBrowserPoolHealth(browserPool),
      checkSessionStoreHealth(sessionStore),
      Promise.resolve(checkHttpServerHealth(components)),
      checkGrpcServerHealth(components),
      Promise.resolve(checkWebSocketServerHealth(components)),
    ]);

    const services = {
      'browser-pool': {
        ...browserPoolHealth,
        timestamp: new Date().toISOString(),
      },
      'session-store': {
        ...sessionStoreHealth,
        timestamp: new Date().toISOString(),
      },
      'http-server': {
        ...httpServerHealth,
        timestamp: new Date().toISOString(),
      },
      'grpc-server': {
        ...grpcServerHealth,
        timestamp: new Date().toISOString(),
      },
      'websocket-server': {
        ...wsServerHealth,
        timestamp: new Date().toISOString(),
      },
    };

    // Determine overall status
    const serviceStatuses = Object.values(services).map((s) => s.status);
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';

    if (serviceStatuses.every((status) => status === 'up')) {
      overallStatus = 'healthy';
    } else if (serviceStatuses.some((status) => status === 'down')) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    const uptime = process.uptime();

    logger.debug(
      {
        healthCheck: {
          status: overallStatus,
          duration: Date.now() - startTime,
          uptime,
        },
      },
      'Health check completed',
    );

    return {
      status: overallStatus,
      services,
      uptime,
      version: '1.0.14',
    };
  } catch (error) {
    logger.error({ error }, 'Health check failed');

    return {
      status: 'unhealthy',
      services: {
        'health-check': {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      },
      uptime: process.uptime(),
      version: '1.0.14',
    };
  }
}

/**
 * Health monitoring configuration
 */
interface HealthMonitoringConfig {
  components: ServerComponents;
  browserPool: BrowserPool;
  sessionStore: SessionStore;
  logger: Logger;
  intervalMs?: number;
}

/**
 * Start periodic health monitoring
 */
export function startHealthMonitoring(config: HealthMonitoringConfig): NodeJS.Timeout {
  const { components, browserPool, sessionStore, logger, intervalMs = 60000 } = config;
  const interval = setInterval(() => {
    void (async () => {
      try {
        const healthStatus = await performHealthCheck(
          components,
          browserPool,
          sessionStore,
          logger,
        );

        if (healthStatus.status === 'unhealthy') {
          logger.warn({ healthStatus }, 'System health check indicates unhealthy status');
        } else if (healthStatus.status === 'degraded') {
          logger.warn({ healthStatus }, 'System health check indicates degraded status');
        }
      } catch (error) {
        logger.error({ error }, 'Error during periodic health check');
      }
    })();
  }, intervalMs);

  logger.info(`Health monitoring started with ${intervalMs}ms interval`);
  return interval;
}

/**
 * Stop health monitoring
 */
export function stopHealthMonitoring(interval: NodeJS.Timeout, logger: Logger): void {
  clearInterval(interval);
  logger.info('Health monitoring stopped');
}
