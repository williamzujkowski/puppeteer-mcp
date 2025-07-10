/**
 * Factory for creating metric collectors
 * @module puppeteer/pool/metrics/metrics-factory
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import type { MetricCollector } from './types.js';
import type { MetricCollectorConfig } from './base-collector.js';
import { PerformanceMetricsCollector } from './performance-collector.js';
import { QueueMetricsCollector } from './queue-collector.js';
import { ErrorMetricsCollector } from './error-collector.js';
import { ResourceMetricsCollector } from './resource-collector.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('metrics-factory');

/**
 * Types of metric collectors available
 */
export enum MetricCollectorType {
  PERFORMANCE = 'performance',
  QUEUE = 'queue',
  ERROR = 'error',
  RESOURCE = 'resource',
}

/**
 * Factory for creating metric collectors
 * @nist au-3 "Content of audit records"
 */
export class MetricsFactory {
  /**
   * Create a metric collector of the specified type
   * @nist si-4 "Information system monitoring"
   */
  static createCollector<T = unknown>(
    type: MetricCollectorType,
    config?: MetricCollectorConfig
  ): MetricCollector<T> {
    logger.debug({ type, config }, 'Creating metric collector');

    switch (type) {
      case MetricCollectorType.PERFORMANCE:
        return new PerformanceMetricsCollector(config) as MetricCollector<T>;

      case MetricCollectorType.QUEUE:
        return new QueueMetricsCollector(config) as MetricCollector<T>;

      case MetricCollectorType.ERROR:
        return new ErrorMetricsCollector(config) as MetricCollector<T>;

      case MetricCollectorType.RESOURCE:
        return new ResourceMetricsCollector(config) as MetricCollector<T>;

      default:
        throw new Error(`Unknown metric collector type: ${type as string}`);
    }
  }

  /**
   * Create all metric collectors with default configuration
   */
  static createAllCollectors(config?: MetricCollectorConfig): {
    performance: MetricCollector<unknown>;
    queue: MetricCollector<unknown>;
    error: MetricCollector<unknown>;
    resource: MetricCollector<unknown>;
  } {
    return {
      performance: this.createCollector<PerformanceMetricsCollector>(
        MetricCollectorType.PERFORMANCE,
        config
      ),
      queue: this.createCollector<QueueMetricsCollector>(
        MetricCollectorType.QUEUE,
        config
      ),
      error: this.createCollector<ErrorMetricsCollector>(
        MetricCollectorType.ERROR,
        config
      ),
      resource: this.createCollector<ResourceMetricsCollector>(
        MetricCollectorType.RESOURCE,
        config
      ),
    };
  }
}