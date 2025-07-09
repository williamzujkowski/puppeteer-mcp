/**
 * Metrics and monitoring for circuit breaker
 * @module puppeteer/pool/circuit-breaker/metrics-monitor
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */

import { EventEmitter } from 'events';
import { CircuitBreakerMetrics, CircuitBreakerState } from './types.js';
import { createLogger } from '../../../utils/logger.js';

// Re-export performance monitor from separate file
export { PerformanceMonitor, DEFAULT_PERFORMANCE_THRESHOLDS } from './performance-monitor.js';
export type { PerformanceThresholds } from './performance-monitor.js';

const logger = createLogger('circuit-breaker-metrics');

/**
 * Metrics collector for circuit breaker
 * @nist au-3 "Content of audit records"
 */
export class MetricsCollector extends EventEmitter {
  private failures: Date[] = [];
  private successes: Date[] = [];
  private requests: Date[] = [];
  private responseTimes: number[] = [];
  private readonly maxResponseTimeHistory = 50;
  private readonly cleanupInterval = 60000; // 1 minute
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private name: string,
    private timeWindow: number
  ) {
    super();
    this.startCleanupTimer();
  }

  /**
   * Record request
   */
  recordRequest(): void {
    this.requests.push(new Date());
    this.emit('request-recorded', { timestamp: new Date() });
  }

  /**
   * Record success
   */
  recordSuccess(executionTime: number): void {
    const timestamp = new Date();
    this.successes.push(timestamp);
    this.recordResponseTime(executionTime);
    this.emit('success-recorded', { timestamp, executionTime });
  }

  /**
   * Record failure
   */
  recordFailure(error?: Error): void {
    const timestamp = new Date();
    this.failures.push(timestamp);
    this.emit('failure-recorded', { timestamp, error });
  }

  /**
   * Record response time
   */
  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
  }

  /**
   * Get metrics within time window
   */
  getMetrics(state: CircuitBreakerState, stateMetrics: any, currentTimeout: number): CircuitBreakerMetrics {
    const now = new Date();
    const timeWindowStart = new Date(now.getTime() - this.timeWindow);
    
    const recentFailures = this.failures.filter(f => f > timeWindowStart);
    const recentSuccesses = this.successes.filter(s => s > timeWindowStart);
    const recentRequests = this.requests.filter(r => r > timeWindowStart);

    const totalRequests = recentRequests.length;
    const failureRate = totalRequests > 0 ? (recentFailures.length / totalRequests) * 100 : 0;
    const averageResponseTime = this.calculateAverageResponseTime();

    return {
      state,
      failureCount: recentFailures.length,
      successCount: recentSuccesses.length,
      requestCount: totalRequests,
      lastFailureTime: this.failures.length > 0 ? this.failures[this.failures.length - 1] ?? null : null,
      lastSuccessTime: this.successes.length > 0 ? this.successes[this.successes.length - 1] ?? null : null,
      stateChangeTime: stateMetrics.stateChangeTime,
      totalStateChanges: stateMetrics.totalStateChanges,
      failureRate,
      averageResponseTime,
      circuitOpenCount: stateMetrics.openCount,
      circuitHalfOpenCount: stateMetrics.halfOpenCount,
      circuitCloseCount: stateMetrics.closedCount,
      currentTimeout,
    };
  }

  /**
   * Get recent failures
   */
  getRecentFailures(): Date[] {
    const timeWindowStart = new Date(Date.now() - this.timeWindow);
    return this.failures.filter(f => f > timeWindowStart);
  }

  /**
   * Get recent successes
   */
  getRecentSuccesses(): Date[] {
    const timeWindowStart = new Date(Date.now() - this.timeWindow);
    return this.successes.filter(s => s > timeWindowStart);
  }

  /**
   * Get recent requests
   */
  getRecentRequests(): Date[] {
    const timeWindowStart = new Date(Date.now() - this.timeWindow);
    return this.requests.filter(r => r > timeWindowStart);
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) {
      return 0;
    }
    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.responseTimes.length;
  }

  /**
   * Clean up old data
   */
  private cleanup(): void {
    const cutoff = new Date(Date.now() - this.timeWindow * 2); // Keep 2x time window
    
    this.failures = this.failures.filter(f => f > cutoff);
    this.successes = this.successes.filter(s => s > cutoff);
    this.requests = this.requests.filter(r => r > cutoff);
    
    logger.debug({
      circuitBreaker: this.name,
      remainingFailures: this.failures.length,
      remainingSuccesses: this.successes.length,
      remainingRequests: this.requests.length,
    }, 'Metrics cleanup completed');
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.failures = [];
    this.successes = [];
    this.requests = [];
    this.responseTimes = [];
    this.emit('metrics-reset');
  }

  /**
   * Destroy metrics collector
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.removeAllListeners();
  }
}

