/**
 * Browser resource monitor implementation
 * @module puppeteer/pool/resource-management/browser-resource-monitor
 * @nist si-4 "Information system monitoring"
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import type { Browser } from 'puppeteer';
import { createLogger } from '../../../utils/logger.js';
import type { BrowserResourceUsage } from './resource-types.js';
import type { IBrowserResourceMonitor } from './resource-monitor.interface.js';

const logger = createLogger('browser-resource-monitor');
const execAsync = promisify(exec);

/**
 * Browser resource monitor
 * @nist si-4 "Information system monitoring"
 */
export class BrowserResourceMonitor implements IBrowserResourceMonitor {
  private browserResources: Map<string, BrowserResourceUsage> = new Map();
  private active = false;

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    this.active = true;
    logger.info('Browser resource monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.active = false;
    this.browserResources.clear();
    logger.info('Browser resource monitoring stopped');
  }

  /**
   * Update resources (no-op for browser monitor)
   */
  async update(): Promise<void> {
    // Browser resources are updated on-demand
  }

  /**
   * Get all browser resources
   */
  getResources(): Map<string, BrowserResourceUsage> {
    return new Map(this.browserResources);
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Monitor specific browser
   */
  async monitorBrowser(browserId: string, browser: Browser): Promise<BrowserResourceUsage> {
    if (!this.active) {
      throw new Error('Browser monitoring not active');
    }

    try {
      const usage = await this.getBrowserResourceUsage(browser, browserId);
      this.browserResources.set(browserId, usage);

      logger.debug(
        {
          browserId,
          memoryMB: Math.round(usage.memoryUsage.rss / 1024 / 1024),
          cpu: usage.cpuUsage.percent,
          connections: usage.connectionCount,
        },
        'Browser resources monitored',
      );

      return usage;
    } catch (error) {
      logger.error({ browserId, error }, 'Error monitoring browser resources');
      throw error;
    }
  }

  /**
   * Get browser resource usage
   */
  getBrowserUsage(browserId: string): BrowserResourceUsage | undefined {
    return this.browserResources.get(browserId);
  }

  /**
   * Remove browser from monitoring
   */
  removeBrowser(browserId: string): void {
    this.browserResources.delete(browserId);
    logger.debug({ browserId }, 'Browser removed from monitoring');
  }

  /**
   * Get browser resource usage
   * @private
   */
  private async getBrowserResourceUsage(
    browser: Browser,
    browserId: string,
  ): Promise<BrowserResourceUsage> {
    const process = browser.process();
    const pid = process?.pid || 0;

    const memoryUsage = {
      rss: 0,
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
    };

    const cpuUsage = {
      user: 0,
      system: 0,
      percent: 0,
    };

    let openHandles = 0;
    let threadCount = 0;
    let connectionCount = 0;

    try {
      // Get process memory and CPU usage
      if (pid > 0) {
        const { stdout } = await execAsync(`ps -p ${pid} -o rss,pcpu,nlwp | tail -1`);
        if (stdout) {
          const parts = stdout.trim().split(/\s+/);
          if (parts.length >= 3) {
            memoryUsage.rss = parseInt(parts[0] || '0', 10) * 1024; // Convert KB to bytes
            cpuUsage.percent = parseFloat(parts[1] || '0');
            threadCount = parseInt(parts[2] || '0', 10);
          }
        }
      }

      // Get connection count from browser
      const pages = await browser.pages();
      connectionCount = pages.length;

      // Estimate open handles (simplified)
      openHandles = connectionCount * 50; // Rough estimate

      // Get heap usage from browser context
      try {
        const metrics = await browser.newPage().then(async (page) => {
          const metrics = await page.metrics();
          await page.close();
          return metrics;
        });

        if (metrics) {
          memoryUsage.heapUsed = metrics.JSHeapUsedSize || 0;
          memoryUsage.heapTotal = metrics.JSHeapTotalSize || 0;
        }
      } catch (error) {
        logger.debug({ error }, 'Could not get heap metrics');
      }
    } catch (error) {
      logger.debug({ browserId, error }, 'Error getting detailed browser resource usage');
    }

    return {
      browserId,
      pid,
      memoryUsage,
      cpuUsage,
      openHandles,
      threadCount,
      connectionCount,
      timestamp: new Date(),
    };
  }
}
