/**
 * Metrics aggregator that combines all metric collectors
 * @module puppeteer/pool/metrics/metrics-aggregator
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-4 "Information system monitoring"
 */

import type { ExtendedPoolMetrics, TimeSeriesMetrics } from './types.js';
import type { InternalBrowserInstance } from '../browser-pool-maintenance.js';
import { PerformanceMetricsCollector } from './performance-collector.js';
import { QueueMetricsCollector } from './queue-collector.js';
import { ErrorMetricsCollector } from './error-collector.js';
import { ResourceMetricsCollector } from './resource-collector.js';
import { getPoolMetrics } from './pool-metrics-utils.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('metrics-aggregator');

/**
 * Aggregates metrics from multiple collectors
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class MetricsAggregator {
  private readonly performance: PerformanceMetricsCollector;
  private readonly queue: QueueMetricsCollector;
  private readonly errors: ErrorMetricsCollector;
  private readonly resources: ResourceMetricsCollector;

  constructor() {
    this.performance = new PerformanceMetricsCollector();
    this.queue = new QueueMetricsCollector();
    this.errors = new ErrorMetricsCollector();
    this.resources = new ResourceMetricsCollector();

    logger.info('Metrics aggregator initialized');
  }

  /**
   * Get all metric collectors for external access
   */
  getCollectors(): {
    performance: PerformanceMetricsCollector;
    queue: QueueMetricsCollector;
    errors: ErrorMetricsCollector;
    resources: ResourceMetricsCollector;
  } {
    return {
      performance: this.performance,
      queue: this.queue,
      errors: this.errors,
      resources: this.resources,
    };
  }

  /**
   * Record browser creation
   * @nist au-3 "Content of audit records"
   */
  recordBrowserCreated(browserId: string, creationTime: number): void {
    this.performance.recordBrowserCreated(browserId, creationTime);
    this.errors.incrementOperations();
  }

  /**
   * Record browser destruction
   * @nist au-3 "Content of audit records"
   */
  recordBrowserDestroyed(browserId: string, lifetime: number): void {
    this.performance.recordBrowserDestroyed(browserId, lifetime);
    this.resources.removeBrowserMetrics(browserId);
    this.errors.incrementOperations();
  }

  /**
   * Get aggregated metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(
    browsers: Map<string, InternalBrowserInstance>,
    maxBrowsers: number,
  ): ExtendedPoolMetrics {
    // Get base pool metrics
    const baseMetrics = getPoolMetrics(browsers, maxBrowsers);

    // Collect metrics from all collectors
    const performanceMetrics = this.performance.collect();
    const queueMetrics = this.queue.collect();
    const errorMetrics = this.errors.collect();
    const resourceMetrics = this.resources.collect();

    // Compile time series data
    const timeSeries: TimeSeriesMetrics = {
      utilizationHistory: this.resources.getUtilizationHistory(),
      errorRateHistory: this.errors.getErrorRateHistory(),
      queueLengthHistory: this.queue.getQueueLengthHistory(),
    };

    // Update base metrics with collected data
    const extendedMetrics: ExtendedPoolMetrics = {
      ...baseMetrics,
      browsersCreated: this.performance.getBrowsersCreated(),
      browsersDestroyed: this.performance.getBrowsersDestroyed(),
      avgBrowserLifetime: performanceMetrics.browserLifetimes.average,
      queue: queueMetrics,
      errors: errorMetrics,
      avgPageCreationTime: performanceMetrics.avgPageCreationTime,
      avgPageDestructionTime: performanceMetrics.avgPageDestructionTime,
      healthCheck: performanceMetrics.healthCheck,
      resources: resourceMetrics,
      timeSeries,
    };

    return extendedMetrics;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.performance.reset();
    this.queue.reset();
    this.errors.reset();
    this.resources.reset();

    logger.info('All metrics reset');
  }
}
