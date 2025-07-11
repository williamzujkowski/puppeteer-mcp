/**
 * WebSocket server health monitoring - Backward compatibility wrapper
 * @module ws/websocket/health-monitor
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 * @deprecated Use imports from ./health/index.js instead
 */

import type { pino } from 'pino';
import { HealthMonitorCoordinator } from './health/index.js';
import type {
  HealthCheckContext,
  HealthCheckResult,
  HealthMonitorOptions,
  WSComponentDependencies,
} from './health/types.js';
import type { ConnectionManager } from './connection-manager.js';
import type { SecurityManager } from './security-manager.js';
import type { EventHandler } from './event-handler.js';

// Re-export types for backward compatibility
export type { HealthMetrics, HealthCheckResult } from './health/types.js';
export { HealthStatus } from './health/types.js';

/**
 * Legacy HealthMonitor class - wraps the new modular implementation
 * @deprecated Use HealthMonitorCoordinator from ./health/index.js
 * @nist au-3 "Content of audit records"
 */
export class HealthMonitor {
  private coordinator: HealthMonitorCoordinator;
  private logger: pino.Logger;
  private context?: HealthCheckContext;

  constructor(dependencies: WSComponentDependencies, options: HealthMonitorOptions = {}) {
    this.logger = dependencies.logger;
    this.coordinator = new HealthMonitorCoordinator(dependencies, options);
  }

  /**
   * Start health monitoring
   * @nist au-3 "Content of audit records"
   */
  start(
    connectionManager: ConnectionManager,
    securityManager: SecurityManager,
    eventHandler: EventHandler,
  ): void {
    this.context = {
      connectionManager,
      securityManager,
      eventHandler,
      logger: this.logger,
    };

    this.coordinator.start(this.context);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    this.coordinator.stop();
  }

  /**
   * Get current health status
   * @nist au-3 "Content of audit records"
   */
  getHealthStatus(
    connectionManager: ConnectionManager,
    securityManager: SecurityManager,
    eventHandler: EventHandler,
  ): HealthCheckResult {
    const context: HealthCheckContext = {
      connectionManager,
      securityManager,
      eventHandler,
      logger: this.logger,
    };

    // Synchronous wrapper for backward compatibility
    // Uses cached result from periodic health checks
    let result: HealthCheckResult | null = null;

    // Execute health check and store result
    void this.coordinator.getHealthStatus(context).then((r) => {
      result = r;
    });

    // Return cached or default result
    return (
      result ?? {
        status: 'unknown' as any,
        message: 'Health check in progress',
        metrics: {
          uptime: 0,
          totalConnections: 0,
          activeConnections: 0,
          authenticatedConnections: 0,
          totalSubscriptions: 0,
          messagesProcessed: 0,
          errorsCount: 0,
          memoryUsage: process.memoryUsage(),
          averageResponseTime: 0,
          connectionTurnover: { connected: 0, disconnected: 0, period: 1 },
        },
        issues: [],
        recommendations: [],
      }
    );
  }

  /**
   * Record message processing
   */
  recordMessageProcessed(responseTime?: number): void {
    this.coordinator.recordMessageProcessed(responseTime);
  }

  /**
   * Record error occurrence
   */
  recordError(error: Error | string): void {
    this.coordinator.recordError(error);
  }

  /**
   * Record connection event
   */
  recordConnection(type: 'connected' | 'disconnected'): void {
    this.coordinator.recordConnection(type);
  }
}
