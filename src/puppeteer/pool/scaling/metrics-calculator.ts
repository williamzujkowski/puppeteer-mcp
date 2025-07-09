/**
 * Scaling metrics calculator
 * @module puppeteer/pool/scaling/metrics-calculator
 * @nist si-4 "Information system monitoring"
 */

import type { BrowserPoolOptions } from '../browser-pool-options.js';
import type { BrowserPoolMetrics as IMetrics } from '../browser-pool-metrics.js';
import type { ScalingMetrics, ScalingTrend } from './types.js';

/**
 * Calculates metrics for scaling decisions
 */
export class ScalingMetricsCalculator {
  private metricHistory: ScalingMetrics[] = [];
  private readonly historySize = 10;

  /**
   * Calculate current scaling metrics
   */
  calculateMetrics(poolMetrics: IMetrics, options: BrowserPoolOptions): ScalingMetrics {
    const metrics = poolMetrics.getPoolMetrics();
    const systemMetrics = poolMetrics.getSystemMetrics();

    const currentSize = metrics.pool.size;
    const targetSize = options.maxConcurrency ?? 5;
    const utilization = metrics.pool.utilization;
    const queueLength = metrics.queue.size;
    const errorRate = this.calculateErrorRate(metrics);
    const responseTime = metrics.performance.averageAcquireTime;
    const memoryUsage = systemMetrics.memory.heapUsed;
    const cpuUsage = systemMetrics.cpu;

    // Calculate resource pressure
    const memoryPressure = this.calculateMemoryPressure(systemMetrics);
    const cpuPressure = this.calculateCpuPressure(systemMetrics);

    // Calculate trend
    const trend = this.calculateTrend();

    const scalingMetrics: ScalingMetrics = {
      currentSize,
      targetSize,
      utilization,
      queueLength,
      errorRate,
      responseTime,
      memoryUsage,
      cpuUsage,
      memoryPressure,
      cpuPressure,
      trend,
    };

    this.addToHistory(scalingMetrics);
    return scalingMetrics;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(metrics: ReturnType<IMetrics['getPoolMetrics']>): number {
    const total = metrics.requests.total;
    const errors = metrics.errors.total;
    return total > 0 ? (errors / total) * 100 : 0;
  }

  /**
   * Calculate memory pressure
   */
  private calculateMemoryPressure(systemMetrics: ReturnType<IMetrics['getSystemMetrics']>): number {
    const heapUsed = systemMetrics.memory.heapUsed;
    const heapTotal = systemMetrics.memory.heapTotal;
    return heapTotal > 0 ? (heapUsed / heapTotal) * 100 : 0;
  }

  /**
   * Calculate CPU pressure
   */
  private calculateCpuPressure(systemMetrics: ReturnType<IMetrics['getSystemMetrics']>): number {
    return Math.min(systemMetrics.cpu, 100);
  }

  /**
   * Calculate utilization trend
   */
  private calculateTrend(): ScalingTrend {
    if (this.metricHistory.length < 3) {
      return 'stable';
    }

    const recentHistory = this.metricHistory.slice(-5);
    const avgUtilization =
      recentHistory.reduce((sum, m) => sum + m.utilization, 0) / recentHistory.length;
    const variance =
      recentHistory.reduce((sum, m) => sum + Math.pow(m.utilization - avgUtilization, 2), 0) /
      recentHistory.length;

    // High variance indicates volatility
    if (variance > 400) {
      // variance > 20^2
      return 'volatile';
    }

    // Check for trend
    const firstHalf = recentHistory.slice(0, Math.floor(recentHistory.length / 2));
    const secondHalf = recentHistory.slice(Math.floor(recentHistory.length / 2));

    const firstAvg = firstHalf.reduce((sum, m) => sum + m.utilization, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, m) => sum + m.utilization, 0) / secondHalf.length;

    if (secondAvg > firstAvg + 10) {
      return 'increasing';
    } else if (secondAvg < firstAvg - 10) {
      return 'decreasing';
    }

    return 'stable';
  }

  /**
   * Add metrics to history
   */
  private addToHistory(metrics: ScalingMetrics): void {
    this.metricHistory.push(metrics);
    if (this.metricHistory.length > this.historySize) {
      this.metricHistory.shift();
    }
  }

  /**
   * Get metric history
   */
  getHistory(): ReadonlyArray<ScalingMetrics> {
    return [...this.metricHistory];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.metricHistory = [];
  }
}
