/**
 * Browser pool metrics collection and tracking
 * @module puppeteer/pool/browser-pool-metrics
 * @nist au-3 "Content of audit records"
 * @nist au-4 "Audit storage capacity"
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-4 "Information system monitoring"
 */

import type { PoolMetrics } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('browser-pool-metrics');

/**
 * Performance metric data point
 */
interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

/**
 * Request queue metrics
 */
interface QueueMetrics {
  queueLength: number;
  averageWaitTime: number;
  maxWaitTime: number;
  totalQueued: number;
  totalDequeued: number;
}

/**
 * Resource usage metrics per browser
 */
interface ResourceMetrics {
  browserId: string;
  cpuUsage: number;
  memoryUsage: number;
  timestamp: Date;
}

/**
 * Error metrics tracking
 */
interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  recoverySuccesses: number;
  recoveryFailures: number;
  lastError?: {
    timestamp: Date;
    type: string;
    browserId?: string;
  };
}

/**
 * Extended pool metrics with detailed performance data
 */
export interface ExtendedPoolMetrics extends PoolMetrics {
  /** Queue metrics */
  queue: QueueMetrics;
  /** Error and recovery metrics */
  errors: ErrorMetrics;
  /** Average page creation time (ms) */
  avgPageCreationTime: number;
  /** Average page destruction time (ms) */
  avgPageDestructionTime: number;
  /** Health check performance metrics */
  healthCheck: {
    avgDuration: number;
    lastDuration: number;
    successRate: number;
    totalChecks: number;
  };
  /** Resource usage metrics */
  resources: {
    totalCpuUsage: number;
    totalMemoryUsage: number;
    avgCpuPerBrowser: number;
    avgMemoryPerBrowser: number;
  };
  /** Time-based metrics */
  timeSeries: {
    utilizationHistory: MetricDataPoint[];
    errorRateHistory: MetricDataPoint[];
    queueLengthHistory: MetricDataPoint[];
  };
}

/**
 * Browser pool metrics collector
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */
export class BrowserPoolMetrics {
  private browsersCreated = 0;
  private browsersDestroyed = 0;
  private browserLifetimes: number[] = [];
  
  // Queue metrics
  private queueWaitTimes: number[] = [];
  private totalQueued = 0;
  private totalDequeued = 0;
  private currentQueueLength = 0;
  
  // Performance metrics with rolling windows
  private pageCreationTimes: MetricDataPoint[] = [];
  private pageDestructionTimes: MetricDataPoint[] = [];
  private healthCheckDurations: MetricDataPoint[] = [];
  private healthCheckResults: boolean[] = [];
  
  // Error tracking
  private errorCount = 0;
  private recoverySuccesses = 0;
  private recoveryFailures = 0;
  private lastError?: { timestamp: Date; type: string; browserId?: string };
  
  // Resource usage tracking
  private resourceMetrics: Map<string, ResourceMetrics> = new Map();
  
  // Time series data (1-hour rolling window)
  private utilizationHistory: MetricDataPoint[] = [];
  private errorRateHistory: MetricDataPoint[] = [];
  private queueLengthHistory: MetricDataPoint[] = [];
  
  // Configuration
  private readonly windowSize = 3600000; // 1 hour in ms
  private readonly maxDataPoints = 60; // Store 60 data points (1 per minute)

  /**
   * Record browser creation
   * @nist au-3 "Content of audit records"
   */
  recordBrowserCreated(browserId: string, creationTime: number): void {
    this.browsersCreated++;
    logger.debug({ browserId, creationTime }, 'Browser created');
  }

  /**
   * Record browser destruction
   * @nist au-3 "Content of audit records"
   */
  recordBrowserDestroyed(browserId: string, lifetime: number): void {
    this.browsersDestroyed++;
    this.browserLifetimes.push(lifetime);
    
    // Keep only last 100 lifetimes for average calculation
    if (this.browserLifetimes.length > 100) {
      this.browserLifetimes.shift();
    }
    
    // Clean up resource metrics for this browser
    this.resourceMetrics.delete(browserId);
    
    logger.debug({ browserId, lifetime }, 'Browser destroyed');
  }

  /**
   * Record page creation time
   * @nist au-3 "Content of audit records"
   */
  recordPageCreation(duration: number): void {
    this.addMetricDataPoint(this.pageCreationTimes, duration);
    logger.debug({ duration }, 'Page creation recorded');
  }

  /**
   * Record page destruction time
   * @nist au-3 "Content of audit records"
   */
  recordPageDestruction(duration: number): void {
    this.addMetricDataPoint(this.pageDestructionTimes, duration);
    logger.debug({ duration }, 'Page destruction recorded');
  }

  /**
   * Record health check performance
   * @nist si-4 "Information system monitoring"
   */
  recordHealthCheck(duration: number, success: boolean): void {
    this.addMetricDataPoint(this.healthCheckDurations, duration);
    this.healthCheckResults.push(success);
    
    // Keep only last 100 results
    if (this.healthCheckResults.length > 100) {
      this.healthCheckResults.shift();
    }
    
    logger.debug({ duration, success }, 'Health check recorded');
  }

  /**
   * Record queue metrics
   * @nist au-3 "Content of audit records"
   */
  recordQueueAdd(): void {
    this.totalQueued++;
    this.currentQueueLength++;
    this.recordQueueLength();
  }

  /**
   * Record queue removal with wait time
   * @nist au-3 "Content of audit records"
   */
  recordQueueRemove(waitTime: number): void {
    this.totalDequeued++;
    this.currentQueueLength = Math.max(0, this.currentQueueLength - 1);
    this.queueWaitTimes.push(waitTime);
    
    // Keep only last 100 wait times
    if (this.queueWaitTimes.length > 100) {
      this.queueWaitTimes.shift();
    }
    
    this.recordQueueLength();
  }

  /**
   * Record error occurrence
   * @nist au-3 "Content of audit records"
   * @nist au-5 "Response to audit processing failures"
   */
  recordError(type: string, browserId?: string): void {
    this.errorCount++;
    this.lastError = { timestamp: new Date(), type, browserId };
    this.recordErrorRate();
    
    logger.warn({ type, browserId }, 'Error recorded');
  }

  /**
   * Record recovery attempt result
   * @nist au-3 "Content of audit records"
   */
  recordRecovery(success: boolean, browserId: string): void {
    if (success) {
      this.recoverySuccesses++;
    } else {
      this.recoveryFailures++;
    }
    
    logger.info({ success, browserId }, 'Recovery attempt recorded');
  }

  /**
   * Update resource usage for a browser
   * @nist si-4 "Information system monitoring"
   */
  updateResourceUsage(browserId: string, cpuUsage: number, memoryUsage: number): void {
    this.resourceMetrics.set(browserId, {
      browserId,
      cpuUsage,
      memoryUsage,
      timestamp: new Date(),
    });
  }

  /**
   * Record current utilization
   * @nist si-4 "Information system monitoring"
   */
  recordUtilization(utilization: number): void {
    this.addTimeSeriesDataPoint(this.utilizationHistory, utilization);
  }

  /**
   * Get current metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(
    browsers: Map<string, InternalBrowserInstance>,
    maxBrowsers: number,
  ): ExtendedPoolMetrics {
    const baseMetrics = getPoolMetrics(browsers, maxBrowsers);
    
    // Calculate queue metrics
    const queueMetrics: QueueMetrics = {
      queueLength: this.currentQueueLength,
      averageWaitTime: this.calculateAverage(this.queueWaitTimes),
      maxWaitTime: Math.max(0, ...this.queueWaitTimes),
      totalQueued: this.totalQueued,
      totalDequeued: this.totalDequeued,
    };
    
    // Calculate error metrics
    const errorRate = this.errorCount > 0 
      ? (this.errorCount / (this.browsersCreated + this.browsersDestroyed)) * 100 
      : 0;
    
    const errorMetrics: ErrorMetrics = {
      totalErrors: this.errorCount,
      errorRate,
      recoverySuccesses: this.recoverySuccesses,
      recoveryFailures: this.recoveryFailures,
      lastError: this.lastError,
    };
    
    // Calculate performance metrics
    const avgPageCreationTime = this.calculateRecentAverage(this.pageCreationTimes);
    const avgPageDestructionTime = this.calculateRecentAverage(this.pageDestructionTimes);
    
    // Calculate health check metrics
    const successCount = this.healthCheckResults.filter(r => r).length;
    const healthCheckMetrics = {
      avgDuration: this.calculateRecentAverage(this.healthCheckDurations),
      lastDuration: this.healthCheckDurations.length > 0 
        ? this.healthCheckDurations[this.healthCheckDurations.length - 1]?.value ?? 0
        : 0,
      successRate: this.healthCheckResults.length > 0 
        ? (successCount / this.healthCheckResults.length) * 100 
        : 100,
      totalChecks: this.healthCheckResults.length,
    };
    
    // Calculate resource metrics
    const resourceMetrics = this.calculateResourceMetrics();
    
    // Update base metrics with our tracked values
    const extendedMetrics: ExtendedPoolMetrics = {
      ...baseMetrics,
      browsersCreated: this.browsersCreated,
      browsersDestroyed: this.browsersDestroyed,
      avgBrowserLifetime: this.calculateAverage(this.browserLifetimes),
      queue: queueMetrics,
      errors: errorMetrics,
      avgPageCreationTime,
      avgPageDestructionTime,
      healthCheck: healthCheckMetrics,
      resources: resourceMetrics,
      timeSeries: {
        utilizationHistory: [...this.utilizationHistory],
        errorRateHistory: [...this.errorRateHistory],
        queueLengthHistory: [...this.queueLengthHistory],
      },
    };
    
    return extendedMetrics;
  }

  /**
   * Add metric data point with timestamp
   * @private
   */
  private addMetricDataPoint(array: MetricDataPoint[], value: number): void {
    const now = new Date();
    array.push({ timestamp: now, value });
    
    // Remove old data points outside the window
    const cutoff = new Date(now.getTime() - this.windowSize);
    while (array.length > 0 && array[0] && array[0].timestamp < cutoff) {
      array.shift();
    }
  }

  /**
   * Add time series data point
   * @private
   */
  private addTimeSeriesDataPoint(array: MetricDataPoint[], value: number): void {
    array.push({ timestamp: new Date(), value });
    
    // Keep only last N data points
    if (array.length > this.maxDataPoints) {
      array.shift();
    }
  }

  /**
   * Calculate average of number array
   * @private
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate average of recent metric data points
   * @private
   */
  private calculateRecentAverage(dataPoints: MetricDataPoint[]): number {
    if (dataPoints.length === 0) return 0;
    const values = dataPoints.map(dp => dp.value);
    return this.calculateAverage(values);
  }

  /**
   * Calculate resource usage metrics
   * @private
   */
  private calculateResourceMetrics(): { cpu: number; memory: number } {
    const activeMetrics = Array.from(this.resourceMetrics.values());
    
    const totalCpu = activeMetrics.reduce((sum, m) => sum + m.cpuUsage, 0);
    const totalMemory = activeMetrics.reduce((sum, m) => sum + m.memoryUsage, 0);
    const count = activeMetrics.length;
    
    return {
      totalCpuUsage: totalCpu,
      totalMemoryUsage: totalMemory,
      avgCpuPerBrowser: count > 0 ? totalCpu / count : 0,
      avgMemoryPerBrowser: count > 0 ? totalMemory / count : 0,
    };
  }

  /**
   * Record current queue length for time series
   * @private
   */
  private recordQueueLength(): void {
    this.addTimeSeriesDataPoint(this.queueLengthHistory, this.currentQueueLength);
  }

  /**
   * Record current error rate for time series
   * @private
   */
  private recordErrorRate(): void {
    const rate = this.browsersCreated > 0 
      ? (this.errorCount / this.browsersCreated) * 100 
      : 0;
    this.addTimeSeriesDataPoint(this.errorRateHistory, rate);
  }
}

/**
 * Get pool metrics (legacy function for backward compatibility)
 * @nist au-3 "Content of audit records"
 */
export function getPoolMetrics(
  browsers: Map<string, InternalBrowserInstance>,
  maxBrowsers: number,
): PoolMetrics {
  const instances = Array.from(browsers.values());

  const totalPages = instances.reduce((sum, i) => sum + i.pageCount, 0);
  const activePages = totalPages; // Simplified - all pages are considered active

  // Use state for determining active vs idle instead of pageCount
  const activeBrowsers = instances.filter((i) => i.state === 'active').length;
  const idleBrowsers = instances.filter((i) => i.state === 'idle').length;

  return {
    totalBrowsers: browsers.size,
    activeBrowsers,
    idleBrowsers,
    totalPages,
    activePages,
    browsersCreated: 0, // Will be overridden by ExtendedPoolMetrics
    browsersDestroyed: 0, // Will be overridden by ExtendedPoolMetrics
    avgBrowserLifetime: 0, // Will be overridden by ExtendedPoolMetrics
    utilizationPercentage: browsers.size > 0 ? (activeBrowsers / maxBrowsers) * 100 : 0,
    lastHealthCheck: new Date(),
  };
}