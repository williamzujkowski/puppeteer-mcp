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
  type InternalBrowserInstance 
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
  healthCheck,
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

  constructor(options: Partial<BrowserPoolOptions> = {}) {
    super();
    const components = initializeBrowserPool(
      this,
      options,
      () => createBrowserPoolHelpers(this.browsers, this.options, (event, data) => this.emit(event, data)).findIdleBrowser(),
      () => this.performMaintenance()
    );
    
    this.options = components.options;
    this.browsers = components.browsers;
    this.healthMonitor = components.healthMonitor;
    this.queue = components.queue;
    this.maintenance = components.maintenance;
  }

  /**
   * Initialize the pool
   * @nist ac-3 "Access enforcement"
   */
  async initialize(): Promise<void> {
    await initializePoolWithBrowsers(this, this.options.maxBrowsers, () => this.launchNewBrowser());
  }

  /**
   * Acquire a browser for a session
   * @nist ac-3 "Access enforcement"
   * @nist ac-4 "Information flow enforcement"
   */
  async acquireBrowser(sessionId: string): Promise<BrowserInstance> {
    const helpers = createBrowserPoolHelpers(this.browsers, this.options, (event, data) => this.emit(event, data));
    return acquireBrowserFacade(
      sessionId,
      this.isShuttingDown,
      helpers.findIdleBrowser,
      helpers.activateBrowser,
      (sid) => this.createAndAcquireBrowser(sid),
      helpers.canCreateNewBrowser,
      (sid) => this.queueAcquisition(sid)
    );
  }

  /**
   * Release a browser back to the pool
   * @nist ac-12 "Session termination"
   */
  async releaseBrowser(browserId: string): Promise<void> {
    releaseBrowser(
      browserId,
      this.browsers,
      this.queue,
      (id) => this.emit('browser:released', { browserId: id })
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
   * Shutdown the pool
   * @nist ac-12 "Session termination"
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    await shutdownBrowserPool(this.browsers, this.healthMonitor, this.queue, this.maintenance);
  }


  /**
   * Create and acquire a new browser
   * @private
   */
  private async createAndAcquireBrowser(sessionId: string): Promise<BrowserInstance> {
    return createAndAcquireNewBrowser(
      sessionId,
      this.options,
      this.browsers,
      this.healthMonitor,
      (browserId) => this.handleUnhealthyBrowser(browserId),
      (event, data) => this.emit(event, data)
    );
  }

  /**
   * Queue a browser acquisition request
   * @private
   */
  private queueAcquisition(sessionId: string): Promise<BrowserInstance> {
    return queueBrowserAcquisition(
      sessionId,
      this.queue,
      this.options.acquisitionTimeout ?? 30000
    );
  }

  /**
   * Launch a new browser
   * @private
   */
  private async launchNewBrowser(): Promise<{ browser: Browser; instance: InternalBrowserInstance }> {
    return launchBrowser(
      this.options,
      this.browsers,
      this.healthMonitor,
      (browserId) => this.handleUnhealthyBrowser(browserId),
      (event, data) => this.emit(event, data)
    );
  }

  /**
   * Handle unhealthy browser
   * @private
   */
  private async handleUnhealthyBrowser(browserId: string): Promise<void> {
    await handleUnhealthyBrowserDelegate(
      browserId,
      this.browsers,
      this.maintenance,
      this.healthMonitor,
      this.options,
      (event, data) => this.emit(event, data),
      (id) => this.handleUnhealthyBrowser(id)
    );
  }


  /**
   * Perform pool maintenance
   * @private
   */
  private async performMaintenance(): Promise<void> {
    await performPoolMaintenance(
      this.browsers,
      this.options,
      this.maintenance,
      (browserId) => this.removeBrowser(browserId),
      (browserId) => this.handleUnhealthyBrowser(browserId),
      () => this.launchNewBrowser()
    );
  }

  /**
   * Remove a browser from the pool
   * @private
   */
  private async removeBrowser(browserId: string): Promise<void> {
    await removeBrowserFromPool(
      browserId,
      this.browsers,
      this.healthMonitor,
      this.maintenance,
      (event, data) => this.emit(event, data)
    );
  }

  /**
   * Create a new page in a browser
   * @nist ac-4 "Information flow enforcement"
   */
  async createPage(browserId: string, sessionId: string): Promise<Page> {
    return createPage(browserId, sessionId, this.browsers);
  }

  /**
   * Close a page in a browser
   */
  async closePage(browserId: string, sessionId: string): Promise<void> {
    return closePage(browserId, sessionId, this.browsers);
  }

  /**
   * Perform health check on all browsers
   * @nist si-4 "Information system monitoring"
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    return healthCheck(this.maintenance, this.browsers);
  }

  /**
   * Recycle a browser instance
   */
  async recycleBrowser(browserId: string): Promise<void> {
    return recycleBrowser(
      browserId,
      this.browsers,
      this.options,
      this.maintenance,
      (id) => this.removeBrowser(id)
    );
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
    return cleanupIdle(
      this.maintenance,
      this.browsers,
      this.options,
      (browserId) => this.removeBrowser(browserId)
    );
  }

  /**
   * Configure pool options
   * @nist cm-7 "Least functionality"
   */
  configure(options: Partial<BrowserPoolOptions>): void {
    this.options = configure(
      this.options,
      options,
      this.maintenance,
      () => this.performMaintenance()
    );
  }

}