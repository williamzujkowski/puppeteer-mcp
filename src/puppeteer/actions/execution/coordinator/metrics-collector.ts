/**
 * Metrics collection and monitoring module
 * @module puppeteer/actions/execution/coordinator/metrics-collector
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist au-7 "Audit reduction and report generation"
 */

import type {
  BrowserAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import { MetricsAggregator } from './metrics/metrics-aggregator.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:metrics-collector');

/**
 * Action execution metrics
 */
export interface ActionMetrics {
  actionType: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: string;
  retryCount?: number;
  pageId: string;
  sessionId: string;
  contextId: string;
}

/**
 * Aggregated metrics
 */
export interface AggregatedMetrics {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  averageDuration: number;
  actionTypeBreakdown: Record<string, number>;
  errorTypeBreakdown: Record<string, number>;
  performanceMetrics: {
    p50Duration: number;
    p90Duration: number;
    p99Duration: number;
  };
}

/**
 * Collects and aggregates action execution metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class MetricsCollector {
  private readonly activeMetrics: Map<string, ActionMetrics> = new Map();
  private readonly completedMetrics: ActionMetrics[] = [];
  private readonly maxStoredMetrics = 10000;
  private readonly aggregator: MetricsAggregator;

  constructor() {
    this.aggregator = new MetricsAggregator();
  }

  /**
   * Record action execution start
   * @param action - Browser action
   * @param context - Execution context
   */
  recordExecutionStart(action: BrowserAction, context: ActionContext): void {
    const metricId = this.generateMetricId(action, context);
    const metric: ActionMetrics = {
      actionType: action.type,
      startTime: Date.now(),
      pageId: action.pageId,
      sessionId: context.sessionId,
      contextId: context.contextId,
    };

    this.activeMetrics.set(metricId, metric);

    logger.debug('Recording execution start', {
      metricId,
      actionType: action.type,
      sessionId: context.sessionId,
    });
  }

  /**
   * Record action execution end
   * @param action - Browser action
   * @param context - Execution context
   * @param result - Action result
   */
  recordExecutionEnd(
    action: BrowserAction,
    context: ActionContext,
    result: ActionResult,
  ): void {
    const metricId = this.generateMetricId(action, context);
    const metric = this.activeMetrics.get(metricId);

    if (!metric) {
      logger.warn('No active metric found for execution end', {
        metricId,
        actionType: action.type,
      });
      return;
    }

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.success = result.success;
    metric.error = result.error;

    this.activeMetrics.delete(metricId);
    this.storeCompletedMetric(metric);

    logger.debug('Recording execution end', {
      metricId,
      actionType: action.type,
      duration: metric.duration,
      success: metric.success,
    });
  }

  /**
   * Record retry attempt
   * @param action - Browser action
   * @param context - Execution context
   * @param retryCount - Current retry count
   */
  recordRetryAttempt(
    action: BrowserAction,
    context: ActionContext,
    retryCount: number,
  ): void {
    const metricId = this.generateMetricId(action, context);
    const metric = this.activeMetrics.get(metricId);

    if (metric) {
      metric.retryCount = retryCount;
    }
  }

  /**
   * Get aggregated metrics
   * @param context - Optional context filter
   * @param options - Query options
   * @returns Aggregated metrics
   */
  getAggregatedMetrics(
    context?: ActionContext,
    options?: {
      startDate?: Date;
      endDate?: Date;
      actionTypes?: string[];
    },
  ): AggregatedMetrics {
    const filteredMetrics = this.aggregator.filterMetrics(
      this.completedMetrics,
      context,
      options,
    );

    return this.aggregator.aggregate(filteredMetrics);
  }

  /**
   * Get metrics for specific session
   * @param sessionId - Session identifier
   * @returns Session metrics
   */
  getSessionMetrics(sessionId: string): ActionMetrics[] {
    return this.completedMetrics.filter(m => m.sessionId === sessionId);
  }

  /**
   * Get metrics by action type
   * @param actionType - Action type
   * @param limit - Maximum number of metrics
   * @returns Action type metrics
   */
  getActionTypeMetrics(actionType: string, limit = 100): ActionMetrics[] {
    return this.completedMetrics
      .filter(m => m.actionType === actionType)
      .slice(-limit);
  }

  /**
   * Get recent errors
   * @param limit - Maximum number of errors
   * @returns Recent error metrics
   */
  getRecentErrors(limit = 50): ActionMetrics[] {
    return this.completedMetrics
      .filter(m => !m.success)
      .slice(-limit);
  }

  /**
   * Clear old metrics
   * @param before - Clear metrics before this date
   */
  clearMetrics(before?: Date): void {
    if (!before) {
      this.completedMetrics.length = 0;
      this.activeMetrics.clear();
      return;
    }

    const cutoffTime = before.getTime();
    const metricsToKeep = this.completedMetrics.filter(
      m => m.startTime >= cutoffTime
    );

    this.completedMetrics.length = 0;
    this.completedMetrics.push(...metricsToKeep);
  }

  /**
   * Get collector statistics
   * @returns Collector stats
   */
  getCollectorStats(): {
    activeMetrics: number;
    completedMetrics: number;
    maxStoredMetrics: number;
    oldestMetricAge: number | null;
  } {
    const oldestMetric = this.completedMetrics[0];
    const oldestMetricAge = oldestMetric
      ? Date.now() - oldestMetric.startTime
      : null;

    return {
      activeMetrics: this.activeMetrics.size,
      completedMetrics: this.completedMetrics.length,
      maxStoredMetrics: this.maxStoredMetrics,
      oldestMetricAge,
    };
  }

  /**
   * Export metrics as JSON
   * @param context - Optional context filter
   * @returns Metrics JSON
   */
  exportMetrics(context?: ActionContext): string {
    const metrics = context
      ? this.completedMetrics.filter(m => 
          m.sessionId === context.sessionId &&
          m.contextId === context.contextId
        )
      : this.completedMetrics;

    return JSON.stringify(metrics, null, 2);
  }

  /**
   * Generate metric ID
   * @param action - Browser action
   * @param context - Execution context
   * @returns Metric identifier
   */
  private generateMetricId(action: BrowserAction, context: ActionContext): string {
    return `${context.sessionId}-${context.contextId}-${action.type}-${Date.now()}`;
  }

  /**
   * Store completed metric
   * @param metric - Action metric
   */
  private storeCompletedMetric(metric: ActionMetrics): void {
    this.completedMetrics.push(metric);

    // Enforce size limit
    if (this.completedMetrics.length > this.maxStoredMetrics) {
      const toRemove = this.completedMetrics.length - this.maxStoredMetrics;
      this.completedMetrics.splice(0, toRemove);
    }
  }

  /**
   * Get internal components for testing
   * @internal
   */
  getInternalComponents(): {
    aggregator: MetricsAggregator;
    activeMetrics: Map<string, ActionMetrics>;
    completedMetrics: ActionMetrics[];
  } {
    return {
      aggregator: this.aggregator,
      activeMetrics: this.activeMetrics,
      completedMetrics: this.completedMetrics,
    };
  }
}