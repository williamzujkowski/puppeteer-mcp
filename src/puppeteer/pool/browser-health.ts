/**
 * Browser Health Monitoring
 * @module puppeteer/pool/browser-health
 * @nist ac-12 "Session termination"
 * @nist au-3 "Content of audit records"
 */

import type { Browser } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';

const logger = createLogger('browser-health');

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  responsive: boolean;
  memoryUsage?: number;
  cpuUsage?: number;
  openPages?: number;
  error?: string;
}

/**
 * Check browser health
 * @nist au-3 "Content of audit records"
 */
export async function checkBrowserHealth(
  browser: Browser,
  instance: BrowserInstance
): Promise<HealthCheckResult> {
  try {
    // Check if browser is connected
    if (browser.isConnected() === false) {
      return {
        healthy: false,
        responsive: false,
        error: 'Browser disconnected',
      };
    }

    // Get browser version (tests responsiveness)
    await browser.version();

    // Get metrics
    const pages = await browser.pages();
    const openPages = pages.length;

    // Get process metrics if available
    const process = browser.process();
    let memoryUsage: number | undefined;
    let cpuUsage: number | undefined;

    if (process?.pid) {
      try {
        // This is platform-specific and may not work on all systems
        const { execSync } = await import('child_process');
        const stats = execSync(`ps -p ${process.pid} -o %mem,%cpu | tail -1`).toString();
        const [mem, cpu] = stats.trim().split(/\s+/).map(parseFloat);
        memoryUsage = mem;
        cpuUsage = cpu;
      } catch {
        // Ignore errors in getting process stats
      }
    }

    // Check page count
    const maxPagesPerBrowser = 20;
    if (openPages > maxPagesPerBrowser) {
      logger.warn({
        browserId: instance.id,
        openPages,
        maxPages: maxPagesPerBrowser,
      }, 'Browser has too many open pages');
    }

    return {
      healthy: true,
      responsive: true,
      openPages,
      memoryUsage,
      cpuUsage,
    };

  } catch (error) {
    logger.error({
      browserId: instance.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Browser health check failed');

    return {
      healthy: false,
      responsive: false,
      error: error instanceof Error ? error.message : 'Health check failed',
    };
  }
}

/**
 * Parameters for browser monitoring
 */
export interface MonitoringParams {
  browserId: string;
  browser: Browser;
  instance: BrowserInstance;
  onUnhealthy: () => void;
  intervalMs?: number;
}

/**
 * Monitor browser health periodically
 */
export class BrowserHealthMonitor {
  private intervals = new Map<string, NodeJS.Timeout>();

  /**
   * Start monitoring a browser
   */
  startMonitoring(params: MonitoringParams): void {
    const { browserId, browser, instance, onUnhealthy, intervalMs = 30000 } = params;
    
    // Clear any existing interval
    this.stopMonitoring(browserId);

    const interval = setInterval(() => {
      void (async () => {
        const health = await checkBrowserHealth(browser, instance);
        
        if (!health.healthy) {
          logger.warn({
            browserId,
            health,
          }, 'Browser unhealthy, triggering recovery');
          
          onUnhealthy();
          this.stopMonitoring(browserId);
        } else {
          logger.debug({
            browserId,
            health,
          }, 'Browser health check passed');
        }
      })();
    }, intervalMs);

    this.intervals.set(browserId, interval);
  }

  /**
   * Stop monitoring a browser
   */
  stopMonitoring(browserId: string): void {
    const interval = this.intervals.get(browserId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(browserId);
    }
  }

  /**
   * Stop all monitoring
   */
  stopAll(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}