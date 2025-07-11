/**
 * Health monitor coordinator
 * @module ws/websocket/health/health-monitor-coordinator
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 * @nist si-4 "System monitoring"
 * @nist ir-4 "Incident handling"
 */

import { WebSocket } from 'ws';
import type { pino } from 'pino';
import { config } from '../../../core/config.js';
import { logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';
import { MetricsCollector } from './metrics-collector.js';
import { StrategyManager } from './strategy-manager.js';
import { HealthEventManager } from './health-event-manager.js';
import { CleanupRecoveryAction, ConnectionLimitRecoveryAction } from './recovery/index.js';
import type {
  HealthCheckContext,
  HealthCheckResult,
  HealthMonitorOptions,
  WSComponentDependencies,
} from './types.js';
import { HealthStatus, HealthEventType } from './types.js';

/**
 * Coordinates all health monitoring components
 * @nist si-4 "System monitoring"
 * @nist ir-4 "Incident handling"
 */
export class HealthMonitorCoordinator {
  private logger: pino.Logger;
  private options: Required<HealthMonitorOptions>;
  private metricsCollector: MetricsCollector;
  private strategyManager: StrategyManager;
  private eventManager: HealthEventManager;
  private recoveryChain: CleanupRecoveryAction;

  // Intervals
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // State
  private lastStatus: (typeof HealthStatus)[keyof typeof HealthStatus] = HealthStatus.UNKNOWN;
  private isRunning = false;

  constructor({ logger }: WSComponentDependencies, options: HealthMonitorOptions = {}) {
    this.logger = logger.child({ module: 'health-monitor' });
    this.options = {
      heartbeatInterval: options.heartbeatInterval ?? config.WS_HEARTBEAT_INTERVAL ?? 30000,
      connectionTimeout: options.connectionTimeout ?? 60000,
      maxStaleAge: options.maxStaleAge ?? 300000, // 5 minutes
    };

    // Initialize components
    this.metricsCollector = new MetricsCollector(this.logger);
    this.strategyManager = new StrategyManager(this.logger);
    this.eventManager = new HealthEventManager(this.logger);

    // Setup recovery chain
    this.recoveryChain = new CleanupRecoveryAction('cleanup', this.logger);
    this.recoveryChain.setNext(new ConnectionLimitRecoveryAction(this.logger));
  }

  /**
   * Start health monitoring
   * @nist si-4 "System monitoring"
   */
  start(context: HealthCheckContext): void {
    if (this.isRunning) {
      this.logger.warn('Health monitoring already running');
      return;
    }

    this.logger.info('Starting health monitoring', {
      heartbeatInterval: this.options.heartbeatInterval,
      connectionTimeout: this.options.connectionTimeout,
      maxStaleAge: this.options.maxStaleAge,
    });

    this.isRunning = true;

    // Start heartbeat monitoring
    this.startHeartbeat(context);

    // Start periodic health checks
    this.startHealthChecks(context);

    // Log monitoring start
    void logSecurityEvent(SecurityEventType.SERVICE_START, {
      resource: 'websocket',
      action: 'health_monitoring_start',
      result: 'success',
      metadata: {
        heartbeatInterval: this.options.heartbeatInterval,
        connectionTimeout: this.options.connectionTimeout,
      },
    });
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping health monitoring');
    this.isRunning = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get current health status
   * @nist si-4 "System monitoring"
   */
  async getHealthStatus(context: HealthCheckContext): Promise<HealthCheckResult> {
    const metrics = this.metricsCollector.collectMetrics(context);
    const { status, issues, recommendations } = await this.strategyManager.executeHealthChecks(
      context,
      metrics,
    );

    const result: HealthCheckResult = {
      status,
      message: this.getStatusMessage(status, issues),
      metrics,
      issues,
      recommendations,
    };

    // Check for status change
    if (status !== this.lastStatus) {
      this.handleStatusChange(status, result);
    }

    // Log health check
    void logSecurityEvent(SecurityEventType.SERVICE_START, {
      resource: 'websocket',
      action: 'health_check',
      result: status === HealthStatus.HEALTHY ? 'success' : 'failure',
      metadata: {
        status,
        activeConnections: metrics.activeConnections,
        totalSubscriptions: metrics.totalSubscriptions,
        errorsCount: metrics.errorsCount,
        issueCount: issues.length,
      },
    });

    return result;
  }

  /**
   * Record message processing
   */
  recordMessageProcessed(responseTime?: number): void {
    this.metricsCollector.recordMessageProcessed(responseTime);
  }

  /**
   * Record error occurrence
   */
  recordError(error: Error | string): void {
    this.metricsCollector.recordError(error);
  }

  /**
   * Record connection event
   */
  recordConnection(type: 'connected' | 'disconnected'): void {
    this.metricsCollector.recordConnection(type);
  }

  /**
   * Get event manager for registering observers
   */
  getEventManager(): HealthEventManager {
    return this.eventManager;
  }

  /**
   * Get strategy manager for customizing health checks
   */
  getStrategyManager(): StrategyManager {
    return this.strategyManager;
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(context: HealthCheckContext): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this.options.connectionTimeout;

      context.connectionManager.getAllConnections().forEach(({ connectionId, ws, state }) => {
        const lastActivity = state.lastActivity.getTime();

        if (now - lastActivity > timeout) {
          // Connection timed out
          this.logger.warn('WebSocket connection timed out', {
            connectionId,
            lastActivity: state.lastActivity.toISOString(),
            timeoutMs: timeout,
          });

          ws.terminate();
          context.connectionManager.removeConnection(connectionId);
          this.recordConnection('disconnected');
        } else if (ws.readyState === WebSocket.OPEN) {
          // Send ping
          try {
            ws.ping();
          } catch (error) {
            this.logger.error('Failed to send ping', {
              connectionId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      });
    }, this.options.heartbeatInterval);
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(context: HealthCheckContext): void {
    // Run health check every minute
    this.healthCheckInterval = setInterval(() => {
      void (async () => {
        try {
          const result = await this.getHealthStatus(context);

          // Trigger recovery if needed
          if (result.status === HealthStatus.CRITICAL) {
            await this.triggerRecovery(context, result);
          }
        } catch (error) {
          this.logger.error('Health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })();
    }, 60000); // 1 minute
  }

  /**
   * Handle status change
   */
  private handleStatusChange(
    newStatus: (typeof HealthStatus)[keyof typeof HealthStatus],
    result: HealthCheckResult,
  ): void {
    this.lastStatus = newStatus;

    this.eventManager.emitHealthEvent({
      type: HealthEventType.STATUS_CHANGED,
      timestamp: Date.now(),
      status: newStatus,
      metrics: result.metrics,
      details: {
        issues: result.issues,
        recommendations: result.recommendations,
      },
    });
  }

  /**
   * Trigger recovery actions
   * @nist ir-4 "Incident handling"
   */
  private async triggerRecovery(
    context: HealthCheckContext,
    result: HealthCheckResult,
  ): Promise<void> {
    this.logger.warn('Triggering recovery actions', {
      status: result.status,
      issueCount: result.issues.length,
    });

    this.eventManager.emitHealthEvent({
      type: HealthEventType.RECOVERY_ACTION_TRIGGERED,
      timestamp: Date.now(),
      status: result.status,
      details: {
        issues: result.issues,
      },
    });

    const recoveryResult = await this.recoveryChain.handle({
      ...context,
      status: result.status,
      metrics: result.metrics,
      issues: result.issues,
    });

    this.eventManager.emitHealthEvent({
      type: HealthEventType.RECOVERY_ACTION_COMPLETED,
      timestamp: Date.now(),
      details: {
        success: recoveryResult.success,
        message: recoveryResult.message,
        actionsExecuted: recoveryResult.actionsExecuted,
      },
    });

    this.logger.info('Recovery actions completed', {
      success: recoveryResult.success,
      actionsExecuted: recoveryResult.actionsExecuted.length,
    });
  }

  /**
   * Get status message
   */
  private getStatusMessage(
    status: (typeof HealthStatus)[keyof typeof HealthStatus],
    issues: string[],
  ): string {
    switch (status) {
      case HealthStatus.HEALTHY:
        return 'WebSocket server is operating normally';
      case HealthStatus.WARNING:
        return `WebSocket server has ${issues.length} warning(s)`;
      case HealthStatus.CRITICAL:
        return `WebSocket server has ${issues.length} critical issue(s)`;
      default:
        return 'WebSocket server health status unknown';
    }
  }
}
