/**
 * Performance monitoring for circuit breaker
 * @module puppeteer/pool/circuit-breaker/performance-monitor
 * @nist si-4 "Information system monitoring"
 */

import { EventEmitter } from 'events';
import { CircuitBreakerMetrics, CircuitBreakerState } from './types.js';
import { MetricsCollector } from './metrics-monitor.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('circuit-breaker-performance');

/**
 * Performance thresholds configuration
 */
export interface PerformanceThresholds {
  highResponseTime: number; // milliseconds
  highFailureRate: number; // percentage
  lowThroughput: number; // requests per minute
}

/**
 * Default performance thresholds
 */
export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  highResponseTime: 5000, // 5 seconds
  highFailureRate: 50, // 50%
  lowThroughput: 10, // requests per minute
};

/**
 * Performance monitor for circuit breaker
 * @nist si-4 "Information system monitoring"
 */
export class PerformanceMonitor extends EventEmitter {
  private performanceThresholds: PerformanceThresholds;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    private name: string,
    private metricsCollector: MetricsCollector,
    thresholds: Partial<PerformanceThresholds> = {}
  ) {
    super();
    this.performanceThresholds = {
      ...DEFAULT_PERFORMANCE_THRESHOLDS,
      ...thresholds,
    };
    this.setupMonitoring();
  }

  /**
   * Setup performance monitoring
   */
  private setupMonitoring(): void {
    // Monitor response times
    this.metricsCollector.on('success-recorded', ({ executionTime }) => {
      if (executionTime > this.performanceThresholds.highResponseTime) {
        this.emit('high-response-time', {
          circuitBreaker: this.name,
          responseTime: executionTime,
          threshold: this.performanceThresholds.highResponseTime,
        });
      }
    });

    // Periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds

    // Clean up on destroy
    this.once('destroy', () => {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
    });
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    const recentRequests = this.metricsCollector.getRecentRequests();
    const recentFailures = this.metricsCollector.getRecentFailures();
    
    // Check failure rate
    if (recentRequests.length > 0) {
      const failureRate = (recentFailures.length / recentRequests.length) * 100;
      if (failureRate > this.performanceThresholds.highFailureRate) {
        this.emit('high-failure-rate', {
          circuitBreaker: this.name,
          failureRate,
          threshold: this.performanceThresholds.highFailureRate,
        });
      }
    }

    // Check throughput
    const throughputPerMinute = recentRequests.length;
    if (throughputPerMinute < this.performanceThresholds.lowThroughput && throughputPerMinute > 0) {
      this.emit('low-throughput', {
        circuitBreaker: this.name,
        throughput: throughputPerMinute,
        threshold: this.performanceThresholds.lowThroughput,
      });
    }
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.performanceThresholds = { ...this.performanceThresholds, ...thresholds };
    logger.info({
      circuitBreaker: this.name,
      thresholds: this.performanceThresholds,
    }, 'Performance thresholds updated');
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(metrics: CircuitBreakerMetrics): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check response time
    if (metrics.averageResponseTime > this.performanceThresholds.highResponseTime) {
      issues.push(`High average response time: ${metrics.averageResponseTime}ms`);
      recommendations.push('Consider increasing timeout or optimizing operations');
    }

    // Check failure rate
    if (metrics.failureRate > this.performanceThresholds.highFailureRate) {
      issues.push(`High failure rate: ${metrics.failureRate.toFixed(2)}%`);
      recommendations.push('Investigate root cause of failures');
    }

    // Check circuit state
    if (metrics.state === CircuitBreakerState.OPEN) {
      issues.push('Circuit breaker is open');
      recommendations.push('Monitor recovery and consider manual intervention if needed');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.performanceThresholds };
  }

  /**
   * Destroy performance monitor
   */
  destroy(): void {
    this.emit('destroy');
    this.removeAllListeners();
  }
}