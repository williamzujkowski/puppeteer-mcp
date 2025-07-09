/**
 * Browser Pool Resource Monitor
 * Handles periodic resource monitoring and health checks for browser instances
 * @module puppeteer/pool/browser-pool-resource-monitor
 * @nist si-4 "Information system monitoring"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import type { BrowserPoolMetrics } from './browser-pool-metrics.js';
import { checkBrowserHealth } from './browser-health.js';

/**
 * Browser Pool Resource Monitor
 * Manages periodic resource monitoring and health data collection
 */
export class BrowserPoolResourceMonitor {
  private resourceMonitorInterval?: NodeJS.Timeout;

  constructor(
    private browsers: Map<string, InternalBrowserInstance>,
    private metrics: BrowserPoolMetrics,
  ) {}

  /**
   * Start periodic resource monitoring
   * Monitors browser resource usage every 30 seconds
   * @nist si-4 "Information system monitoring"
   */
  startResourceMonitoring(): void {
    // Monitor resources every 30 seconds
    this.resourceMonitorInterval = setInterval(() => {
      void this.collectResourceMetrics();
    }, 30000);
  }

  /**
   * Stop resource monitoring
   */
  stopResourceMonitoring(): void {
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = undefined;
    }
  }

  /**
   * Collect resource metrics from all browsers
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  async collectResourceMetrics(): Promise<void> {
    for (const [browserId, instance] of this.browsers) {
      try {
        const health = await checkBrowserHealth(instance.browser, instance);
        if (health.cpuUsage !== undefined && health.memoryUsage !== undefined) {
          this.metrics.updateResourceUsage(browserId, health.cpuUsage, health.memoryUsage);
        }
      } catch {
        // Ignore errors in resource collection
      }
    }
  }

  /**
   * Perform comprehensive health check on all browsers
   * @nist si-4 "Information system monitoring"
   */
  async performHealthCheck(): Promise<Map<string, boolean>> {
    const startTime = Date.now();
    const results = new Map<string, boolean>();

    // Perform health checks and collect resource metrics
    for (const [browserId, instance] of this.browsers) {
      try {
        const { browser } = instance;
        const health = await checkBrowserHealth(browser, instance);
        results.set(browserId, health.healthy);

        // Update resource metrics if available
        if (health.cpuUsage !== undefined && health.memoryUsage !== undefined) {
          this.metrics.updateResourceUsage(browserId, health.cpuUsage, health.memoryUsage);
        }
      } catch {
        results.set(browserId, false);
      }
    }

    const duration = Date.now() - startTime;

    // Record health check metrics
    const successCount = Array.from(results.values()).filter((healthy) => healthy).length;
    const success = successCount === results.size;
    this.metrics.recordHealthCheck(duration, success);

    return results;
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring(): boolean {
    return this.resourceMonitorInterval !== undefined;
  }

  /**
   * Get monitoring interval handle for testing
   */
  getMonitoringInterval(): NodeJS.Timeout | undefined {
    return this.resourceMonitorInterval;
  }
}