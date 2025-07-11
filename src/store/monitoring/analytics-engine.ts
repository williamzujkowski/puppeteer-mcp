/**
 * Session analytics and trend analysis
 * @module store/monitoring/analytics-engine
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type {
  SessionMetrics,
  MetricsHistoryEntry,
  UptimeStats
} from './types.js';
import {
  calculateTrend,
  findPeak,
  getAvgLatency,
  getErrorRate,
  getTotalOps
} from './trend-calculator.js';
import { pino } from 'pino';

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  period: { start: Date; end: Date };
  trends: {
    latency: { direction: 'up' | 'down' | 'stable'; change: number };
    errors: { direction: 'up' | 'down' | 'stable'; change: number };
    usage: { direction: 'up' | 'down' | 'stable'; change: number };
  };
  peaks: {
    latency: { value: number; timestamp: Date };
    errors: { value: number; timestamp: Date };
    usage: { value: number; timestamp: Date };
  };
}

/**
 * Analytics engine for session monitoring
 */
export class AnalyticsEngine {
  private _logger: pino.Logger;
  private metricsHistory: MetricsHistoryEntry[] = [];
  private startTime: number;

  constructor(logger?: pino.Logger) {
    this._logger = logger ?? pino({ level: 'info' });
    this.startTime = Date.now();
  }

  /**
   * Add metrics to history
   */
  addMetricsSnapshot(metrics: SessionMetrics): void {
    this.metricsHistory.push({
      timestamp: new Date(),
      metrics: JSON.parse(JSON.stringify(metrics))
    });
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(since?: Date): MetricsHistoryEntry[] {
    if (since) {
      return this.metricsHistory.filter(entry => entry.timestamp >= since);
    }
    return [...this.metricsHistory];
  }

  /**
   * Analyze trends over time
   */
  analyzeTrends(periodMinutes: number = 60): TrendAnalysis {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodMinutes * 60 * 1000);
    
    const periodMetrics = this.metricsHistory.filter(
      entry => entry.timestamp >= periodStart
    );

    if (periodMetrics.length < 2) {
      return this.getEmptyTrendAnalysis(periodStart, now);
    }

    // Calculate trends
    const latencyTrend = this.calculateLatencyTrend(periodMetrics);
    const errorTrend = this.calculateErrorTrend(periodMetrics);
    const usageTrend = this.calculateUsageTrend(periodMetrics);

    // Find peaks
    const latencyPeak = this.findLatencyPeak(periodMetrics);
    const errorPeak = this.findErrorPeak(periodMetrics);
    const usagePeak = this.findUsagePeak(periodMetrics);

    return {
      period: { start: periodStart, end: now },
      trends: {
        latency: latencyTrend,
        errors: errorTrend,
        usage: usageTrend
      },
      peaks: {
        latency: latencyPeak,
        errors: errorPeak,
        usage: usagePeak
      }
    };
  }

  /**
   * Get uptime statistics
   */
  getUptimeStats(): UptimeStats {
    const uptime = Date.now() - this.startTime;
    
    // Calculate availability based on health checks
    const totalChecks = this.metricsHistory.length;
    const availableChecks = this.metricsHistory.filter(
      entry => entry.metrics.store.available
    ).length;
    
    const availability = totalChecks > 0 ? availableChecks / totalChecks : 1;

    return {
      startTime: new Date(this.startTime),
      uptime,
      availability
    };
  }

  /**
   * Calculate latency trend
   */
  private calculateLatencyTrend(
    metrics: MetricsHistoryEntry[]
  ): { direction: 'up' | 'down' | 'stable'; change: number } {
    const avgLatencies = metrics.map(entry => getAvgLatency(entry));
    return calculateTrend(avgLatencies);
  }

  /**
   * Calculate error trend
   */
  private calculateErrorTrend(
    metrics: MetricsHistoryEntry[]
  ): { direction: 'up' | 'down' | 'stable'; change: number } {
    const errorRates = metrics.map(entry => getErrorRate(entry));
    return calculateTrend(errorRates);
  }

  /**
   * Calculate usage trend
   */
  private calculateUsageTrend(
    metrics: MetricsHistoryEntry[]
  ): { direction: 'up' | 'down' | 'stable'; change: number } {
    const usageCounts = metrics.map(entry => getTotalOps(entry));
    return calculateTrend(usageCounts);
  }

  /**
   * Find latency peak
   */
  private findLatencyPeak(
    metrics: MetricsHistoryEntry[]
  ): { value: number; timestamp: Date } {
    return findPeak(metrics, entry => {
      let max = 0;
      Object.values(entry.metrics.operations).forEach(op => {
        max = Math.max(max, op.avgLatency);
      });
      return max;
    });
  }

  /**
   * Find error peak
   */
  private findErrorPeak(
    metrics: MetricsHistoryEntry[]
  ): { value: number; timestamp: Date } {
    return findPeak(metrics, entry => getErrorRate(entry));
  }

  /**
   * Find usage peak
   */
  private findUsagePeak(
    metrics: MetricsHistoryEntry[]
  ): { value: number; timestamp: Date } {
    return findPeak(metrics, entry => getTotalOps(entry));
  }

  /**
   * Get empty trend analysis
   */
  private getEmptyTrendAnalysis(start: Date, end: Date): TrendAnalysis {
    return {
      period: { start, end },
      trends: {
        latency: { direction: 'stable', change: 0 },
        errors: { direction: 'stable', change: 0 },
        usage: { direction: 'stable', change: 0 }
      },
      peaks: {
        latency: { value: 0, timestamp: new Date() },
        errors: { value: 0, timestamp: new Date() },
        usage: { value: 0, timestamp: new Date() }
      }
    };
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(retentionPeriod: number): void {
    const cutoffTime = Date.now() - retentionPeriod;
    this.metricsHistory = this.metricsHistory.filter(
      entry => entry.timestamp.getTime() > cutoffTime
    );
  }

  /**
   * Reset analytics
   */
  reset(): void {
    this.metricsHistory = [];
    this.startTime = Date.now();
  }
}