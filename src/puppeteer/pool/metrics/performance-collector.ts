/**
 * Performance metrics collector for browser pool
 * @module puppeteer/pool/metrics/performance-collector
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import { BaseMetricCollector } from './base-collector.js';
import {
  MetricEventType,
} from './types.js';
import type {
  MetricDataPoint,
  MetricCollector,
  HealthCheckMetrics,
} from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('performance-collector');

/**
 * Performance metrics data
 */
export interface PerformanceMetrics {
  avgPageCreationTime: number;
  avgPageDestructionTime: number;
  healthCheck: HealthCheckMetrics;
  browserLifetimes: {
    average: number;
    total: number[];
  };
}

/**
 * Collects performance-related metrics
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */
export class PerformanceMetricsCollector
  extends BaseMetricCollector
  implements MetricCollector<PerformanceMetrics>
{
  private pageCreationTimes: MetricDataPoint[] = [];
  private pageDestructionTimes: MetricDataPoint[] = [];
  private healthCheckDurations: MetricDataPoint[] = [];
  private healthCheckResults: boolean[] = [];
  private browserLifetimes: number[] = [];
  private browsersCreated = 0;
  private browsersDestroyed = 0;

  /**
   * Record page creation time
   * @nist au-3 "Content of audit records"
   */
  recordPageCreation(duration: number): void {
    this.addMetricDataPoint(this.pageCreationTimes, duration);
    logger.debug({ duration }, 'Page creation recorded');

    this.notify({
      type: MetricEventType.PAGE_CREATED,
      timestamp: new Date(),
      data: { duration },
    });
  }

  /**
   * Record page destruction time
   * @nist au-3 "Content of audit records"
   */
  recordPageDestruction(duration: number): void {
    this.addMetricDataPoint(this.pageDestructionTimes, duration);
    logger.debug({ duration }, 'Page destruction recorded');

    this.notify({
      type: MetricEventType.PAGE_DESTROYED,
      timestamp: new Date(),
      data: { duration },
    });
  }

  /**
   * Record health check performance
   * @nist si-4 "Information system monitoring"
   */
  recordHealthCheck(duration: number, success: boolean): void {
    this.addMetricDataPoint(this.healthCheckDurations, duration);
    this.healthCheckResults.push(success);
    this.limitArraySize(this.healthCheckResults);

    logger.debug({ duration, success }, 'Health check recorded');

    this.notify({
      type: MetricEventType.HEALTH_CHECK_COMPLETED,
      timestamp: new Date(),
      data: { duration, success },
    });
  }

  /**
   * Record browser creation
   * @nist au-3 "Content of audit records"
   */
  recordBrowserCreated(browserId: string, creationTime: number): void {
    this.browsersCreated++;
    logger.debug({ browserId, creationTime }, 'Browser created');

    this.notify({
      type: MetricEventType.BROWSER_CREATED,
      timestamp: new Date(),
      data: { browserId, creationTime },
    });
  }

  /**
   * Record browser destruction
   * @nist au-3 "Content of audit records"
   */
  recordBrowserDestroyed(browserId: string, lifetime: number): void {
    this.browsersDestroyed++;
    this.browserLifetimes.push(lifetime);
    this.limitArraySize(this.browserLifetimes);

    logger.debug({ browserId, lifetime }, 'Browser destroyed');

    this.notify({
      type: MetricEventType.BROWSER_DESTROYED,
      timestamp: new Date(),
      data: { browserId, lifetime },
    });
  }

  /**
   * Get browser creation count
   */
  getBrowsersCreated(): number {
    return this.browsersCreated;
  }

  /**
   * Get browser destruction count
   */
  getBrowsersDestroyed(): number {
    return this.browsersDestroyed;
  }

  /**
   * Collect performance metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  collect(): PerformanceMetrics {
    const avgPageCreationTime = this.calculateRecentAverage(this.pageCreationTimes);
    const avgPageDestructionTime = this.calculateRecentAverage(
      this.pageDestructionTimes
    );

    // Calculate health check metrics
    const successCount = this.healthCheckResults.filter((r) => r).length;
    const healthCheckMetrics: HealthCheckMetrics = {
      avgDuration: this.calculateRecentAverage(this.healthCheckDurations),
      lastDuration: this.getLastValue(this.healthCheckDurations),
      successRate:
        this.healthCheckResults.length > 0
          ? (successCount / this.healthCheckResults.length) * 100
          : 100,
      totalChecks: this.healthCheckResults.length,
    };

    return {
      avgPageCreationTime,
      avgPageDestructionTime,
      healthCheck: healthCheckMetrics,
      browserLifetimes: {
        average: this.calculateAverage(this.browserLifetimes),
        total: [...this.browserLifetimes],
      },
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.pageCreationTimes = [];
    this.pageDestructionTimes = [];
    this.healthCheckDurations = [];
    this.healthCheckResults = [];
    this.browserLifetimes = [];
    this.browsersCreated = 0;
    this.browsersDestroyed = 0;

    logger.info('Performance metrics reset');
  }
}