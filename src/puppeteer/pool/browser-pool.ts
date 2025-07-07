/**
 * Browser Pool Implementation
 * @module puppeteer/pool/browser-pool
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist ac-12 "Session termination"
 * @nist au-3 "Content of audit records"
 */

import type { Browser, Page } from 'puppeteer';
import { EventEmitter } from 'events';
import type {
  BrowserPool as IBrowserPool,
  BrowserInstance,
  BrowserPoolOptions,
  PoolMetrics,
} from '../interfaces/browser-pool.interface.js';
import { BrowserHealthMonitor } from './browser-health.js';
import { BrowserQueue } from './browser-queue.js';
import {
  BrowserPoolMaintenance,
  type InternalBrowserInstance,
} from './browser-pool-maintenance.js';
import { releaseBrowser } from './browser-pool-acquisition-handlers.js';
import {
  handleUnhealthyBrowserDelegate,
  performPoolMaintenance,
  removeBrowserFromPool,
} from './browser-pool-private-methods.js';
import { acquireBrowserFacade } from './browser-pool-facade.js';
import {
  createPage,
  closePage,
  recycleBrowser,
  listBrowsersPublic,
  cleanupIdle,
  configure,
  getBrowser,
  getMetrics,
} from './browser-pool-public-methods.js';
import {
  initializeBrowserPool,
  initializePoolWithBrowsers,
  shutdownBrowserPool,
  createAndAcquireNewBrowser,
  queueBrowserAcquisition,
  launchBrowser,
  createBrowserPoolHelpers,
} from './browser-pool-lifecycle.js';
import { BrowserPoolMetrics, type ExtendedPoolMetrics } from './browser-pool-metrics.js';
import { checkBrowserHealth } from './browser-health.js';

/**
 * Browser pool implementation
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export class BrowserPool extends EventEmitter implements IBrowserPool {
  private options: BrowserPoolOptions;
  private browsers: Map<string, InternalBrowserInstance>;
  private healthMonitor: BrowserHealthMonitor;
  private queue: BrowserQueue;
  private maintenance: BrowserPoolMaintenance;
  private isShuttingDown = false;
  private metrics: BrowserPoolMetrics;
  private resourceMonitorInterval?: NodeJS.Timeout;

  constructor(options: Partial<BrowserPoolOptions> = {}) {
    super();
    const components = initializeBrowserPool(
      this,
      options,
      () =>
        createBrowserPoolHelpers(this.browsers, this.options, (event, data) =>
          this.emit(event, data),
        ).findIdleBrowser(),
      () => this.performMaintenance(),
    );

    this.options = components.options;
    this.browsers = components.browsers;
    this.healthMonitor = components.healthMonitor;
    this.queue = components.queue;
    this.maintenance = components.maintenance;
    this.metrics = new BrowserPoolMetrics();
  }

  /**
   * Initialize the pool
   * @nist ac-3 "Access enforcement"
   */
  async initialize(): Promise<void> {
    await initializePoolWithBrowsers(this, this.options.maxBrowsers, () => this.launchNewBrowser());
    
    // Start resource monitoring every 30 seconds
    this.startResourceMonitoring();
  }

  /**
   * Acquire a browser for a session
   * @nist ac-3 "Access enforcement"
   * @nist ac-4 "Information flow enforcement"
   */
  acquireBrowser(sessionId: string): Promise<BrowserInstance> {
    const helpers = createBrowserPoolHelpers(this.browsers, this.options, (event, data) =>
      this.emit(event, data),
    );
    return acquireBrowserFacade({
      sessionId,
      isShuttingDown: this.isShuttingDown,
      findIdleBrowser: helpers.findIdleBrowser,
      activateBrowser: helpers.activateBrowser,
      createAndAcquireBrowser: (sid) => this.createAndAcquireBrowser(sid),
      canCreateNewBrowser: helpers.canCreateNewBrowser,
      queueAcquisition: (sid) => this.queueAcquisition(sid),
    });
  }

  /**
   * Release a browser back to the pool
   * @nist ac-12 "Session termination"
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async releaseBrowser(browserId: string, _sessionId: string): Promise<void> {
    releaseBrowser(browserId, this.browsers, this.queue, (id) =>
      this.emit('browser:released', { browserId: id }),
    );
  }

  /**
   * Get browser instance by ID
   * @nist ac-3 "Access enforcement"
   */
  getBrowser(browserId: string): BrowserInstance | undefined {
    return getBrowser(browserId, this.browsers);
  }

  /**
   * Get pool metrics
   * @nist au-3 "Content of audit records"
   */
  getMetrics(): PoolMetrics {
    return getMetrics(this.browsers, this.options.maxBrowsers);
  }

  /**
   * Get extended pool metrics with performance data
   * @nist au-3 "Content of audit records"
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getExtendedMetrics(): ExtendedPoolMetrics {
    return this.metrics.getMetrics(this.browsers, this.options.maxBrowsers);
  }

  /**
   * Shutdown the pool
   * @nist ac-12 "Session termination"
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stopResourceMonitoring();
    await shutdownBrowserPool(this.browsers, this.healthMonitor, this.queue, this.maintenance);
  }

  /**
   * Create and acquire a new browser
   * @private
   */
  private createAndAcquireBrowser(sessionId: string): Promise<BrowserInstance> {
    return createAndAcquireNewBrowser({
      sessionId,
      options: this.options,
      browsers: this.browsers,
      healthMonitor: this.healthMonitor,
      handleUnhealthyBrowser: (browserId) => this.handleUnhealthyBrowser(browserId),
      emitEvent: (event, data) => this.emit(event, data),
    });
  }

  /**
   * Queue a browser acquisition request
   * @private
   */
  private async queueAcquisition(sessionId: string): Promise<BrowserInstance> {
    const startTime = Date.now();
    this.metrics.recordQueueAdd();
    
    try {
      const browser = await queueBrowserAcquisition(sessionId, this.queue, this.options.acquisitionTimeout ?? 30000);
      const waitTime = Date.now() - startTime;
      this.metrics.recordQueueRemove(waitTime);
      return browser;
    } catch (error) {
      // Remove from queue on error
      const waitTime = Date.now() - startTime;
      this.metrics.recordQueueRemove(waitTime);
      throw error;
    }
  }

  /**
   * Launch a new browser
   * @private
   */
  private async launchNewBrowser(): Promise<{ browser: Browser; instance: InternalBrowserInstance }> {
    const startTime = Date.now();
    const result = await launchBrowser({
      options: this.options,
      browsers: this.browsers,
      healthMonitor: this.healthMonitor,
      handleUnhealthyBrowser: (browserId) => this.handleUnhealthyBrowser(browserId),
      emitEvent: (event, data) => this.emit(event, data),
    });
    
    const creationTime = Date.now() - startTime;
    this.metrics.recordBrowserCreated(result.instance.id, creationTime);
    
    return result;
  }

  /**
   * Handle unhealthy browser
   * @private
   */
  private async handleUnhealthyBrowser(browserId: string): Promise<void> {
    this.metrics.recordError('unhealthy_browser', browserId);
    
    let success = false;
    
    try {
      await handleUnhealthyBrowserDelegate({
        browserId,
        browsers: this.browsers,
        maintenance: this.maintenance,
        healthMonitor: this.healthMonitor,
        options: this.options,
        emitEvent: (event, data) => this.emit(event, data),
        handleUnhealthyBrowser: (id) => this.handleUnhealthyBrowser(id),
      });
      success = true;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      this.metrics.recordRecovery(success, browserId);
    }
  }

  /**
   * Perform pool maintenance
   * @private
   */
  private async performMaintenance(): Promise<void> {
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
   * @private
   */
  private async removeBrowser(browserId: string): Promise<void> {
    // Calculate browser lifetime
    const browser = this.browsers.get(browserId);
    if (browser) {
      const lifetime = Date.now() - browser.createdAt.getTime();
      this.metrics.recordBrowserDestroyed(browserId, lifetime);
    }
    
    await removeBrowserFromPool({
      browserId,
      browsers: this.browsers,
      healthMonitor: this.healthMonitor,
      maintenance: this.maintenance,
      emitEvent: (event, data) => this.emit(event, data),
    });
  }

  /**
   * Create a new page in a browser
   * @nist ac-4 "Information flow enforcement"
   */
  async createPage(browserId: string, sessionId: string): Promise<Page> {
    const startTime = Date.now();
    const page = await createPage(browserId, sessionId, this.browsers);
    const duration = Date.now() - startTime;
    this.metrics.recordPageCreation(duration);
    
    // Record utilization after page creation
    const utilization = (this.browsers.size / this.options.maxBrowsers) * 100;
    this.metrics.recordUtilization(utilization);
    
    return page;
  }

  /**
   * Close a page in a browser
   */
   
  async closePage(browserId: string, sessionId: string): Promise<void> {
    const startTime = Date.now();
    await closePage(browserId, sessionId, this.browsers);
    const duration = Date.now() - startTime;
    this.metrics.recordPageDestruction(duration);
    
    // Record utilization after page closure
    const utilization = (this.browsers.size / this.options.maxBrowsers) * 100;
    this.metrics.recordUtilization(utilization);
  }

  /**
   * Perform health check on all browsers
   * @nist si-4 "Information system monitoring"
   */
   
  async healthCheck(): Promise<Map<string, boolean>> {
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
    const successCount = Array.from(results.values()).filter(healthy => healthy).length;
    const success = successCount === results.size;
    this.metrics.recordHealthCheck(duration, success);
    
    return results;
  }

  /**
   * Recycle a browser instance
   */
  recycleBrowser(browserId: string): Promise<void> {
    return recycleBrowser({
      browserId,
      browsers: this.browsers,
      options: this.options,
      maintenance: this.maintenance,
      removeBrowser: (id) => this.removeBrowser(id),
    });
  }

  /**
   * List all browser instances
   */
  listBrowsers(): BrowserInstance[] {
    return listBrowsersPublic(this.browsers);
  }

  /**
   * Clean up idle browsers
   */
   
  async cleanupIdle(): Promise<number> {
    return cleanupIdle(this.maintenance, this.browsers, this.options, (browserId) =>
      this.removeBrowser(browserId),
    );
  }

  /**
   * Configure pool options
   * @nist cm-7 "Least functionality"
   */
  configure(options: Partial<BrowserPoolOptions>): void {
    this.options = configure(this.options, options, this.maintenance, () =>
      this.performMaintenance(),
    );
  }

  /**
   * Start periodic resource monitoring
   * @private
   */
  private startResourceMonitoring(): void {
    // Monitor resources every 30 seconds
    this.resourceMonitorInterval = setInterval(() => {
      void this.collectResourceMetrics();
    }, 30000);
  }

  /**
   * Stop resource monitoring
   * @private
   */
  private stopResourceMonitoring(): void {
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = undefined;
    }
  }

  /**
   * Collect resource metrics from all browsers
   * @private
   */
  private async collectResourceMetrics(): Promise<void> {
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
}
