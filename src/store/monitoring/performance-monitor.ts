/**
 * Session performance monitoring
 * @module store/monitoring/performance-monitor
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { SessionMetrics, ExportedMetrics } from './types.js';
import { pino } from 'pino';

/**
 * Performance metrics for monitoring
 */
export interface PerformanceMetrics {
  latency: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  throughput: {
    rps: number; // requests per second
    peak: number;
  };
  saturation: {
    queueDepth: number;
    concurrency: number;
  };
}

/**
 * Performance monitor for session operations
 */
export class PerformanceMonitor {
  private _logger: pino.Logger;
  private latencyBuckets: number[] = [];
  private operationTimestamps: number[] = [];
  private readonly bucketSize = 1000; // Keep last 1000 operations

  constructor(logger?: pino.Logger) {
    this._logger = logger ?? pino({ level: 'info' });
  }

  /**
   * Record operation latency
   */
  recordLatency(latency: number): void {
    this.latencyBuckets.push(latency);
    this.operationTimestamps.push(Date.now());

    // Keep only recent data
    if (this.latencyBuckets.length > this.bucketSize) {
      this.latencyBuckets.shift();
      this.operationTimestamps.shift();
    }
  }

  /**
   * Calculate performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return {
      latency: this.calculateLatencyPercentiles(),
      throughput: this.calculateThroughput(),
      saturation: {
        queueDepth: 0, // Placeholder - would need queue implementation
        concurrency: 0 // Placeholder - would need concurrency tracking
      }
    };
  }

  /**
   * Calculate latency percentiles
   */
  private calculateLatencyPercentiles(): PerformanceMetrics['latency'] {
    if (this.latencyBuckets.length === 0) {
      return { p50: 0, p95: 0, p99: 0, max: 0 };
    }

    const sorted = [...this.latencyBuckets].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)] ?? 0,
      p95: sorted[Math.floor(len * 0.95)] ?? 0,
      p99: sorted[Math.floor(len * 0.99)] ?? 0,
      max: sorted[len - 1] ?? 0
    };
  }

  /**
   * Calculate throughput metrics
   */
  private calculateThroughput(): PerformanceMetrics['throughput'] {
    if (this.operationTimestamps.length < 2) {
      return { rps: 0, peak: 0 };
    }

    const oneMinuteAgo = Date.now() - 60000;
    const recentOps = this.operationTimestamps.filter(ts => ts > oneMinuteAgo);
    const rps = recentOps.length / 60;
    const peak = this.calculatePeakRPS();

    return { rps, peak };
  }

  /**
   * Calculate peak RPS
   */
  private calculatePeakRPS(): number {
    let peak = 0;
    for (let i = 0; i < this.operationTimestamps.length; i++) {
      const windowStart = this.operationTimestamps[i];
      if (windowStart !== undefined) {
        const windowEnd = windowStart + 1000;
        const opsInWindow = this.operationTimestamps.filter(
          ts => ts >= windowStart && ts < windowEnd
        ).length;
        peak = Math.max(peak, opsInWindow);
      }
    }
    return peak;
  }

  /**
   * Export metrics in various formats
   */
  exportMetrics(metrics: SessionMetrics): ExportedMetrics {
    const prometheusMetrics = this.generatePrometheusMetrics(metrics);
    
    return {
      prometheus: prometheusMetrics,
      json: metrics
    };
  }

  /**
   * Generate Prometheus-compatible metrics
   */
  private generatePrometheusMetrics(metrics: SessionMetrics): string {
    const lines: string[] = [];

    // Operation metrics
    for (const [operation, opMetrics] of Object.entries(metrics.operations)) {
      lines.push(`# HELP session_operation_total Total number of session operations`);
      lines.push(`# TYPE session_operation_total counter`);
      lines.push(`session_operation_total{operation="${operation}"} ${opMetrics.count}`);

      lines.push(`# HELP session_operation_latency_seconds Average latency of session operations`);
      lines.push(`# TYPE session_operation_latency_seconds gauge`);
      lines.push(`session_operation_latency_seconds{operation="${operation}"} ${opMetrics.avgLatency / 1000}`);

      lines.push(`# HELP session_operation_errors_total Total number of session operation errors`);
      lines.push(`# TYPE session_operation_errors_total counter`);
      lines.push(`session_operation_errors_total{operation="${operation}"} ${opMetrics.errors}`);
    }

    // Store metrics
    lines.push(`# HELP session_store_available Whether the session store is available`);
    lines.push(`# TYPE session_store_available gauge`);
    lines.push(`session_store_available{type="${metrics.store.type}"} ${metrics.store.available ? 1 : 0}`);

    lines.push(`# HELP session_store_total_sessions Total number of sessions in store`);
    lines.push(`# TYPE session_store_total_sessions gauge`);
    lines.push(`session_store_total_sessions{type="${metrics.store.type}"} ${metrics.store.totalSessions}`);

    lines.push(`# HELP session_store_active_sessions Number of active sessions in store`);
    lines.push(`# TYPE session_store_active_sessions gauge`);
    lines.push(`session_store_active_sessions{type="${metrics.store.type}"} ${metrics.store.activeSessions}`);

    // Redis metrics
    if (metrics.redis) {
      lines.push(`# HELP redis_available Whether Redis is available`);
      lines.push(`# TYPE redis_available gauge`);
      lines.push(`redis_available ${metrics.redis.available ? 1 : 0}`);

      if (metrics.redis.keyCount !== undefined) {
        lines.push(`# HELP redis_keys_total Total number of keys in Redis`);
        lines.push(`# TYPE redis_keys_total gauge`);
        lines.push(`redis_keys_total ${metrics.redis.keyCount}`);
      }

      if (metrics.redis.memoryUsage !== undefined) {
        lines.push(`# HELP redis_memory_usage_bytes Memory usage of Redis`);
        lines.push(`# TYPE redis_memory_usage_bytes gauge`);
        lines.push(`redis_memory_usage_bytes ${metrics.redis.memoryUsage}`);
      }
    }

    // Fallback metrics
    lines.push(`# HELP session_fallback_activations_total Total number of fallback activations`);
    lines.push(`# TYPE session_fallback_activations_total counter`);
    lines.push(`session_fallback_activations_total ${metrics.fallback.activations}`);

    // Performance metrics
    const perfMetrics = this.getPerformanceMetrics();
    
    lines.push(`# HELP session_latency_p50_seconds 50th percentile latency`);
    lines.push(`# TYPE session_latency_p50_seconds gauge`);
    lines.push(`session_latency_p50_seconds ${perfMetrics.latency.p50 / 1000}`);

    lines.push(`# HELP session_latency_p95_seconds 95th percentile latency`);
    lines.push(`# TYPE session_latency_p95_seconds gauge`);
    lines.push(`session_latency_p95_seconds ${perfMetrics.latency.p95 / 1000}`);

    lines.push(`# HELP session_latency_p99_seconds 99th percentile latency`);
    lines.push(`# TYPE session_latency_p99_seconds gauge`);
    lines.push(`session_latency_p99_seconds ${perfMetrics.latency.p99 / 1000}`);

    lines.push(`# HELP session_throughput_rps Requests per second`);
    lines.push(`# TYPE session_throughput_rps gauge`);
    lines.push(`session_throughput_rps ${perfMetrics.throughput.rps}`);

    return lines.join('\n');
  }

  /**
   * Reset performance data
   */
  reset(): void {
    this.latencyBuckets = [];
    this.operationTimestamps = [];
  }
}