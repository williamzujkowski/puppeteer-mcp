/**
 * Performance monitoring for navigation operations
 * @module puppeteer/actions/execution/navigation/performance-monitor
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:navigation:performance-monitor');

/**
 * Navigation performance metrics
 */
export interface NavigationMetrics {
  /** Unique metrics ID */
  id: string;
  /** Session ID */
  sessionId: string;
  /** Navigation start time */
  startTime: number;
  /** Navigation end time */
  endTime?: number;
  /** Total duration in milliseconds */
  duration?: number;
  /** Whether navigation succeeded */
  success?: boolean;
  /** Final URL after navigation */
  finalUrl?: string;
  /** DNS lookup time */
  dnsLookupTime?: number;
  /** TCP connection time */
  tcpConnectTime?: number;
  /** TLS handshake time */
  tlsTime?: number;
  /** Time to first byte */
  ttfb?: number;
  /** DOM content loaded time */
  domContentLoadedTime?: number;
  /** Load event time */
  loadEventTime?: number;
  /** First contentful paint */
  firstContentfulPaint?: number;
  /** Largest contentful paint */
  largestContentfulPaint?: number;
  /** Cumulative layout shift */
  cumulativeLayoutShift?: number;
  /** Time to interactive */
  timeToInteractive?: number;
  /** Memory usage after navigation */
  memoryUsage?: {
    usedJSMemory: number;
    totalJSMemory: number;
    jsMemoryLimit: number;
  };
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  /** Enable detailed timing metrics */
  enableDetailedMetrics?: boolean;
  /** Enable memory usage tracking */
  enableMemoryTracking?: boolean;
  /** Maximum number of metrics to store */
  maxMetricsHistory?: number;
  /** Metrics retention period in milliseconds */
  retentionPeriod?: number;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  /** Total navigations monitored */
  totalNavigations: number;
  /** Successful navigations */
  successfulNavigations: number;
  /** Failed navigations */
  failedNavigations: number;
  /** Average navigation duration */
  averageDuration: number;
  /** Median navigation duration */
  medianDuration: number;
  /** 95th percentile duration */
  p95Duration: number;
  /** Average time to first byte */
  averageTtfb: number;
  /** Average DOM content loaded time */
  averageDomContentLoaded: number;
  /** Success rate percentage */
  successRate: number;
}

/**
 * Default performance monitoring configuration
 */
const DEFAULT_CONFIG: Required<PerformanceConfig> = {
  enableDetailedMetrics: true,
  enableMemoryTracking: true,
  maxMetricsHistory: 1000,
  retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Performance monitor for navigation operations
 * @nist au-3 "Content of audit records"
 */
export class PerformanceMonitor {
  private readonly config: Required<PerformanceConfig>;
  private readonly metrics: Map<string, NavigationMetrics> = new Map();
  private readonly sessionMetrics: Map<string, string[]> = new Map();
  private metricsCounter = 0;

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start cleanup interval
    this.startCleanupInterval();

    logger.debug('Performance monitor initialized', {
      enableDetailedMetrics: this.config.enableDetailedMetrics,
      enableMemoryTracking: this.config.enableMemoryTracking,
      maxMetricsHistory: this.config.maxMetricsHistory,
    });
  }

  /**
   * Start navigation performance monitoring
   * @param sessionId - Session ID
   * @returns Navigation metrics object
   * @nist au-3 "Content of audit records"
   */
  async startNavigation(sessionId: string): Promise<NavigationMetrics> {
    const metricsId = this.generateMetricsId();
    const startTime = Date.now();

    const metrics: NavigationMetrics = {
      id: metricsId,
      sessionId,
      startTime,
    };

    // Store metrics
    this.metrics.set(metricsId, metrics);

    // Track session metrics
    if (!this.sessionMetrics.has(sessionId)) {
      this.sessionMetrics.set(sessionId, []);
    }
    this.sessionMetrics.get(sessionId)!.push(metricsId);

    // Cleanup old metrics if needed
    this.cleanupOldMetrics();

    logger.debug('Started navigation monitoring', {
      metricsId,
      sessionId,
      startTime,
    });

    return metrics;
  }

  /**
   * End navigation performance monitoring
   * @param metricsId - Metrics ID
   * @param success - Whether navigation succeeded
   * @param finalUrl - Final URL after navigation
   * @param additionalMetrics - Additional metrics to record
   * @returns Updated metrics
   * @nist au-3 "Content of audit records"
   */
  async endNavigation(
    metricsId: string,
    success: boolean,
    finalUrl?: string,
    additionalMetrics?: Partial<NavigationMetrics>,
  ): Promise<NavigationMetrics | null> {
    const metrics = this.metrics.get(metricsId);
    if (!metrics) {
      logger.warn('Navigation metrics not found', { metricsId });
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - metrics.startTime;

    // Update metrics
    Object.assign(metrics, {
      endTime,
      duration,
      success,
      finalUrl,
      ...additionalMetrics,
    });

    // Collect detailed metrics if enabled
    if (this.config.enableDetailedMetrics) {
      await this.collectDetailedMetrics(metrics);
    }

    // Collect memory metrics if enabled
    if (this.config.enableMemoryTracking) {
      await this.collectMemoryMetrics(metrics);
    }

    logger.debug('Navigation monitoring completed', {
      metricsId,
      sessionId: metrics.sessionId,
      duration,
      success,
      finalUrl,
    });

    return metrics;
  }

  /**
   * Get navigation metrics by ID
   * @param metricsId - Metrics ID
   * @returns Navigation metrics
   */
  getMetrics(metricsId: string): NavigationMetrics | null {
    return this.metrics.get(metricsId) ?? null;
  }

  /**
   * Get all metrics for a session
   * @param sessionId - Session ID
   * @returns Array of navigation metrics
   */
  getSessionMetrics(sessionId: string): NavigationMetrics[] {
    const metricIds = this.sessionMetrics.get(sessionId) ?? [];
    return metricIds
      .map((id) => this.metrics.get(id))
      .filter((metric): metric is NavigationMetrics => metric !== undefined);
  }

  /**
   * Get performance statistics
   * @param sessionId - Optional session ID to filter by
   * @returns Performance statistics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getStatistics(sessionId?: string): PerformanceStats {
    const relevantMetrics = sessionId
      ? this.getSessionMetrics(sessionId)
      : Array.from(this.metrics.values());

    const completedMetrics = relevantMetrics.filter((m) => m.duration !== undefined);
    const successfulMetrics = completedMetrics.filter((m) => m.success === true);
    const failedMetrics = completedMetrics.filter((m) => m.success === false);

    const durations = completedMetrics.map((m) => m.duration!).sort((a, b) => a - b);
    const ttfbs = completedMetrics
      .map((m) => m.ttfb)
      .filter((ttfb): ttfb is number => ttfb !== undefined)
      .sort((a, b) => a - b);
    const domTimes = completedMetrics
      .map((m) => m.domContentLoadedTime)
      .filter((time): time is number => time !== undefined)
      .sort((a, b) => a - b);

    return {
      totalNavigations: completedMetrics.length,
      successfulNavigations: successfulMetrics.length,
      failedNavigations: failedMetrics.length,
      averageDuration: this.calculateAverage(durations),
      medianDuration: this.calculateMedian(durations),
      p95Duration: this.calculatePercentile(durations, 95),
      averageTtfb: this.calculateAverage(ttfbs),
      averageDomContentLoaded: this.calculateAverage(domTimes),
      successRate:
        completedMetrics.length > 0
          ? (successfulMetrics.length / completedMetrics.length) * 100
          : 0,
    };
  }

  /**
   * Clear metrics for a session
   * @param sessionId - Session ID
   */
  clearSessionMetrics(sessionId: string): void {
    const metricIds = this.sessionMetrics.get(sessionId) ?? [];

    for (const id of metricIds) {
      this.metrics.delete(id);
    }

    this.sessionMetrics.delete(sessionId);

    logger.debug('Cleared session metrics', {
      sessionId,
      clearedCount: metricIds.length,
    });
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    const totalCount = this.metrics.size;
    this.metrics.clear();
    this.sessionMetrics.clear();
    this.metricsCounter = 0;

    logger.info('Cleared all metrics', { totalCount });
  }

  /**
   * Collect detailed navigation metrics (placeholder for browser-specific implementation)
   * @param metrics - Metrics object to update
   */
  private async collectDetailedMetrics(metrics: NavigationMetrics): Promise<void> {
    try {
      // In a real implementation, this would collect metrics from the browser
      // For now, we'll simulate some basic metrics

      // These would typically come from Performance API or browser devtools
      metrics.dnsLookupTime = Math.random() * 50;
      metrics.tcpConnectTime = Math.random() * 100;
      metrics.tlsTime = Math.random() * 200;
      metrics.ttfb = Math.random() * 500;
      metrics.domContentLoadedTime = Math.random() * 1000;
      metrics.loadEventTime = Math.random() * 1500;
      metrics.firstContentfulPaint = Math.random() * 800;
      metrics.largestContentfulPaint = Math.random() * 1200;
      metrics.cumulativeLayoutShift = Math.random() * 0.1;
      metrics.timeToInteractive = Math.random() * 2000;
    } catch (error) {
      logger.warn('Failed to collect detailed metrics', {
        metricsId: metrics.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Collect memory usage metrics (placeholder for browser-specific implementation)
   * @param metrics - Metrics object to update
   */
  private async collectMemoryMetrics(metrics: NavigationMetrics): Promise<void> {
    try {
      // In a real implementation, this would collect memory usage from the browser
      // For now, we'll simulate memory metrics

      metrics.memoryUsage = {
        usedJSMemory: Math.floor(Math.random() * 50000000), // 0-50MB
        totalJSMemory: Math.floor(Math.random() * 100000000), // 0-100MB
        jsMemoryLimit: 2147483648, // 2GB typical limit
      };
    } catch (error) {
      logger.warn('Failed to collect memory metrics', {
        metricsId: metrics.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate unique metrics ID
   * @returns Unique metrics ID
   */
  private generateMetricsId(): string {
    return `nav_${Date.now()}_${++this.metricsCounter}`;
  }

  /**
   * Start cleanup interval for old metrics
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup old metrics based on retention period and max history
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.retentionPeriod;
    let removedCount = 0;

    // Remove old metrics
    for (const [id, metrics] of this.metrics.entries()) {
      if (metrics.startTime < cutoffTime) {
        this.metrics.delete(id);
        removedCount++;

        // Remove from session tracking
        const sessionMetrics = this.sessionMetrics.get(metrics.sessionId);
        if (sessionMetrics) {
          const index = sessionMetrics.indexOf(id);
          if (index > -1) {
            sessionMetrics.splice(index, 1);
          }
          if (sessionMetrics.length === 0) {
            this.sessionMetrics.delete(metrics.sessionId);
          }
        }
      }
    }

    // Enforce max history limit
    if (this.metrics.size > this.config.maxMetricsHistory) {
      const sortedMetrics = Array.from(this.metrics.entries()).sort(
        ([, a], [, b]) => a.startTime - b.startTime,
      );

      const toRemove = sortedMetrics.slice(0, this.metrics.size - this.config.maxMetricsHistory);

      for (const [id, metrics] of toRemove) {
        this.metrics.delete(id);
        removedCount++;

        // Remove from session tracking
        const sessionMetrics = this.sessionMetrics.get(metrics.sessionId);
        if (sessionMetrics) {
          const index = sessionMetrics.indexOf(id);
          if (index > -1) {
            sessionMetrics.splice(index, 1);
          }
          if (sessionMetrics.length === 0) {
            this.sessionMetrics.delete(metrics.sessionId);
          }
        }
      }
    }

    if (removedCount > 0) {
      logger.debug('Cleaned up old metrics', {
        removedCount,
        remainingCount: this.metrics.size,
      });
    }
  }

  /**
   * Calculate average of numbers
   * @param numbers - Array of numbers
   * @returns Average value
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  /**
   * Calculate median of numbers
   * @param numbers - Sorted array of numbers
   * @returns Median value
   */
  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const mid = Math.floor(numbers.length / 2);
    return numbers.length % 2 === 0
      ? ((numbers[mid - 1] || 0) + (numbers[mid] || 0)) / 2
      : numbers[mid] || 0;
  }

  /**
   * Calculate percentile of numbers
   * @param numbers - Sorted array of numbers
   * @param percentile - Percentile to calculate (0-100)
   * @returns Percentile value
   */
  private calculatePercentile(numbers: number[], percentile: number): number {
    if (numbers.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * numbers.length) - 1;
    return numbers[Math.max(0, index)] || 0;
  }
}

/**
 * Create performance monitor instance
 * @param config - Optional configuration
 * @returns Performance monitor instance
 */
export function createPerformanceMonitor(config?: Partial<PerformanceConfig>): PerformanceMonitor {
  return new PerformanceMonitor(config);
}
