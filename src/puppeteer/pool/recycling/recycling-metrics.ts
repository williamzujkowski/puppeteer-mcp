/**
 * Metrics collection for recycling operations
 * @module puppeteer/pool/recycling/recycling-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { createLogger } from '../../../utils/logger.js';
import type { RecyclingEvent, RecyclingReason, RecyclingStats } from './types.js';

const logger = createLogger('recycling-metrics');

/**
 * Recycling metrics collector
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class RecyclingMetricsCollector {
  private recyclingHistory: RecyclingEvent[] = [];
  private readonly maxHistorySize: number;

  constructor(maxHistorySize: number = 500) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Add recycling event to history
   */
  addRecyclingEvent(event: RecyclingEvent): void {
    this.recyclingHistory.push(event);

    // Maintain maximum history size
    if (this.recyclingHistory.length > this.maxHistorySize) {
      this.recyclingHistory.shift();
    }

    logger.debug(
      {
        browserId: event.browserId,
        reason: event.reason,
        success: event.success,
        executionTimeMs: event.executionTimeMs,
      },
      'Recycling event recorded'
    );
  }

  /**
   * Get recycling statistics
   */
  getRecyclingStats(): RecyclingStats {
    const totalRecycled = this.recyclingHistory.length;
    const successfulRecycling = this.recyclingHistory.filter(e => e.success).length;
    const successRate = totalRecycled > 0 ? (successfulRecycling / totalRecycled) * 100 : 0;
    
    const avgExecutionTime = totalRecycled > 0 
      ? this.recyclingHistory.reduce((sum, e) => sum + e.executionTimeMs, 0) / totalRecycled
      : 0;

    const reasonBreakdown = this.calculateReasonBreakdown();
    const recentEvents = this.recyclingHistory.slice(-20);

    return {
      totalRecycled,
      successRate,
      avgExecutionTime,
      reasonBreakdown,
      recentEvents,
    };
  }

  /**
   * Get recycling history
   */
  getRecyclingHistory(): RecyclingEvent[] {
    return [...this.recyclingHistory];
  }

  /**
   * Get events by time range
   */
  getEventsByTimeRange(startTime: Date, endTime: Date): RecyclingEvent[] {
    return this.recyclingHistory.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * Get events by reason
   */
  getEventsByReason(reason: RecyclingReason): RecyclingEvent[] {
    return this.recyclingHistory.filter(event => event.reason === reason);
  }

  /**
   * Get failure analysis
   */
  getFailureAnalysis(): {
    totalFailures: number;
    failureRate: number;
    failuresByReason: Record<RecyclingReason, number>;
    avgFailureExecutionTime: number;
  } {
    const failures = this.recyclingHistory.filter(e => !e.success);
    const totalFailures = failures.length;
    const failureRate = this.recyclingHistory.length > 0
      ? (totalFailures / this.recyclingHistory.length) * 100
      : 0;

    const failuresByReason = {} as Record<RecyclingReason, number>;
    for (const event of failures) {
      const reason = event.reason;
      // eslint-disable-next-line security/detect-object-injection
      failuresByReason[reason] = (failuresByReason[reason] ?? 0) + 1;
    }

    const avgFailureExecutionTime = totalFailures > 0
      ? failures.reduce((sum, e) => sum + e.executionTimeMs, 0) / totalFailures
      : 0;

    return {
      totalFailures,
      failureRate,
      failuresByReason,
      avgFailureExecutionTime,
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    fastestRecycling: number;
    slowestRecycling: number;
    medianExecutionTime: number;
    p95ExecutionTime: number;
  } {
    if (this.recyclingHistory.length === 0) {
      return {
        fastestRecycling: 0,
        slowestRecycling: 0,
        medianExecutionTime: 0,
        p95ExecutionTime: 0,
      };
    }

    const executionTimes = this.recyclingHistory
      .map(e => e.executionTimeMs)
      .sort((a, b) => a - b);

    const fastestRecycling = executionTimes[0] ?? 0;
    const slowestRecycling = executionTimes[executionTimes.length - 1] ?? 0;
    const medianExecutionTime = this.calculateMedian(executionTimes);
    const p95ExecutionTime = this.calculatePercentile(executionTimes, 95);

    return {
      fastestRecycling,
      slowestRecycling,
      medianExecutionTime,
      p95ExecutionTime,
    };
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.recyclingHistory = [];
    logger.info('Recycling metrics history cleared');
  }

  /**
   * Calculate reason breakdown
   * @private
   */
  private calculateReasonBreakdown(): Record<RecyclingReason, number> {
    const breakdown = {} as Record<RecyclingReason, number>;
    
    for (const event of this.recyclingHistory) {
      const reason = event.reason;
      // eslint-disable-next-line security/detect-object-injection
      breakdown[reason] = (breakdown[reason] ?? 0) + 1;
    }

    return breakdown;
  }

  /**
   * Calculate median value
   * @private
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mid = Math.floor(values.length / 2);
    
    if (values.length % 2 === 0) {
      return ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2;
    }
    
    return values[mid] ?? 0;
  }

  /**
   * Calculate percentile value
   * @private
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.min(index, values.length - 1)] ?? 0;
  }
}