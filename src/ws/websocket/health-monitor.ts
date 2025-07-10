/**
 * WebSocket server health monitoring
 * @module ws/websocket/health-monitor
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 */

import { WebSocket } from 'ws';
import type { pino } from 'pino';
import { config } from '../../core/config.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ConnectionManager } from './connection-manager.js';
import type { SecurityManager } from './security-manager.js';
import type { EventHandler } from './event-handler.js';
import type { WSComponentDependencies, HealthMonitorOptions } from './types.js';

/**
 * Health metrics
 */
interface HealthMetrics {
  uptime: number;
  totalConnections: number;
  activeConnections: number;
  authenticatedConnections: number;
  totalSubscriptions: number;
  messagesProcessed: number;
  errorsCount: number;
  lastErrorTime?: number;
  memoryUsage: NodeJS.MemoryUsage;
  averageResponseTime: number;
  connectionTurnover: {
    connected: number;
    disconnected: number;
    period: number; // in minutes
  };
}

/**
 * Health status levels
 */
enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown',
}

/**
 * Health check result
 */
interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  metrics: HealthMetrics;
  issues: string[];
  recommendations: string[];
}

/**
 * WebSocket server health monitoring
 * Monitors server health, performance metrics, and connection status
 * @nist au-3 "Content of audit records"
 */
export class HealthMonitor {
  private logger: pino.Logger;
  private options: HealthMonitorOptions;
  private startTime: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  // Metrics tracking
  private messagesProcessed = 0;
  private errorsCount = 0;
  private lastErrorTime?: number;
  private responseTimes: number[] = [];
  private connectionStats = {
    connected: 0,
    disconnected: 0,
    periodStart: Date.now(),
  };

  constructor({ logger }: WSComponentDependencies, options: HealthMonitorOptions = {}) {
    this.logger = logger.child({ module: 'ws-health-monitor' });
    this.startTime = Date.now();
    this.options = {
      heartbeatInterval: config.WS_HEARTBEAT_INTERVAL ?? 30000,
      connectionTimeout: config.WS_CONNECTION_TIMEOUT ?? 60000,
      maxStaleAge: 300000, // 5 minutes
      ...options,
    };
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
    this.logger.info('Starting health monitoring', {
      heartbeatInterval: this.options.heartbeatInterval,
      connectionTimeout: this.options.connectionTimeout,
      maxStaleAge: this.options.maxStaleAge,
    });

    // Start heartbeat monitoring
    this.startHeartbeat(connectionManager);

    // Start cleanup tasks
    this.startCleanupTasks(connectionManager, securityManager, eventHandler);

    // Start metrics collection
    this.startMetricsCollection();

    // Log health monitoring start
    void logSecurityEvent(SecurityEventType.SYSTEM_HEALTH_CHECK, {
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
    this.logger.info('Stopping health monitoring');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
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
    const metrics = this.collectMetrics(connectionManager, securityManager, eventHandler);
    const { status, issues, recommendations } = this.analyzeHealth(metrics);

    const result: HealthCheckResult = {
      status,
      message: this.getStatusMessage(status, issues),
      metrics,
      issues,
      recommendations,
    };

    // Log health check
    void logSecurityEvent(SecurityEventType.SYSTEM_HEALTH_CHECK, {
      resource: 'websocket',
      action: 'health_check',
      result: status === HealthStatus.HEALTHY ? 'healthy' : 'warning',
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
    this.messagesProcessed++;
    
    if (responseTime !== undefined) {
      this.responseTimes.push(responseTime);
      // Keep only recent response times (last 100)
      if (this.responseTimes.length > 100) {
        this.responseTimes = this.responseTimes.slice(-100);
      }
    }
  }

  /**
   * Record error occurrence
   */
  recordError(error: Error | string): void {
    this.errorsCount++;
    this.lastErrorTime = Date.now();
    
    this.logger.error('WebSocket error recorded', {
      error: error instanceof Error ? error.message : error,
      totalErrors: this.errorsCount,
    });
  }

  /**
   * Record connection event
   */
  recordConnection(type: 'connected' | 'disconnected'): void {
    this.connectionStats[type]++;
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(connectionManager: ConnectionManager): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this.options.connectionTimeout;

      connectionManager.getAllConnections().forEach(({ connectionId, ws, state }) => {
        const lastActivity = state.lastActivity.getTime();

        if (now - lastActivity > timeout) {
          // Connection timed out
          this.logger.warn('WebSocket connection timed out', {
            connectionId,
            lastActivity: state.lastActivity.toISOString(),
            timeoutMs: timeout,
          });

          ws.terminate();
          connectionManager.removeConnection(connectionId);
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
   * Start cleanup tasks
   */
  private startCleanupTasks(
    connectionManager: ConnectionManager,
    securityManager: SecurityManager,
    eventHandler: EventHandler,
  ): void {
    this.cleanupInterval = setInterval(() => {
      // Clean up stale connections
      const staleConnections = connectionManager.cleanupStaleConnections(this.options.maxStaleAge);
      if (staleConnections > 0) {
        this.logger.info(`Cleaned up ${staleConnections} stale connections`);
      }

      // Clean up rate limit state
      const rateLimitCleaned = securityManager.cleanupRateLimitState();
      if (rateLimitCleaned > 0) {
        this.logger.debug(`Cleaned up ${rateLimitCleaned} rate limit entries`);
      }

      // Clean up event handler subscriptions
      eventHandler.cleanup();

      // Reset connection turnover stats every hour
      const now = Date.now();
      if (now - this.connectionStats.periodStart > 3600000) { // 1 hour
        this.connectionStats = {
          connected: 0,
          disconnected: 0,
          periodStart: now,
        };
      }
    }, 60000); // Run every minute
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      // Reset response times if they get too large
      if (this.responseTimes.length > 1000) {
        this.responseTimes = this.responseTimes.slice(-100);
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Collect health metrics
   */
  private collectMetrics(
    connectionManager: ConnectionManager,
    securityManager: SecurityManager,
    eventHandler: EventHandler,
  ): HealthMetrics {
    const connectionStats = connectionManager.getStats();
    const rateLimitStats = securityManager.getRateLimitStats();
    const subscriptionStats = eventHandler.getSubscriptionStats();

    const averageResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
      : 0;

    const periodMinutes = (Date.now() - this.connectionStats.periodStart) / 60000;

    return {
      uptime: Date.now() - this.startTime,
      totalConnections: connectionStats.total,
      activeConnections: connectionStats.total,
      authenticatedConnections: connectionStats.authenticated,
      totalSubscriptions: subscriptionStats.totalSubscriptions,
      messagesProcessed: this.messagesProcessed,
      errorsCount: this.errorsCount,
      lastErrorTime: this.lastErrorTime,
      memoryUsage: process.memoryUsage(),
      averageResponseTime,
      connectionTurnover: {
        connected: this.connectionStats.connected,
        disconnected: this.connectionStats.disconnected,
        period: Math.max(periodMinutes, 1),
      },
    };
  }

  /**
   * Analyze health metrics
   */
  private analyzeHealth(metrics: HealthMetrics): {
    status: HealthStatus;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check memory usage
    const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryMB > 500) {
      issues.push(`High memory usage: ${memoryMB.toFixed(0)}MB`);
      recommendations.push('Consider investigating memory leaks or increasing heap size');
    }

    // Check error rate
    const errorRate = metrics.messagesProcessed > 0 ? metrics.errorsCount / metrics.messagesProcessed : 0;
    if (errorRate > 0.1) {
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
      recommendations.push('Investigate and fix underlying error causes');
    }

    // Check recent errors
    if (metrics.lastErrorTime && Date.now() - metrics.lastErrorTime < 300000) { // 5 minutes
      issues.push('Recent errors detected');
      recommendations.push('Check logs for recent error patterns');
    }

    // Check response time
    if (metrics.averageResponseTime > 1000) {
      issues.push(`Slow response times: ${metrics.averageResponseTime.toFixed(0)}ms`);
      recommendations.push('Optimize message processing or reduce server load');
    }

    // Check connection turnover
    const turnoverRate = metrics.connectionTurnover.disconnected / Math.max(metrics.connectionTurnover.period, 1);
    if (turnoverRate > 10) {
      issues.push(`High connection turnover: ${turnoverRate.toFixed(1)} disconnections/min`);
      recommendations.push('Investigate connection stability issues');
    }

    // Determine overall status
    let status = HealthStatus.HEALTHY;
    if (issues.length > 3) {
      status = HealthStatus.CRITICAL;
    } else if (issues.length > 0) {
      status = HealthStatus.WARNING;
    }

    return { status, issues, recommendations };
  }

  /**
   * Get status message
   */
  private getStatusMessage(status: HealthStatus, issues: string[]): string {
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