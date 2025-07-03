/**
 * Browser pool maintenance functions
 * @module puppeteer/pool/browser-pool-maintenance
 * @nist ac-12 "Session termination"
 * @nist si-4 "Information system monitoring"
 */

import type { Browser } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { 
  BrowserInstance,
  BrowserPoolOptions 
} from '../interfaces/browser-pool.interface.js';
import { 
  isIdleTooLong, 
  needsRestart,
  closeBrowser,
  restartBrowser 
} from './browser-utils.js';
import { BrowserHealthMonitor } from './browser-health.js';

const logger = createLogger('browser-pool-maintenance');

/**
 * Maintenance operations interface
 */
export interface MaintenanceOperations {
  browsers: Map<string, InternalBrowserInstance>;
  options: BrowserPoolOptions;
  removeBrowser: (browserId: string) => Promise<void>;
  handleUnhealthyBrowser: (browserId: string) => Promise<void>;
  launchNewBrowser: () => Promise<{ browser: Browser; instance: InternalBrowserInstance }>;
}

/**
 * Internal browser instance with additional state tracking
 */
export interface InternalBrowserInstance extends BrowserInstance {
  state: 'idle' | 'active';
  sessionId: string | null;
  errorCount: number;
}

/**
 * Browser pool maintenance manager
 */
export class BrowserPoolMaintenance {
  private maintenanceInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  /**
   * Start maintenance cycle
   */
  startMaintenance(
    performMaintenance: () => Promise<void>,
    intervalMs = 60000
  ): void {
    this.maintenanceInterval = setInterval(
      () => void performMaintenance(),
      intervalMs
    );
  }

  /**
   * Stop maintenance tasks
   */
  stopMaintenance(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = undefined;
    }
  }

  /**
   * Perform pool maintenance
   */
  async performMaintenance(operations: MaintenanceOperations): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    logger.debug('Performing pool maintenance');

    await this.removeIdleBrowsers(operations);
    await this.restartUnhealthyBrowsers(operations);
    await this.ensureMinimumBrowsers(operations);
  }

  /**
   * Remove idle browsers if above minimum
   */
  private async removeIdleBrowsers(operations: MaintenanceOperations): Promise<void> {
    const { browsers, options, removeBrowser } = operations;
    
    if (browsers.size <= 1) {
      return;
    }

    for (const instance of browsers.values()) {
      if (isIdleTooLong(instance, options.idleTimeout)) {
        await removeBrowser(instance.id);
        
        if (browsers.size <= 1) {
          break;
        }
      }
    }
  }

  /**
   * Restart browsers that need it
   */
  private async restartUnhealthyBrowsers(operations: MaintenanceOperations): Promise<void> {
    const { browsers, handleUnhealthyBrowser } = operations;
    
    for (const instance of browsers.values()) {
      if (needsRestart(instance)) {
        await handleUnhealthyBrowser(instance.id);
      }
    }
  }

  /**
   * Ensure minimum browsers
   */
  private async ensureMinimumBrowsers(operations: MaintenanceOperations): Promise<void> {
    const { browsers, launchNewBrowser } = operations;
    
    while (browsers.size < 1 && !this.isShuttingDown) {
      try {
        await launchNewBrowser();
      } catch (error) {
        logger.error({ error }, 'Failed to launch browser during maintenance');
        break;
      }
    }
  }

  /**
   * Remove a browser from the pool
   */
  async removeBrowser(
    browserId: string,
    browsers: Map<string, InternalBrowserInstance>,
    healthMonitor: BrowserHealthMonitor
  ): Promise<void> {
    const instance = browsers.get(browserId);
    if (!instance) {
      return;
    }

    logger.info({ browserId }, 'Removing browser from pool');

    // Stop health monitoring
    healthMonitor.stopMonitoring(browserId);

    // Close browser
    await closeBrowser(instance.browser);

    // Remove from pool
    browsers.delete(browserId);
  }

  /**
   * Handle unhealthy browser
   */
  async handleUnhealthyBrowser(
    browserId: string,
    browsers: Map<string, InternalBrowserInstance>,
    healthMonitor: BrowserHealthMonitor,
    options: BrowserPoolOptions,
    onHealthCheckFailed: (browserId: string) => void
  ): Promise<void> {
    const instance = browsers.get(browserId);
    if (!instance) {
      return;
    }

    logger.warn({ browserId }, 'Handling unhealthy browser');

    try {
      // Restart the browser
      const newBrowser = await restartBrowser(
        instance,
        options
      );

      // Update instance with new browser
      instance.browser = newBrowser;
      instance.errorCount = 0;
      
      // Keep instance in map (already there)
      // browsers.set(browserId, instance); - not needed, already in map

      // Restart health monitoring
      healthMonitor.startMonitoring(
        browserId,
        newBrowser,
        instance,
        () => onHealthCheckFailed(browserId),
        options.healthCheckInterval
      );

    } catch (error) {
      logger.error({ browserId, error }, 'Failed to restart unhealthy browser');
      
      // Remove from pool
      await this.removeBrowser(browserId, browsers, healthMonitor);
    }
  }

  /**
   * Recycle a browser instance
   */
  async recycleBrowser(
    browserId: string,
    browsers: Map<string, InternalBrowserInstance>,
    options: BrowserPoolOptions
  ): Promise<void> {
    const instance = browsers.get(browserId);
    if (!instance) {
      return;
    }

    logger.info({ browserId }, 'Recycling browser');

    try {
      const newBrowser = await restartBrowser(instance, options);
      
      // Update instance with new browser
      instance.browser = newBrowser;
      instance.errorCount = 0;
      // Instance already in map, no need to set again
    } catch (error) {
      logger.error({ browserId, error }, 'Failed to recycle browser');
      throw error;
    }
  }

  /**
   * Clean up idle browsers
   */
  async cleanupIdle(
    browsers: Map<string, InternalBrowserInstance>,
    options: BrowserPoolOptions,
    removeBrowser: (browserId: string) => Promise<void>
  ): Promise<number> {
    let cleaned = 0;

    for (const [browserId, instance] of browsers) {
      if (isIdleTooLong(instance, options.idleTimeout) && browsers.size > 1) {
        await removeBrowser(browserId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Perform health check on all browsers
   * @nist si-4 "Information system monitoring"
   */
  healthCheck(browsers: Map<string, InternalBrowserInstance>): Map<string, boolean> {
    const results = new Map<string, boolean>();

    for (const [browserId, instance] of browsers) {
      try {
        const isHealthy = instance.browser.isConnected();
        results.set(browserId, isHealthy);
      } catch {
        results.set(browserId, false);
      }
    }

    return results;
  }

  /**
   * Set shutdown state
   */
  setShuttingDown(value: boolean): void {
    this.isShuttingDown = value;
  }
}