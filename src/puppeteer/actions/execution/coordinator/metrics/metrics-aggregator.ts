/**
 * Metrics aggregation utilities
 * @module puppeteer/actions/execution/coordinator/metrics/metrics-aggregator
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist au-7 "Audit reduction and report generation"
 */

import type { ActionMetrics, AggregatedMetrics } from '../metrics-collector.js';
import type { ActionContext } from '../../../../interfaces/action-executor.interface.js';

/**
 * Aggregates action execution metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class MetricsAggregator {
  /**
   * Aggregate metrics from array
   * @param metrics - Array of metrics
   * @returns Aggregated metrics
   */
  aggregate(metrics: ActionMetrics[]): AggregatedMetrics {
    if (metrics.length === 0) {
      return this.createEmptyMetrics();
    }

    const totalActions = metrics.length;
    const successfulActions = metrics.filter((m) => m.success).length;
    const failedActions = totalActions - successfulActions;

    const durations = metrics.filter((m) => m.duration !== undefined).map((m) => m.duration!);

    const averageDuration =
      durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;

    const actionTypeBreakdown = this.calculateActionTypeBreakdown(metrics);
    const errorTypeBreakdown = this.calculateErrorTypeBreakdown(metrics);
    const performanceMetrics = this.calculatePerformanceMetrics(durations);

    return {
      totalActions,
      successfulActions,
      failedActions,
      averageDuration,
      actionTypeBreakdown,
      errorTypeBreakdown,
      performanceMetrics,
    };
  }

  /**
   * Filter metrics based on criteria
   * @param metrics - All metrics
   * @param context - Optional context filter
   * @param options - Query options
   * @returns Filtered metrics
   */
  filterMetrics(
    metrics: ActionMetrics[],
    context?: ActionContext,
    options?: {
      startDate?: Date;
      endDate?: Date;
      actionTypes?: string[];
    },
  ): ActionMetrics[] {
    let filtered = [...metrics];

    if (context) {
      filtered = filtered.filter(
        (m) => m.sessionId === context.sessionId && m.contextId === context.contextId,
      );
    }

    if (options?.startDate) {
      const startTime = options.startDate.getTime();
      filtered = filtered.filter((m) => m.startTime >= startTime);
    }

    if (options?.endDate) {
      const endTime = options.endDate.getTime();
      filtered = filtered.filter((m) => m.startTime <= endTime);
    }

    if (options?.actionTypes && options.actionTypes.length > 0) {
      filtered = filtered.filter((m) => options.actionTypes!.includes(m.actionType));
    }

    return filtered;
  }

  /**
   * Calculate action type breakdown
   * @param metrics - Action metrics
   * @returns Action type counts
   */
  private calculateActionTypeBreakdown(metrics: ActionMetrics[]): Record<string, number> {
    const breakdown: Record<string, number> = {};

    for (const metric of metrics) {
      breakdown[metric.actionType] = (breakdown[metric.actionType] ?? 0) + 1;
    }

    return breakdown;
  }

  /**
   * Calculate error type breakdown
   * @param metrics - Action metrics
   * @returns Error type counts
   */
  private calculateErrorTypeBreakdown(metrics: ActionMetrics[]): Record<string, number> {
    const breakdown: Record<string, number> = {};

    for (const metric of metrics) {
      if (!metric.success && metric.error) {
        const errorType = this.classifyError(metric.error);
        breakdown[errorType] = (breakdown[errorType] ?? 0) + 1;
      }
    }

    return breakdown;
  }

  /**
   * Calculate performance percentiles
   * @param durations - Duration values
   * @returns Performance metrics
   */
  private calculatePerformanceMetrics(durations: number[]): {
    p50Duration: number;
    p90Duration: number;
    p99Duration: number;
  } {
    if (durations.length === 0) {
      return { p50Duration: 0, p90Duration: 0, p99Duration: 0 };
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p90Index = Math.floor(sorted.length * 0.9);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      p50Duration: sorted[p50Index] ?? 0,
      p90Duration: sorted[p90Index] ?? 0,
      p99Duration: sorted[p99Index] ?? 0,
    };
  }

  /**
   * Classify error type
   * @param error - Error message
   * @returns Error classification
   */
  private classifyError(error: string): string {
    const lowerError = error.toLowerCase();

    if (lowerError.includes('timeout')) return 'TIMEOUT';
    if (lowerError.includes('network')) return 'NETWORK';
    if (lowerError.includes('permission') || lowerError.includes('access')) return 'PERMISSION';
    if (lowerError.includes('validation')) return 'VALIDATION';
    if (lowerError.includes('not found')) return 'NOT_FOUND';

    return 'OTHER';
  }

  /**
   * Create empty metrics object
   * @returns Empty metrics
   */
  private createEmptyMetrics(): AggregatedMetrics {
    return {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      averageDuration: 0,
      actionTypeBreakdown: {},
      errorTypeBreakdown: {},
      performanceMetrics: {
        p50Duration: 0,
        p90Duration: 0,
        p99Duration: 0,
      },
    };
  }

  /**
   * Calculate success rate
   * @param metrics - Aggregated metrics
   * @returns Success rate percentage
   */
  calculateSuccessRate(metrics: AggregatedMetrics): number {
    if (metrics.totalActions === 0) {
      return 0;
    }
    return Math.round((metrics.successfulActions / metrics.totalActions) * 100);
  }

  /**
   * Get top error types
   * @param metrics - Aggregated metrics
   * @param limit - Maximum number of error types
   * @returns Top error types
   */
  getTopErrorTypes(metrics: AggregatedMetrics, limit = 5): Array<{ type: string; count: number }> {
    return Object.entries(metrics.errorTypeBreakdown)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get top action types
   * @param metrics - Aggregated metrics
   * @param limit - Maximum number of action types
   * @returns Top action types
   */
  getTopActionTypes(
    metrics: AggregatedMetrics,
    limit = 10,
  ): Array<{ type: string; count: number }> {
    return Object.entries(metrics.actionTypeBreakdown)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}
