/**
 * Base metric collector with observer pattern implementation
 * @module puppeteer/pool/metrics/base-collector
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import type {
  MetricDataPoint,
  MetricObserver,
  MetricSubject,
  MetricEvent,
} from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('metric-collector');

/**
 * Configuration for metric collectors
 */
export interface MetricCollectorConfig {
  /** Window size for rolling metrics in milliseconds */
  windowSize?: number;
  /** Maximum number of data points to store */
  maxDataPoints?: number;
  /** Maximum array size for simple metrics */
  maxArraySize?: number;
}

/**
 * Base metric collector with observer pattern
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */
export abstract class BaseMetricCollector implements MetricSubject {
  protected readonly observers: Set<MetricObserver> = new Set();
  protected readonly config: Required<MetricCollectorConfig>;

  constructor(config: MetricCollectorConfig = {}) {
    this.config = {
      windowSize: config.windowSize ?? 3600000, // 1 hour default
      maxDataPoints: config.maxDataPoints ?? 60, // 60 points default
      maxArraySize: config.maxArraySize ?? 100, // 100 items default
    };
  }

  /**
   * Attach an observer
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  attach(observer: MetricObserver): void {
    this.observers.add(observer);
    logger.debug('Observer attached to metric collector');
  }

  /**
   * Detach an observer
   */
  detach(observer: MetricObserver): void {
    this.observers.delete(observer);
    logger.debug('Observer detached from metric collector');
  }

  /**
   * Notify all observers of an event
   * @nist au-3 "Content of audit records"
   */
  notify(event: MetricEvent): void {
    this.observers.forEach((observer) => {
      try {
        observer.update(event);
      } catch (error) {
        logger.error({ error, observer }, 'Error notifying observer');
      }
    });
  }

  /**
   * Add metric data point with timestamp
   * @protected
   */
  protected addMetricDataPoint(array: MetricDataPoint[], value: number): void {
    const now = new Date();
    array.push({ timestamp: now, value });

    // Remove old data points outside the window
    const cutoff = new Date(now.getTime() - this.config.windowSize);
    while (array.length > 0 && array[0] && array[0].timestamp < cutoff) {
      array.shift();
    }
  }

  /**
   * Add time series data point with max limit
   * @protected
   */
  protected addTimeSeriesDataPoint(array: MetricDataPoint[], value: number): void {
    array.push({ timestamp: new Date(), value });

    // Keep only last N data points
    if (array.length > this.config.maxDataPoints) {
      array.shift();
    }
  }

  /**
   * Maintain array size limit
   * @protected
   */
  protected limitArraySize<T>(array: T[]): void {
    while (array.length > this.config.maxArraySize) {
      array.shift();
    }
  }

  /**
   * Calculate average of number array
   * @protected
   */
  protected calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate average of recent metric data points
   * @protected
   */
  protected calculateRecentAverage(dataPoints: MetricDataPoint[]): number {
    if (dataPoints.length === 0) return 0;
    const values = dataPoints.map((dp) => dp.value);
    return this.calculateAverage(values);
  }

  /**
   * Get the most recent value from metric data points
   * @protected
   */
  protected getLastValue(dataPoints: MetricDataPoint[]): number {
    return dataPoints.length > 0
      ? (dataPoints[dataPoints.length - 1]?.value ?? 0)
      : 0;
  }

  /**
   * Abstract method to reset the collector
   */
  abstract reset(): void;
}