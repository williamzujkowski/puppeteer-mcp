/**
 * Performance metrics and timing for request/response logging
 * @module core/middleware/logging/performance-tracker
 * @nist au-8 "Time stamps"
 */

import { hrtime } from 'process';
import type { RequestTiming } from './types.js';

/**
 * Create initial timing object
 */
export const createTiming = (highPrecision: boolean = false): RequestTiming => {
  const timestamp = Date.now();
  return {
    startTime: highPrecision ? hrtime() : [0, 0],
    timestamp,
  };
};

/**
 * Calculate timing metrics
 * @nist au-8 "Time stamps"
 */
export const calculateTiming = (timing: RequestTiming): RequestTiming => {
  timing.endTime ??= hrtime();
  
  const diff = hrtime(timing.startTime);
  timing.duration = diff[0] * 1000 + diff[1] / 1000000; // Convert to milliseconds
  timing.ttfb = timing.duration; // For now, TTFB = total time
  
  return timing;
};

/**
 * Calculate duration from start time
 */
export const calculateDuration = (
  startTime: number,
  timing?: RequestTiming,
): number => {
  if (timing?.duration !== undefined) {
    return timing.duration;
  }
  
  return Date.now() - startTime;
};

/**
 * Round duration to specified decimal places
 */
export const roundDuration = (duration: number, decimals: number = 2): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(duration * factor) / factor;
};

/**
 * Format duration for human-readable display
 */
export const formatDuration = (duration: number): string => {
  if (duration < 1000) {
    return `${Math.round(duration)}ms`;
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(duration / 60000);
    const seconds = ((duration % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
};

/**
 * Performance metrics collector
 */
export class PerformanceTracker {
  private metrics: Map<string, number[]> = new Map();
  
  /**
   * Record a timing metric
   */
  record(key: string, duration: number): void {
    const existing = this.metrics.get(key) ?? [];
    existing.push(duration);
    this.metrics.set(key, existing);
  }
  
  /**
   * Get average for a metric
   */
  getAverage(key: string): number | null {
    const values = this.metrics.get(key);
    if (values === undefined || values === null || values.length === 0) return null;
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Get percentile for a metric
   */
  getPercentile(key: string, percentile: number): number | null {
    const values = this.metrics.get(key);
    if (values === undefined || values === null || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    // eslint-disable-next-line security/detect-object-injection
    return sorted[index] ?? null;
  }
  
  /**
   * Get summary statistics
   */
  getSummary(key: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(key);
    if (values === undefined || values === null || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    
    return {
      count,
      min: sorted[0] ?? 0,
      max: sorted[count - 1] ?? 0,
      avg: sum / count,
      p50: sorted[Math.floor(count * 0.5)] ?? 0,
      p95: sorted[Math.floor(count * 0.95)] ?? 0,
      p99: sorted[Math.floor(count * 0.99)] ?? 0,
    };
  }
  
  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics.clear();
  }
}

/**
 * Global performance tracker instance
 */
export const globalPerformanceTracker = new PerformanceTracker();