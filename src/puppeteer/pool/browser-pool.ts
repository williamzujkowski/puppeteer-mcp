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
import { AppError } from '../../core/errors/app-error.js';
import { createLogger } from '../../utils/logger.js';
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
import {
  findIdleBrowser,
  createPage as createBrowserPage,
  closePage as closeBrowserPage,
  listBrowsers,
} from './browser-pool-operations.js';
import {
  createAndAcquireBrowser,
  queueAcquisition,
  launchNewBrowser,
} from './browser-pool-acquisition.js';
import { getPoolMetrics } from './browser-pool-metrics.js';
import { DEFAULT_OPTIONS, configurePoolOptions } from './browser-pool-config.js';
import { initializePool } from './browser-pool-init.js';
import { shutdownPool } from './browser-pool-shutdown.js';
import { setupQueueHandlers } from './browser-pool-event-setup.js';
import { acquireBrowser, releaseBrowser } from './browser-pool-acquisition-handlers.js';
import {
  activateBrowserForSession,
  handleRemoveBrowser,
  handleUnhealthyBrowserWithEvent,
  performMaintenanceWrapper,
} from './browser-pool-private-methods.js';

const logger = createLogger('browser-pool');

/**
 * Browser pool implementation
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export class BrowserPool extends EventEmitter implements IBrowserPool {
  private options: BrowserPoolOptions;
  private browsers = new Map<string, InternalBrowserInstance>();
  private healthMonitor = new BrowserHealthMonitor();
  private queue = new BrowserQueue();
  private maintenance = new BrowserPoolMaintenance();
  private isShuttingDown = false;

  constructor(options: Partial<BrowserPoolOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options } as BrowserPoolOptions;
    
    // Start maintenance cycle
    this.maintenance.startMaintenance(
      () => this.performMaintenance(),
      60000 // 1 minute
    );

    // Set up queue event handling
    setupQueueHandlers(this, this.queue, () => this.findIdleBrowser());
  }

  /**
   * Initialize the pool
   * @nist ac-3 "Access enforcement"
   */
  async initialize(): Promise<void> {
    await initializePool(this, this.options.maxBrowsers, () => this.launchNewBrowser());
  }

  /**
   * Acquire a browser for a session
   * @nist ac-3 "Access enforcement"
   * @nist ac-4 "Information flow enforcement"
   */
  async acquireBrowser(sessionId: string): Promise<BrowserInstance> {
    return acquireBrowser(
      sessionId,
      this.isShuttingDown,
      () => this.findIdleBrowser(),
      (instance, sid) => this.activateBrowser(instance, sid),
      (sid) => this.createAndAcquireBrowser(sid),
      () => this.browsers.size < this.options.maxBrowsers,
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
    return this.browsers.get(browserId);
  }

  /**
   * Get pool metrics
   * @nist au-3 "Content of audit records"
   */
  getMetrics(): PoolMetrics {
    return getPoolMetrics(this.browsers, this.options.maxBrowsers);
  }

  /**
   * Shutdown the pool
   * @nist ac-12 "Session termination"
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.maintenance.setShuttingDown(true);
    this.maintenance.stopMaintenance();
    await shutdownPool(this.browsers, this.healthMonitor, this.queue);
  }

  /**
   * Find an idle browser
   * @private
   */
  private findIdleBrowser(): InternalBrowserInstance | null {
    return findIdleBrowser(this.browsers);
  }

  /**
   * Activate a browser for a session
   * @private
   */
  private activateBrowser(instance: InternalBrowserInstance, sessionId: string): InternalBrowserInstance {
    return activateBrowserForSession(
      instance,
      sessionId,
      (browserId, sid) => this.emit('browser:acquired', { browserId, sessionId: sid })
    );
  }

  /**
   * Create and acquire a new browser
   * @private
   */
  private async createAndAcquireBrowser(sessionId: string): Promise<BrowserInstance> {
    const instance = await createAndAcquireBrowser(
      sessionId,
      this.options,
      this.browsers,
      this.healthMonitor,
      (browserId) => void this.handleUnhealthyBrowser(browserId)
    );
    
    this.emit('browser:acquired', { browserId: instance.id, sessionId });
    return instance;
  }

  /**
   * Queue a browser acquisition request
   * @private
   */
  private queueAcquisition(sessionId: string): Promise<BrowserInstance> {
    return queueAcquisition(
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
    const result = await launchNewBrowser(
      this.options,
      this.browsers,
      this.healthMonitor,
      (browserId) => void this.handleUnhealthyBrowser(browserId)
    );
    
    this.emit('browser:created', { browserId: result.instance.id });
    return result;
  }

  /**
   * Handle unhealthy browser
   * @private
   */
  private async handleUnhealthyBrowser(browserId: string): Promise<void> {
    await handleUnhealthyBrowserWithEvent(
      browserId,
      this.browsers,
      async (id) => {
        await this.maintenance.handleUnhealthyBrowser(
          id,
          this.browsers,
          this.healthMonitor,
          this.options,
          (bid) => void this.handleUnhealthyBrowser(bid)
        );
      },
      (id) => this.emit('browser:restarted', { browserId: id }),
      (id) => this.emit('browser:removed', { browserId: id })
    );
  }


  /**
   * Perform pool maintenance
   * @private
   */
  private async performMaintenance(): Promise<void> {
    await performMaintenanceWrapper(
      () => this.maintenance.performMaintenance(
        this.browsers,
        this.options,
        (browserId) => this.removeBrowser(browserId),
        (browserId) => this.handleUnhealthyBrowser(browserId),
        () => this.launchNewBrowser()
      )
    );
  }

  /**
   * Remove a browser from the pool
   * @private
   */
  private async removeBrowser(browserId: string): Promise<void> {
    await handleRemoveBrowser(
      browserId,
      (id) => this.maintenance.removeBrowser(id, this.browsers, this.healthMonitor),
      (id) => this.emit('browser:removed', { browserId: id })
    );
  }

  /**
   * Create a new page in a browser
   * @nist ac-4 "Information flow enforcement"
   */
  async createPage(browserId: string, sessionId: string): Promise<Page> {
    return createBrowserPage(browserId, sessionId, this.browsers);
  }

  /**
   * Close a page in a browser
   */
  async closePage(browserId: string, sessionId: string): Promise<void> {
    return closeBrowserPage(browserId, sessionId, this.browsers);
  }

  /**
   * Perform health check on all browsers
   * @nist si-4 "Information system monitoring"
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    return this.maintenance.healthCheck(this.browsers);
  }

  /**
   * Recycle a browser instance
   */
  async recycleBrowser(browserId: string): Promise<void> {
    try {
      await this.maintenance.recycleBrowser(
        browserId,
        this.browsers,
        this.options
      );
    } catch (error) {
      logger.error({ browserId, error }, 'Failed to recycle browser');
      await this.removeBrowser(browserId);
    }
  }

  /**
   * List all browser instances
   */
  listBrowsers(): BrowserInstance[] {
    return listBrowsers(this.browsers);
  }

  /**
   * Clean up idle browsers
   */
  async cleanupIdle(): Promise<number> {
    return this.maintenance.cleanupIdle(
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
    this.options = configurePoolOptions(this.options, options);
    
    // Restart maintenance if interval changed
    if (options.healthCheckInterval) {
      this.maintenance.stopMaintenance();
      this.maintenance.startMaintenance(
        () => this.performMaintenance(),
        60000
      );
    }
  }

}