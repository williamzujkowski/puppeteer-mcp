/**
 * Proxy Monitoring and Metrics
 * @module puppeteer/proxy/proxy-monitoring
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import { EventEmitter } from 'events';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ProxyHealthStatus, ProxyMetrics } from '../types/proxy.js';
import { proxyManager } from './proxy-manager.js';

const logger = createLogger('proxy-monitoring');

/**
 * Proxy monitoring events
 * @nist au-3 "Content of audit records"
 */
export interface ProxyMonitoringEvents {
  'metrics:updated': { metrics: ProxyMetrics[]; timestamp: Date };
  'health:degraded': { proxyId: string; health: ProxyHealthStatus };
  'pool:unhealthy': { healthyCount: number; totalCount: number; threshold: number };
  'performance:alert': { proxyId: string; metric: string; value: number; threshold: number };
}

/**
 * Proxy monitoring configuration
 * @nist si-4 "Information system monitoring"
 */
export interface ProxyMonitoringConfig {
  metricsInterval: number; // How often to collect metrics
  healthThreshold: number; // Percentage of healthy proxies required
  performanceThresholds: {
    responseTime: number; // Max average response time in ms
    errorRate: number; // Max error rate percentage
    consecutiveFailures: number; // Max consecutive failures
  };
  alerting: {
    enabled: boolean;
    channels: Array<'log' | 'event' | 'callback'>;
    callback?: (alert: any) => void;
  };
}

/**
 * Proxy monitoring service
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */
export class ProxyMonitor extends EventEmitter {
  private config: ProxyMonitoringConfig;
  private metricsInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: Partial<ProxyMonitoringConfig> = {}) {
    super();
    this.config = {
      metricsInterval: config.metricsInterval ?? 60000, // 1 minute
      healthThreshold: config.healthThreshold ?? 0.5, // 50% healthy required
      performanceThresholds: {
        responseTime: config.performanceThresholds?.responseTime ?? 5000, // 5 seconds
        errorRate: config.performanceThresholds?.errorRate ?? 0.1, // 10%
        consecutiveFailures: config.performanceThresholds?.consecutiveFailures ?? 5,
      },
      alerting: {
        enabled: config.alerting?.enabled ?? true,
        channels: config.alerting?.channels ?? ['log', 'event'],
        callback: config.alerting?.callback,
      },
    };
  }

  /**
   * Start monitoring
   * @nist si-4 "Information system monitoring"
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Proxy monitoring already running');
      return;
    }

    this.isRunning = true;

    // Set up proxy manager event listeners
    this.setupEventListeners();

    // Start metrics collection
    await this.collectMetrics();
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.metricsInterval);

    logger.info({
      msg: 'Proxy monitoring started',
      config: {
        metricsInterval: this.config.metricsInterval,
        healthThreshold: this.config.healthThreshold,
        performanceThresholds: this.config.performanceThresholds,
      },
    });

    await logSecurityEvent(SecurityEventType.SERVICE_START, {
      resource: 'proxy_monitor',
      action: 'start',
      result: 'success',
    });
  }

  /**
   * Stop monitoring
   * @nist ac-12 "Session termination"
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    // Remove event listeners
    this.removeAllListeners();

    logger.info('Proxy monitoring stopped');

    await logSecurityEvent(SecurityEventType.SERVICE_STOP, {
      resource: 'proxy_monitor',
      action: 'stop',
      result: 'success',
    });
  }

  /**
   * Set up event listeners
   * @private
   */
  private setupEventListeners(): void {
    // Listen to proxy manager events
    proxyManager.on('proxy:unhealthy', async ({ proxyId, error }) => {
      await this.handleUnhealthyProxy(proxyId, error);
    });

    proxyManager.on('proxy:healthy', ({ proxyId, responseTime }) => {
      logger.debug({
        msg: 'Proxy recovered',
        proxyId,
        responseTime,
      });
    });

    proxyManager.on('health:check:complete', async (stats) => {
      await this.evaluatePoolHealth(stats);
    });
  }

  /**
   * Collect and analyze metrics
   * @private
   * @nist au-3 "Content of audit records"
   */
  private async collectMetrics(): Promise<void> {
    try {
      const { proxies } = proxyManager.getMetrics();
      const healthStatuses = proxyManager.getHealthStatus();

      // Analyze each proxy's performance
      for (const metrics of proxies) {
        const health = healthStatuses.find((h) => h.proxyId === metrics.proxyId);
        if (!health) continue;

        await this.analyzeProxyPerformance(metrics, health);
      }

      // Emit metrics update
      this.emit('metrics:updated', { metrics: proxies, timestamp: new Date() });

      logger.debug({
        msg: 'Metrics collected',
        proxyCount: proxies.length,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to collect metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Analyze individual proxy performance
   * @private
   * @nist si-4 "Information system monitoring"
   */
  private async analyzeProxyPerformance(
    metrics: ProxyMetrics,
    health: ProxyHealthStatus,
  ): Promise<void> {
    const alerts: Array<{ metric: string; value: number; threshold: number }> = [];

    // Check response time
    if (metrics.averageResponseTime > this.config.performanceThresholds.responseTime) {
      alerts.push({
        metric: 'responseTime',
        value: metrics.averageResponseTime,
        threshold: this.config.performanceThresholds.responseTime,
      });
    }

    // Check error rate
    const errorRate = metrics.requestCount > 0 
      ? metrics.failureCount / metrics.requestCount 
      : 0;
    
    if (errorRate > this.config.performanceThresholds.errorRate) {
      alerts.push({
        metric: 'errorRate',
        value: errorRate * 100,
        threshold: this.config.performanceThresholds.errorRate * 100,
      });
    }

    // Check consecutive failures
    if (health.consecutiveFailures > this.config.performanceThresholds.consecutiveFailures) {
      alerts.push({
        metric: 'consecutiveFailures',
        value: health.consecutiveFailures,
        threshold: this.config.performanceThresholds.consecutiveFailures,
      });
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert({
        type: 'performance',
        proxyId: metrics.proxyId,
        ...alert,
      });

      this.emit('performance:alert', {
        proxyId: metrics.proxyId,
        ...alert,
      });
    }
  }

  /**
   * Handle unhealthy proxy
   * @private
   * @nist si-4 "Information system monitoring"
   */
  private async handleUnhealthyProxy(proxyId: string, error: string): Promise<void> {
    const health = proxyManager.getHealthStatus().find((h) => h.proxyId === proxyId);
    if (!health) return;

    this.emit('health:degraded', { proxyId, health });

    await this.sendAlert({
      type: 'health',
      proxyId,
      error,
      consecutiveFailures: health.consecutiveFailures,
    });

    await logSecurityEvent(SecurityEventType.SECURITY_VIOLATION, {
      resource: `proxy:${proxyId}`,
      action: 'health_degraded',
      result: 'failure',
      reason: error,
      metadata: {
        consecutiveFailures: health.consecutiveFailures,
        errorCount: health.errorCount,
      },
    });
  }

  /**
   * Evaluate overall pool health
   * @private
   * @nist si-4 "Information system monitoring"
   */
  private async evaluatePoolHealth(stats: {
    healthy: number;
    unhealthy: number;
    total: number;
  }): Promise<void> {
    const healthPercentage = stats.total > 0 ? stats.healthy / stats.total : 0;

    if (healthPercentage < this.config.healthThreshold) {
      this.emit('pool:unhealthy', {
        healthyCount: stats.healthy,
        totalCount: stats.total,
        threshold: this.config.healthThreshold,
      });

      await this.sendAlert({
        type: 'pool_health',
        healthyCount: stats.healthy,
        totalCount: stats.total,
        healthPercentage: healthPercentage * 100,
        threshold: this.config.healthThreshold * 100,
      });

      await logSecurityEvent(SecurityEventType.SECURITY_VIOLATION, {
        resource: 'proxy_pool',
        action: 'health_threshold_breach',
        result: 'warning',
        metadata: {
          healthyCount: stats.healthy,
          totalCount: stats.total,
          healthPercentage: healthPercentage * 100,
          threshold: this.config.healthThreshold * 100,
        },
      });
    }
  }

  /**
   * Send alert through configured channels
   * @private
   * @nist au-3 "Content of audit records"
   */
  private async sendAlert(alert: any): Promise<void> {
    if (!this.config.alerting.enabled) {
      return;
    }

    for (const channel of this.config.alerting.channels) {
      switch (channel) {
        case 'log':
          logger.warn({
            msg: 'Proxy alert',
            alert,
          });
          break;

        case 'event':
          this.emit('alert', alert);
          break;

        case 'callback':
          if (this.config.alerting.callback) {
            try {
              await this.config.alerting.callback(alert);
            } catch (error) {
              logger.error({
                msg: 'Alert callback failed',
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
          break;
      }
    }
  }

  /**
   * Get current monitoring status
   * @nist au-3 "Content of audit records"
   */
  getStatus(): {
    running: boolean;
    config: ProxyMonitoringConfig;
    currentMetrics: {
      poolHealth: number;
      averageResponseTime: number;
      totalErrorRate: number;
    };
  } {
    const { proxies } = proxyManager.getMetrics();
    const healthStatuses = proxyManager.getHealthStatus();

    const healthyCount = healthStatuses.filter((h) => h.healthy).length;
    const poolHealth = healthStatuses.length > 0 ? healthyCount / healthStatuses.length : 0;

    const totalRequests = proxies.reduce((sum, p) => sum + p.requestCount, 0);
    const totalFailures = proxies.reduce((sum, p) => sum + p.failureCount, 0);
    const totalErrorRate = totalRequests > 0 ? totalFailures / totalRequests : 0;

    const avgResponseTime = proxies.length > 0
      ? proxies.reduce((sum, p) => sum + p.averageResponseTime, 0) / proxies.length
      : 0;

    return {
      running: this.isRunning,
      config: this.config,
      currentMetrics: {
        poolHealth: poolHealth * 100,
        averageResponseTime: avgResponseTime,
        totalErrorRate: totalErrorRate * 100,
      },
    };
  }
}

/**
 * Singleton proxy monitor instance
 */
export const proxyMonitor = new ProxyMonitor();