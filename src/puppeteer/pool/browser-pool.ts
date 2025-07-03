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
  type RemoveBrowserFromPoolParams,
  type HandleUnhealthyBrowserDelegateParams,
  type PerformPoolMaintenanceParams,
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
  type RecycleBrowserParams,
} from './browser-pool-public-methods.js';
import {
  initializeBrowserPool,
  initializePoolWithBrowsers,
  shutdownBrowserPool,
  createAndAcquireNewBrowser,
  queueBrowserAcquisition,
  launchBrowser,
  createBrowserPoolHelpers,
  type CreateAndAcquireNewBrowserParams,
  type LaunchBrowserParams,
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
  acquireBrowser(sessionId: string): Promise<BrowserInstance> {
    const helpers = createBrowserPoolHelpers(this.browsers, this.options, (event, data) => this.emit(event, data));
    return acquireBrowserFacade({
      sessionId,
      isShuttingDown: this.isShuttingDown,
      findIdleBrowser: helpers.findIdleBrowser,
      activateBrowser: helpers.activateBrowser,
      createAndAcquireBrowser: (sid) => this.createAndAcquireBrowser(sid),
      canCreateNewBrowser: helpers.canCreateNewBrowser,
      queueAcquisition: (sid) => this.queueAcquisition(sid)
    });
  }

  /**
   * Release a browser back to the pool
   * @nist ac-12 "Session termination"
   */
  releaseBrowser(browserId: string): void {
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
  private createAndAcquireBrowser(sessionId: string): Promise<BrowserInstance> {
    return createAndAcquireNewBrowser({
      sessionId,
      options: this.options,
      browsers: this.browsers,
      healthMonitor: this.healthMonitor,
      handleUnhealthyBrowser: (browserId) => this.handleUnhealthyBrowser(browserId),
      emitEvent: (event, data) => this.emit(event, data)
    });
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
  private launchNewBrowser(): Promise<{ browser: Browser; instance: InternalBrowserInstance }> {
    return launchBrowser({
      options: this.options,
      browsers: this.browsers,
      healthMonitor: this.healthMonitor,
      handleUnhealthyBrowser: (browserId) => this.handleUnhealthyBrowser(browserId),
      emitEvent: (event, data) => this.emit(event, data)
    });
  }

  /**
   * Handle unhealthy browser
   * @private
   */
  private async handleUnhealthyBrowser(browserId: string): Promise<void> {
    await handleUnhealthyBrowserDelegate({
      browserId,
      browsers: this.browsers,
      maintenance: this.maintenance,
      healthMonitor: this.healthMonitor,
      options: this.options,
      emitEvent: (event, data) => this.emit(event, data),
      handleUnhealthyBrowser: (id) => this.handleUnhealthyBrowser(id)
    });
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
      launchNewBrowser: () => this.launchNewBrowser()
    });
  }

  /**
   * Remove a browser from the pool
   * @private
   */
  private async removeBrowser(browserId: string): Promise<void> {
    await removeBrowserFromPool({
      browserId,
      browsers: this.browsers,
      healthMonitor: this.healthMonitor,
      maintenance: this.maintenance,
      emitEvent: (event, data) => this.emit(event, data)
    });
  }

  /**
   * Create a new page in a browser
   * @nist ac-4 "Information flow enforcement"
   */
  createPage(browserId: string, sessionId: string): Promise<Page> {
    return createPage(browserId, sessionId, this.browsers);
  }

  /**
   * Close a page in a browser
   */
  closePage(browserId: string, sessionId: string): void {
    return closePage(browserId, sessionId, this.browsers);
  }

  /**
   * Perform health check on all browsers
   * @nist si-4 "Information system monitoring"
   */
  healthCheck(): Map<string, boolean> {
    return healthCheck(this.maintenance, this.browsers);
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
      removeBrowser: (id) => this.removeBrowser(id)
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
  cleanupIdle(): number {
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