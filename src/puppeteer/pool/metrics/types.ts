/**
 * Shared types and interfaces for browser pool metrics
 * @module puppeteer/pool/metrics/types
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import type { PoolMetrics } from '../../interfaces/browser-pool.interface.js';

/**
 * Performance metric data point
 */
export interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

/**
 * Request queue metrics
 */
export interface QueueMetrics {
  queueLength: number;
  averageWaitTime: number;
  maxWaitTime: number;
  totalQueued: number;
  totalDequeued: number;
}

/**
 * Resource usage metrics per browser
 */
export interface ResourceMetrics {
  browserId: string;
  cpuUsage: number;
  memoryUsage: number;
  timestamp: Date;
}

/**
 * Error metrics tracking
 */
export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  recoverySuccesses: number;
  recoveryFailures: number;
  lastError?: {
    timestamp: Date;
    type: string;
    browserId?: string;
  };
}

/**
 * Health check performance metrics
 */
export interface HealthCheckMetrics {
  avgDuration: number;
  lastDuration: number;
  successRate: number;
  totalChecks: number;
}

/**
 * Aggregated resource metrics
 */
export interface AggregatedResourceMetrics {
  totalCpuUsage: number;
  totalMemoryUsage: number;
  avgCpuPerBrowser: number;
  avgMemoryPerBrowser: number;
}

/**
 * Time series metrics collection
 */
export interface TimeSeriesMetrics {
  utilizationHistory: MetricDataPoint[];
  errorRateHistory: MetricDataPoint[];
  queueLengthHistory: MetricDataPoint[];
}

/**
 * Extended pool metrics with detailed performance data
 */
export interface ExtendedPoolMetrics extends PoolMetrics {
  /** Queue metrics */
  queue: QueueMetrics;
  /** Error and recovery metrics */
  errors: ErrorMetrics;
  /** Average page creation time (ms) */
  avgPageCreationTime: number;
  /** Average page destruction time (ms) */
  avgPageDestructionTime: number;
  /** Health check performance metrics */
  healthCheck: HealthCheckMetrics;
  /** Resource usage metrics */
  resources: AggregatedResourceMetrics;
  /** Time-based metrics */
  timeSeries: TimeSeriesMetrics;
}

/**
 * Metric collector interface for strategy pattern
 */
export interface MetricCollector<T = unknown> {
  collect(): T;
  reset(): void;
}

/**
 * Metric event types for observer pattern
 */
export enum MetricEventType {
  BROWSER_CREATED = 'browser_created',
  BROWSER_DESTROYED = 'browser_destroyed',
  PAGE_CREATED = 'page_created',
  PAGE_DESTROYED = 'page_destroyed',
  HEALTH_CHECK_COMPLETED = 'health_check_completed',
  ERROR_OCCURRED = 'error_occurred',
  RECOVERY_ATTEMPTED = 'recovery_attempted',
  QUEUE_UPDATED = 'queue_updated',
  RESOURCE_UPDATED = 'resource_updated',
  UTILIZATION_RECORDED = 'utilization_recorded',
}

/**
 * Metric event payload
 */
export interface MetricEvent {
  type: MetricEventType;
  timestamp: Date;
  data: Record<string, unknown>;
}

/**
 * Metric observer interface
 */
export interface MetricObserver {
  update(event: MetricEvent): void;
}

/**
 * Metric subject interface
 */
export interface MetricSubject {
  attach(observer: MetricObserver): void;
  detach(observer: MetricObserver): void;
  notify(event: MetricEvent): void;
}
