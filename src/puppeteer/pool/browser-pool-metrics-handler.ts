/**
 * Browser Pool Metrics Handler
 * Provides a clean interface for recording and managing pool metrics
 * @module puppeteer/pool/browser-pool-metrics-handler
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { PoolMetrics } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import type { BrowserPoolMetrics, ExtendedPoolMetrics } from './browser-pool-metrics.js';
import { getMetrics } from './browser-pool-public-methods.js';

/**
 * Browser Pool Metrics Handler
 * Wraps BrowserPoolMetrics with higher-level operations and clean interface
 */
export class BrowserPoolMetricsHandler {
  constructor(
    private metrics: BrowserPoolMetrics,
    private browsers: Map<string, InternalBrowserInstance>,
    private maxBrowsers: number,
  ) {}

  /**
   * Record page creation metrics
   * @nist au-3 "Content of audit records"
   */
  recordPageCreation(duration: number): void {
    this.metrics.recordPageCreation(duration);
  }

  /**
   * Record page destruction metrics
   */
  recordPageDestruction(duration: number): void {
    this.metrics.recordPageDestruction(duration);
  }

  /**
   * Record current pool utilization
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  recordUtilization(): void {
    const utilization = (this.browsers.size / this.maxBrowsers) * 100;
    this.metrics.recordUtilization(utilization);
  }

  /**
   * Record browser creation metrics
   */
  recordBrowserCreated(browserId: string, creationTime: number): void {
    this.metrics.recordBrowserCreated(browserId, creationTime);
  }

  /**
   * Record browser destruction metrics
   */
  recordBrowserDestroyed(browserId: string, lifetime: number): void {
    this.metrics.recordBrowserDestroyed(browserId, lifetime);
  }

  /**
   * Record queue operations
   */
  recordQueueAdd(): void {
    this.metrics.recordQueueAdd();
  }

  /**
   * Record queue removal with wait time
   */
  recordQueueRemove(waitTime: number): void {
    this.metrics.recordQueueRemove(waitTime);
  }

  /**
   * Record error events
   */
  recordError(errorType: string, browserId?: string): void {
    this.metrics.recordError(errorType, browserId);
  }

  /**
   * Record recovery attempts
   */
  recordRecovery(success: boolean, browserId?: string): void {
    this.metrics.recordRecovery(success, browserId);
  }

  /**
   * Record health check metrics
   */
  recordHealthCheck(duration: number, success: boolean): void {
    this.metrics.recordHealthCheck(duration, success);
  }

  /**
   * Update resource usage for a browser
   * @nist si-4 "Information system monitoring"
   */
  updateResourceUsage(browserId: string, cpuUsage: number, memoryUsage: number): void {
    this.metrics.updateResourceUsage(browserId, cpuUsage, memoryUsage);
  }

  /**
   * Get standard pool metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(): PoolMetrics {
    return getMetrics(this.browsers, this.maxBrowsers);
  }

  /**
   * Get extended pool metrics with performance data
   */
  getExtendedMetrics(): ExtendedPoolMetrics {
    return this.metrics.getMetrics(this.browsers, this.maxBrowsers);
  }

  /**
   * Get current pool utilization percentage
   */
  getCurrentUtilization(): number {
    return (this.browsers.size / this.maxBrowsers) * 100;
  }

  /**
   * Get browser count by state
   */
  getBrowserCountByState(): { active: number; idle: number; total: number } {
    let active = 0;
    let idle = 0;

    for (const instance of this.browsers.values()) {
      if (instance.state === 'active') {
        active++;
      } else if (instance.state === 'idle') {
        idle++;
      }
    }

    return {
      active,
      idle,
      total: this.browsers.size,
    };
  }

  /**
   * Get total page count across all browsers
   */
  getTotalPageCount(): number {
    let totalPages = 0;
    for (const instance of this.browsers.values()) {
      totalPages += instance.pageCount;
    }
    return totalPages;
  }

  /**
   * Get active page count
   */
  getActivePageCount(): number {
    let activePages = 0;
    for (const instance of this.browsers.values()) {
      if (instance.state === 'active') {
        activePages += instance.pageCount;
      }
    }
    return activePages;
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    // This would need to be implemented in BrowserPoolMetrics if needed
    // For now, metrics are cumulative
  }
}