/**
 * Trend calculation utilities
 * @module store/monitoring/trend-calculator
 */

import type { MetricsHistoryEntry } from './types.js';

export interface TrendResult {
  direction: 'up' | 'down' | 'stable';
  change: number;
}

export interface PeakResult {
  value: number;
  timestamp: Date;
}

/**
 * Calculate trend from values
 */
export function calculateTrend(values: number[]): TrendResult {
  if (values.length < 2) {
    return { direction: 'stable', change: 0 };
  }

  const mid = Math.floor(values.length / 2);
  const firstAvg = average(values.slice(0, mid));
  const secondAvg = average(values.slice(mid));

  const change = firstAvg > 0 ? (secondAvg - firstAvg) / firstAvg : 0;
  const threshold = 0.1; // 10% change threshold

  if (change > threshold) return { direction: 'up', change };
  if (change < -threshold) return { direction: 'down', change };
  return { direction: 'stable', change };
}

/**
 * Find peak value in metrics
 */
export function findPeak(
  metrics: MetricsHistoryEntry[],
  getValue: (entry: MetricsHistoryEntry) => number
): PeakResult {
  let maxValue = 0;
  let peakTimestamp = new Date();

  metrics.forEach(entry => {
    const value = getValue(entry);
    if (value > maxValue) {
      maxValue = value;
      peakTimestamp = entry.timestamp;
    }
  });

  return { value: maxValue, timestamp: peakTimestamp };
}

/**
 * Calculate average latency from entry
 */
export function getAvgLatency(entry: MetricsHistoryEntry): number {
  const ops = entry.metrics.operations;
  const totalOps = getTotalOps(entry);
  const totalLatency = Object.values(ops).reduce(
    (sum, op) => sum + op.avgLatency * op.count,
    0
  );
  return totalOps > 0 ? totalLatency / totalOps : 0;
}

/**
 * Calculate error rate from entry
 */
export function getErrorRate(entry: MetricsHistoryEntry): number {
  const ops = entry.metrics.operations;
  const totalOps = getTotalOps(entry);
  const totalErrors = Object.values(ops).reduce((sum, op) => sum + op.errors, 0);
  return totalOps > 0 ? totalErrors / totalOps : 0;
}

/**
 * Get total operations from entry
 */
export function getTotalOps(entry: MetricsHistoryEntry): number {
  return Object.values(entry.metrics.operations)
    .reduce((sum, op) => sum + op.count, 0);
}

/**
 * Calculate average of values
 */
export function average(values: number[]): number {
  return values.length > 0 
    ? values.reduce((a, b) => a + b, 0) / values.length 
    : 0;
}