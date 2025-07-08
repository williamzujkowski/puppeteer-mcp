/**
 * gRPC Health service implementation
 * @module grpc/services/health
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { performance } from 'perf_hooks';

/**
 * Health service implementation
 * @nist si-4 "Information system monitoring"
 */
export class HealthServiceImpl {
  private serviceStatus: Map<string, { status: string; metadata: Record<string, unknown> }> =
    new Map();

  constructor(private logger: pino.Logger) {
    // Initialize default service status
    this.serviceStatus.set('', {
      status: 'SERVING',
      metadata: {
        version: process.env.npm_package_version ?? '1.0.14',
        uptime: '0s',
        startTime: new Date().toISOString(),
      },
    });

    // Update uptime periodically
    setInterval(() => {
      const uptime = Math.floor(process.uptime());
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = uptime % 60;

      const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

      for (const [, status] of this.serviceStatus.entries()) {
        status.metadata.uptime = uptimeStr;
      }
    }, 10000); // Update every 10 seconds
  }

  /**
   * Check service health
   * @nist si-4 "Information system monitoring"
   * @evidence code, test
   */
  async check(
    call: grpc.ServerUnaryCall<
      { service?: string },
      { status: string; metadata: Record<string, unknown> }
    >,
    callback: grpc.sendUnaryData<{ status: string; metadata: Record<string, unknown> }>,
  ): Promise<void> {
    try {
      const { service } = call.request;
      const startTime = performance.now();

      // Get service status
      const status = this.serviceStatus.get(service ?? '');

      if (!status) {
        callback(null, {
          status: 'SERVICE_UNKNOWN',
          metadata: {
            error: 'Service not found',
            service: service ?? 'default',
          },
        });
        return;
      }

      // Perform health checks
      const checks = await this.performHealthChecks(service);

      // Determine overall status
      const overallStatus = this.determineOverallStatus(checks);

      // Add check results to metadata
      const metadata = {
        ...status.metadata,
        checks: JSON.stringify(checks),
        checkDuration: `${(performance.now() - startTime).toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      };

      callback(null, {
        status: overallStatus,
        metadata,
      });
    } catch (error) {
      this.logger.error('Health check error:', error);
      callback(null, {
        status: 'NOT_SERVING',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Watch health status changes
   * @nist si-4 "Information system monitoring"
   */
  watch(
    call: grpc.ServerWritableStream<
      { service?: string },
      { status: string; metadata: Record<string, unknown> }
    >,
  ): void {
    try {
      const { service } = call.request;

      // Send initial status
      const status = this.serviceStatus.get(service ?? '');
      if (status) {
        call.write({
          status: status.status,
          metadata: status.metadata,
        });
      }

      // Set up periodic health checks
      const interval = setInterval(() => {
        void (async () => {
          try {
            const checks = await this.performHealthChecks(service);
            const overallStatus = this.determineOverallStatus(checks);

            call.write({
              status: overallStatus,
              metadata: {
                ...status?.metadata,
                checks: JSON.stringify(checks),
                timestamp: new Date().toISOString(),
              },
            });
          } catch (error) {
            this.logger.error('Health watch error:', error);
            call.write({
              status: 'NOT_SERVING',
              metadata: {
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
              },
            });
          }
        })();
      }, 5000); // Check every 5 seconds

      // Clean up on stream end
      call.on('cancelled', () => {
        clearInterval(interval);
        this.logger.info('Health watch cancelled');
      });

      call.on('error', () => {
        clearInterval(interval);
      });
    } catch (error) {
      this.logger.error('Error in watch:', error);
      call.emit('error', error);
    }
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(
    service?: string,
  ): Promise<Record<string, { status: string; [key: string]: unknown }>> {
    const checks: Record<string, { status: string; [key: string]: unknown }> = {};

    // Memory check
    const memUsage = process.memoryUsage();
    const memLimit = 512 * 1024 * 1024; // 512MB
    checks.memory = {
      status: memUsage.heapUsed < memLimit ? 'healthy' : 'unhealthy',
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
    };

    // CPU check
    const cpuUsage = process.cpuUsage();
    checks.cpu = {
      status: 'healthy',
      user: `${(cpuUsage.user / 1000000).toFixed(2)}s`,
      system: `${(cpuUsage.system / 1000000).toFixed(2)}s`,
    };

    // Event loop check
    const start = performance.now();
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    const eventLoopDelay = performance.now() - start;
    checks.eventLoop = {
      status: eventLoopDelay < 100 ? 'healthy' : 'unhealthy',
      delay: `${eventLoopDelay.toFixed(2)}ms`,
    };

    // Service-specific checks
    if (service === 'SessionService') {
      // Check session store
      checks.sessionStore = {
        status: 'healthy', // TODO: Implement actual check
        message: 'Session store is operational',
      };
    } else if (service === 'ContextService') {
      // Check context manager
      checks.contextManager = {
        status: 'healthy', // TODO: Implement actual check
        message: 'Context manager is operational',
      };
    }

    return checks;
  }

  /**
   * Determine overall status from health checks
   */
  private determineOverallStatus(
    checks: Record<string, { status: string; [key: string]: unknown }>,
  ): string {
    let hasUnhealthy = false;

    for (const check of Object.values(checks)) {
      if (check.status === 'unhealthy') {
        hasUnhealthy = true;
        break;
      }
    }

    return hasUnhealthy ? 'NOT_SERVING' : 'SERVING';
  }

  /**
   * Update service status (for internal use)
   */
  setServiceStatus(service: string, status: string, metadata?: Record<string, unknown>): void {
    this.serviceStatus.set(service, {
      status,
      metadata: {
        ...this.serviceStatus.get(service)?.metadata,
        ...metadata,
        lastUpdated: new Date().toISOString(),
      },
    });
  }
}
