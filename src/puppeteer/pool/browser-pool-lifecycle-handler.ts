/**
 * Browser Pool Lifecycle Handler
 * Handles browser creation, acquisition, and lifecycle management operations
 * @module puppeteer/pool/browser-pool-lifecycle-handler
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import type { Browser } from 'puppeteer';
import type { BrowserInstance, BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import type { BrowserHealthMonitor } from './browser-health.js';
import type { BrowserQueue } from './browser-queue.js';
import type { BrowserPoolMaintenance } from './browser-pool-maintenance.js';
import type { BrowserPoolEventLogger } from './browser-pool-event-logger.js';
import type { BrowserPoolMetricsHandler } from './browser-pool-metrics-handler.js';
import {
  createAndAcquireNewBrowser,
  queueBrowserAcquisition,
  launchBrowser,
} from './browser-pool-lifecycle.js';
import {
  handleUnhealthyBrowserDelegate,
  performPoolMaintenance,
  removeBrowserFromPool,
} from './browser-pool-private-methods.js';

/**
 * Browser Pool Lifecycle Handler
 * Manages browser creation, acquisition, and lifecycle operations
 */
export class BrowserPoolLifecycleHandler {
  constructor(
    private browsers: Map<string, InternalBrowserInstance>,
    private options: BrowserPoolOptions,
    private healthMonitor: BrowserHealthMonitor,
    private queue: BrowserQueue,
    private maintenance: BrowserPoolMaintenance,
    private eventLogger: BrowserPoolEventLogger,
    private metricsHandler: BrowserPoolMetricsHandler,
    private emitEvent: (event: string, data: any) => void,
  ) {}

  /**
   * Create and acquire a new browser
   */
  async createAndAcquireBrowser(sessionId: string): Promise<BrowserInstance> {
    return createAndAcquireNewBrowser({
      sessionId,
      options: this.options,
      browsers: this.browsers,
      healthMonitor: this.healthMonitor,
      handleUnhealthyBrowser: (browserId) => this.handleUnhealthyBrowser(browserId),
      emitEvent: this.emitEvent,
    });
  }

  /**
   * Queue a browser acquisition request
   */
  async queueAcquisition(sessionId: string): Promise<BrowserInstance> {
    const startTime = Date.now();
    this.metricsHandler.recordQueueAdd();

    try {
      const browser = await queueBrowserAcquisition(
        sessionId,
        this.queue,
        this.options.acquisitionTimeout ?? 30000,
      );
      const waitTime = Date.now() - startTime;
      this.metricsHandler.recordQueueRemove(waitTime);
      return browser;
    } catch (error) {
      // Remove from queue on error
      const waitTime = Date.now() - startTime;
      this.metricsHandler.recordQueueRemove(waitTime);
      throw error;
    }
  }

  /**
   * Launch a new browser
   */
  async launchNewBrowser(): Promise<{
    browser: Browser;
    instance: InternalBrowserInstance;
  }> {
    const startTime = Date.now();
    
    try {
      const result = await launchBrowser({
        options: this.options,
        browsers: this.browsers,
        healthMonitor: this.healthMonitor,
        handleUnhealthyBrowser: (browserId) => this.handleUnhealthyBrowser(browserId),
        emitEvent: this.emitEvent,
      });

      const creationTime = Date.now() - startTime;
      this.metricsHandler.recordBrowserCreated(result.instance.id, creationTime);

      // Log browser creation
      await this.eventLogger.logBrowserCreation(true, result.instance.id, creationTime);

      return result;
    } catch (error) {
      // Log browser creation failure
      const creationTime = Date.now() - startTime;
      await this.eventLogger.logBrowserCreation(
        false,
        undefined,
        creationTime,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Handle unhealthy browser
   */
  async handleUnhealthyBrowser(browserId: string): Promise<void> {
    this.metricsHandler.recordError('unhealthy_browser', browserId);

    let success = false;

    try {
      await handleUnhealthyBrowserDelegate({
        browserId,
        browsers: this.browsers,
        maintenance: this.maintenance,
        healthMonitor: this.healthMonitor,
        options: this.options,
        emitEvent: this.emitEvent,
        handleUnhealthyBrowser: (id) => this.handleUnhealthyBrowser(id),
      });
      success = true;
      
      // Log successful browser recovery
      await this.eventLogger.logBrowserRecovery(true, browserId);
    } catch (error) {
      success = false;
      
      // Log browser recovery failure
      await this.eventLogger.logBrowserRecovery(
        false,
        browserId,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    } finally {
      this.metricsHandler.recordRecovery(success, browserId);
    }
  }

  /**
   * Perform pool maintenance
   */
  async performMaintenance(): Promise<void> {
    await performPoolMaintenance({
      browsers: this.browsers,
      options: this.options,
      maintenance: this.maintenance,
      removeBrowser: (browserId) => this.removeBrowser(browserId),
      handleUnhealthyBrowser: (browserId) => this.handleUnhealthyBrowser(browserId),
      launchNewBrowser: () => this.launchNewBrowser(),
    });
  }

  /**
   * Remove a browser from the pool
   */
  async removeBrowser(browserId: string): Promise<void> {
    // Calculate browser lifetime
    const browser = this.browsers.get(browserId);
    if (browser) {
      const lifetime = Date.now() - browser.createdAt.getTime();
      this.metricsHandler.recordBrowserDestroyed(browserId, lifetime);
    }

    await removeBrowserFromPool({
      browserId,
      browsers: this.browsers,
      healthMonitor: this.healthMonitor,
      maintenance: this.maintenance,
      emitEvent: this.emitEvent,
    });
  }
}