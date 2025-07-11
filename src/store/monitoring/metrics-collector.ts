/**
 * Session metrics collection and aggregation
 * @module store/monitoring/metrics-collector
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { SessionMetrics, GetOperationMetrics, OperationRecord } from './types.js';
import { EventEmitter } from 'events';
import { pino } from 'pino';

/**
 * Metrics collector for session operations
 */
export class MetricsCollector extends EventEmitter {
  private _logger: pino.Logger;
  private metrics: SessionMetrics;

  constructor(storeType: string, logger?: pino.Logger) {
    super();
    this._logger = logger ?? pino({ level: 'info' });
    this.metrics = this.initializeMetrics(storeType);
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(storeType: string): SessionMetrics {
    return {
      operations: {
        create: { count: 0, avgLatency: 0, errors: 0 },
        get: { count: 0, avgLatency: 0, errors: 0, cacheMisses: 0 },
        update: { count: 0, avgLatency: 0, errors: 0 },
        delete: { count: 0, avgLatency: 0, errors: 0 },
        touch: { count: 0, avgLatency: 0, errors: 0 },
      },
      store: {
        type: storeType,
        available: true,
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
      },
      fallback: {
        activations: 0,
        totalFallbackTime: 0,
      },
    };
  }

  /**
   * Record operation metrics
   */
  recordOperation(record: OperationRecord): void {
    const { operation, latency, success, cacheMiss } = record;
    const opMetrics = this.metrics.operations[operation];

    // Update count
    opMetrics.count++;

    // Update average latency using incremental average formula
    opMetrics.avgLatency =
      (opMetrics.avgLatency * (opMetrics.count - 1) + latency) / opMetrics.count;

    // Update errors
    if (!success) {
      opMetrics.errors++;
    }

    // Update cache misses for get operations
    if (operation === 'get' && cacheMiss === true) {
      const getMetrics = opMetrics as GetOperationMetrics;
      getMetrics.cacheMisses++;
    }

    this.emit('operation:recorded', record);
  }

  /**
   * Record fallback activation
   */
  recordFallbackActivation(): void {
    this.metrics.fallback.activations++;
    this.metrics.fallback.lastActivation = new Date();
    this.emit('fallback:activated');
  }

  /**
   * Update fallback time
   */
  updateFallbackTime(duration: number): void {
    this.metrics.fallback.totalFallbackTime += duration;
  }

  /**
   * Update store metrics
   */
  updateStoreMetrics(update: Partial<SessionMetrics['store']>): void {
    Object.assign(this.metrics.store, update);
  }

  /**
   * Update Redis metrics
   */
  updateRedisMetrics(metrics: SessionMetrics['redis']): void {
    this.metrics.redis = metrics;
  }

  /**
   * Get current metrics
   */
  getMetrics(): SessionMetrics {
    return JSON.parse(JSON.stringify(this.metrics)) as SessionMetrics;
  }

  /**
   * Get operation error rate
   */
  getOperationErrorRate(operation: keyof SessionMetrics['operations']): number {
    const opMetrics = this.metrics.operations[operation];
    if (opMetrics.count === 0) {
      return 0;
    }
    return opMetrics.errors / opMetrics.count;
  }

  /**
   * Get cache hit rate for get operations
   */
  getCacheHitRate(): number {
    const getMetrics = this.metrics.operations.get;
    if (getMetrics.count === 0) {
      return 1; // Assume 100% hit rate if no operations
    }
    return 1 - getMetrics.cacheMisses / getMetrics.count;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    const storeType = this.metrics.store.type;
    this.metrics = this.initializeMetrics(storeType);
    this.emit('metrics:reset');
  }

  /**
   * Generate summary statistics
   */
  getSummaryStats(): {
    totalOperations: number;
    totalErrors: number;
    overallErrorRate: number;
    avgLatencyAcrossOps: number;
    cacheHitRate: number;
  } {
    let totalOperations = 0;
    let totalErrors = 0;
    let totalLatency = 0;

    Object.values(this.metrics.operations).forEach((opMetrics) => {
      totalOperations += opMetrics.count;
      totalErrors += opMetrics.errors;
      totalLatency += opMetrics.avgLatency * opMetrics.count;
    });

    return {
      totalOperations,
      totalErrors,
      overallErrorRate: totalOperations > 0 ? totalErrors / totalOperations : 0,
      avgLatencyAcrossOps: totalOperations > 0 ? totalLatency / totalOperations : 0,
      cacheHitRate: this.getCacheHitRate(),
    };
  }
}
