/**
 * Browser pool metrics collection and tracking
 * @module puppeteer/pool/browser-pool-metrics
 * @nist au-3 "Content of audit records"
 * @nist au-4 "Audit storage capacity"
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-4 "Information system monitoring"
 * 
 * This file maintains backward compatibility by re-exporting from modularized components
 */

// Re-export types for backward compatibility
export type {
  ExtendedPoolMetrics,
  MetricDataPoint,
  QueueMetrics,
  ResourceMetrics,
  ErrorMetrics,
  HealthCheckMetrics,
  AggregatedResourceMetrics,
  TimeSeriesMetrics,
} from './metrics/types.js';

// Re-export utilities
export { getPoolMetrics } from './metrics/pool-metrics-utils.js';

// Import required modules for BrowserPoolMetrics class
import { MetricsAggregator } from './metrics/metrics-aggregator.js';
import type { ExtendedPoolMetrics } from './metrics/types.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('browser-pool-metrics');

/**
 * Browser pool metrics collector - facade for backward compatibility
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 * 
 * This class provides backward compatibility by wrapping the new modular architecture
 */
export class BrowserPoolMetrics {
  private readonly aggregator: MetricsAggregator;

  constructor() {
    this.aggregator = new MetricsAggregator();
    logger.info('Browser pool metrics initialized with modular architecture');
  }

  /**
   * Record browser creation
   * @nist au-3 "Content of audit records"
   */
  recordBrowserCreated(browserId: string, creationTime: number): void {
    this.aggregator.recordBrowserCreated(browserId, creationTime);
  }

  /**
   * Record browser destruction
   * @nist au-3 "Content of audit records"
   */
  recordBrowserDestroyed(browserId: string, lifetime: number): void {
    this.aggregator.recordBrowserDestroyed(browserId, lifetime);
  }

  /**
   * Record page creation time
   * @nist au-3 "Content of audit records"
   */
  recordPageCreation(duration: number): void {
    this.aggregator.getCollectors().performance.recordPageCreation(duration);
  }

  /**
   * Record page destruction time
   * @nist au-3 "Content of audit records"
   */
  recordPageDestruction(duration: number): void {
    this.aggregator.getCollectors().performance.recordPageDestruction(duration);
  }

  /**
   * Record health check performance
   * @nist si-4 "Information system monitoring"
   */
  recordHealthCheck(duration: number, success: boolean): void {
    this.aggregator.getCollectors().performance.recordHealthCheck(duration, success);
  }

  /**
   * Record queue metrics
   * @nist au-3 "Content of audit records"
   */
  recordQueueAdd(): void {
    this.aggregator.getCollectors().queue.recordQueueAdd();
  }

  /**
   * Record queue removal with wait time
   * @nist au-3 "Content of audit records"
   */
  recordQueueRemove(waitTime: number): void {
    this.aggregator.getCollectors().queue.recordQueueRemove(waitTime);
  }

  /**
   * Record error occurrence
   * @nist au-3 "Content of audit records"
   * @nist au-5 "Response to audit processing failures"
   */
  recordError(type: string, browserId?: string): void {
    this.aggregator.getCollectors().errors.recordError(type, browserId);
  }

  /**
   * Record recovery attempt result
   * @nist au-3 "Content of audit records"
   */
  recordRecovery(success: boolean, browserId: string): void {
    this.aggregator.getCollectors().errors.recordRecovery(success, browserId);
  }

  /**
   * Update resource usage for a browser
   * @nist si-4 "Information system monitoring"
   */
  updateResourceUsage(browserId: string, cpuUsage: number, memoryUsage: number): void {
    this.aggregator.getCollectors().resources.updateResourceUsage(
      browserId,
      cpuUsage,
      memoryUsage
    );
  }

  /**
   * Record current utilization
   * @nist si-4 "Information system monitoring"
   */
  recordUtilization(utilization: number): void {
    this.aggregator.getCollectors().resources.recordUtilization(utilization);
  }

  /**
   * Get current metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(
    browsers: Map<string, InternalBrowserInstance>,
    maxBrowsers: number
  ): ExtendedPoolMetrics {
    return this.aggregator.getMetrics(browsers, maxBrowsers);
  }

  /**
   * Get access to individual collectors for advanced usage
   */
  getCollectors() {
    return this.aggregator.getCollectors();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.aggregator.reset();
  }

  /**
   * Get pool metrics for scaling decisions
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getPoolMetrics(browsers?: Map<string, InternalBrowserInstance>) {
    const queueMetrics = this.aggregator.getCollectors().queue.collect();
    const errorMetrics = this.aggregator.getCollectors().errors.collect();
    const utilizationHistory = this.aggregator.getCollectors().resources.getUtilizationHistory();
    const currentUtilization = utilizationHistory.length > 0 
      ? utilizationHistory[utilizationHistory.length - 1]?.value || 0
      : 0;
    
    return {
      pool: {
        size: browsers?.size || 0,
        utilization: currentUtilization,
      },
      queue: {
        size: queueMetrics.queueLength,
      },
      performance: {
        averageAcquireTime: queueMetrics.averageWaitTime,
      },
      requests: {
        total: queueMetrics.totalQueued,
      },
      errors: {
        total: errorMetrics.totalErrors,
      },
    };
  }

  /**
   * Get system metrics for scaling decisions
   * @nist si-4 "Information system monitoring"
   */
  getSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    return {
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      },
      cpu: process.cpuUsage().user / 1000000, // Convert to seconds
    };
  }
}

// For users who might be importing individual types/interfaces
export { MetricEventType } from './metrics/types.js';
export type {
  MetricEvent,
  MetricObserver,
  MetricSubject,
  MetricCollector,
} from './metrics/types.js';

// Export new modular components for users who want to use them directly
export { MetricsAggregator } from './metrics/metrics-aggregator.js';
export { PerformanceMetricsCollector } from './metrics/performance-collector.js';
export { QueueMetricsCollector } from './metrics/queue-collector.js';
export { ErrorMetricsCollector } from './metrics/error-collector.js';
export { ResourceMetricsCollector } from './metrics/resource-collector.js';
export { MetricsFactory, MetricCollectorType } from './metrics/metrics-factory.js';
export { MetricsReporter, ReportFormat } from './metrics/metrics-reporter.js';
export type { ReporterConfig } from './metrics/metrics-reporter.js';