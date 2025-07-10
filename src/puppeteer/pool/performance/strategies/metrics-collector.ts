/**
 * Metrics collection strategy for performance monitoring
 * @module puppeteer/pool/performance/strategies/metrics-collector
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */

import type { EventEmitter } from 'events';
import type {
  PerformanceDataPoint,
  TimeRange,
  PerformanceMonitoringConfig,
} from '../types/performance-monitor.types.js';
import { PerformanceMetricType } from '../types/performance-monitor.types.js';
import type { IMetricsCollector } from '../types/strategy.interfaces.js';

/**
 * Metrics collection strategy implementation
 */
export class MetricsCollector implements IMetricsCollector {
  readonly monitor: EventEmitter;
  readonly config: PerformanceMonitoringConfig;
  
  private dataPoints: Map<PerformanceMetricType, PerformanceDataPoint[]> = new Map();
  private readonly maxDataPoints = 10000;

  constructor(monitor: EventEmitter, config: PerformanceMonitoringConfig) {
    this.monitor = monitor;
    this.config = config;
    this.initializeMetricMaps();
  }

  /**
   * Initialize metric maps for all metric types
   */
  initializeMetricMaps(): void {
    for (const type of Object.values(PerformanceMetricType)) {
      this.dataPoints.set(type, []);
    }
  }

  /**
   * Record a performance metric
   * @nist au-3 "Content of audit records"
   */
  recordMetric(
    type: PerformanceMetricType,
    value: number,
    metadata?: Record<string, any>,
    tags?: Record<string, string>,
    source?: string
  ): void {
    const dataPoint: PerformanceDataPoint = {
      timestamp: new Date(),
      type,
      value,
      metadata,
      tags,
      source,
    };

    this.addDataPoint(type, dataPoint);
    this.monitor.emit('metric-recorded', { type, value, metadata, tags, source });
  }

  /**
   * Get performance metrics with optional filtering
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(
    type?: PerformanceMetricType,
    timeRange?: TimeRange
  ): Map<PerformanceMetricType, PerformanceDataPoint[]> {
    if (type) {
      const metrics = this.dataPoints.get(type) || [];
      const filtered = timeRange
        ? metrics.filter(dp => dp.timestamp >= timeRange.start && dp.timestamp <= timeRange.end)
        : metrics;
      return new Map([[type, filtered]]);
    }

    const result = new Map<PerformanceMetricType, PerformanceDataPoint[]>();
    for (const [metricType, metrics] of this.dataPoints) {
      const filtered = timeRange
        ? metrics.filter(dp => dp.timestamp >= timeRange.start && dp.timestamp <= timeRange.end)
        : metrics;
      result.set(metricType, filtered);
    }

    return result;
  }

  /**
   * Clean up old data points based on retention period
   */
  cleanupOldData(retentionPeriod: number): void {
    const cutoff = new Date(Date.now() - retentionPeriod);

    for (const [type, points] of this.dataPoints) {
      const filtered = points.filter(dp => dp.timestamp >= cutoff);
      this.dataPoints.set(type, filtered);
    }
  }

  /**
   * Get data points for a specific metric type (internal use)
   */
  getDataPointsForType(type: PerformanceMetricType): PerformanceDataPoint[] {
    return this.dataPoints.get(type) || [];
  }

  /**
   * Get all data points (internal use)
   */
  getAllDataPoints(): Map<PerformanceMetricType, PerformanceDataPoint[]> {
    return new Map(this.dataPoints);
  }

  /**
   * Add a data point to the collection
   * @private
   */
  private addDataPoint(type: PerformanceMetricType, dataPoint: PerformanceDataPoint): void {
    const points = this.dataPoints.get(type) || [];
    points.push(dataPoint);

    // Maintain max data points to prevent memory issues
    if (points.length > this.maxDataPoints) {
      points.shift();
    }

    this.dataPoints.set(type, points);
  }

  /**
   * Get current metric statistics
   */
  getMetricStatistics(type: PerformanceMetricType): {
    count: number;
    latest?: PerformanceDataPoint;
    oldest?: PerformanceDataPoint;
  } {
    const points = this.dataPoints.get(type) || [];
    
    return {
      count: points.length,
      latest: points.length > 0 ? points[points.length - 1] : undefined,
      oldest: points.length > 0 ? points[0] : undefined,
    };
  }

  /**
   * Check if we have sufficient data for analysis
   */
  hasSufficientData(type: PerformanceMetricType, minimumPoints = 10): boolean {
    const points = this.dataPoints.get(type) || [];
    return points.length >= minimumPoints;
  }

  /**
   * Get memory usage statistics for the collector
   */
  getMemoryUsage(): {
    totalDataPoints: number;
    dataPointsByType: Record<string, number>;
    estimatedMemoryKB: number;
  } {
    let totalDataPoints = 0;
    const dataPointsByType: Record<string, number> = {};

    for (const [type, points] of this.dataPoints) {
      const count = points.length;
      totalDataPoints += count;
      dataPointsByType[type] = count;
    }

    // Rough estimate: each data point ~200 bytes
    const estimatedMemoryKB = Math.round((totalDataPoints * 200) / 1024);

    return {
      totalDataPoints,
      dataPointsByType,
      estimatedMemoryKB,
    };
  }
}