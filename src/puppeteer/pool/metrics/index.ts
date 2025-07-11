/**
 * Browser pool metrics module exports
 * @module puppeteer/pool/metrics
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-4 "Information system monitoring"
 */

// Export types
export * from './types.js';

// Export base classes
export { BaseMetricCollector } from './base-collector.js';
export type { MetricCollectorConfig } from './base-collector.js';

// Export collectors
export { PerformanceMetricsCollector } from './performance-collector.js';
export type { PerformanceMetrics } from './performance-collector.js';

export { QueueMetricsCollector } from './queue-collector.js';
export { ErrorMetricsCollector } from './error-collector.js';
export { ResourceMetricsCollector } from './resource-collector.js';

// Export aggregator
export { MetricsAggregator } from './metrics-aggregator.js';

// Export factory
export { MetricsFactory, MetricCollectorType } from './metrics-factory.js';

// Export reporter
export { MetricsReporter, ReportFormat } from './metrics-reporter.js';
export type { ReporterConfig } from './metrics-reporter.js';

// Export utilities
export { getPoolMetrics } from './pool-metrics-utils.js';
