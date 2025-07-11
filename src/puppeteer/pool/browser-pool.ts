/**
 * Browser Pool Implementation
 * @module puppeteer/pool/browser-pool
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist ac-12 "Session termination"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
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
import { acquireBrowserFacade } from './browser-pool-facade.js';
import {
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
  createBrowserPoolHelpers,
} from './browser-pool-lifecycle.js';
import { BrowserPoolMetrics, type ExtendedPoolMetrics } from './browser-pool-metrics.js';
import { BrowserPoolEventLogger } from './browser-pool-event-logger.js';
import { BrowserPoolResourceMonitor } from './browser-pool-resource-monitor.js';
import { BrowserPoolPageManager } from './browser-pool-page-manager.js';
import { BrowserPoolMetricsHandler } from './browser-pool-metrics-handler.js';
import { BrowserPoolLifecycleHandler } from './browser-pool-lifecycle-handler.js';

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
  private eventLogger: BrowserPoolEventLogger;
  private resourceMonitor: BrowserPoolResourceMonitor;
  private pageManager: BrowserPoolPageManager;
  private metricsHandler: BrowserPoolMetricsHandler;
  private lifecycleHandler: BrowserPoolLifecycleHandler;

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

    // Initialize handler modules
    this.eventLogger = new BrowserPoolEventLogger(this.browsers, this.options, (event, data) =>
      this.emit(event, data),
    );
    this.resourceMonitor = new BrowserPoolResourceMonitor(this.browsers, this.metrics);
    this.metricsHandler = new BrowserPoolMetricsHandler(
      this.metrics,
      this.browsers,
      this.options.maxBrowsers,
    );
    this.pageManager = new BrowserPoolPageManager(
      this.browsers,
      this.options,
      this.eventLogger,
      this.metricsHandler,
      (browserId, sessionId) => this.releaseBrowser(browserId, sessionId),
    );

    // Initialize lifecycle handler
    this.lifecycleHandler = new BrowserPoolLifecycleHandler(
      this.browsers,
      this.options,
      this.healthMonitor,
      this.queue,
      this.maintenance,
      this.eventLogger,
      this.metricsHandler,
      (event, data) => this.emit(event, data),
    );
  }

  /**
   * Initialize the pool
   * @nist ac-3 "Access enforcement"
   */
  async initialize(): Promise<void> {
    // Log browser pool initialization
    await this.eventLogger.logPoolInitialization();

    await initializePoolWithBrowsers(this, this.options.maxBrowsers, () =>
      this.lifecycleHandler.launchNewBrowser(),
    );

    // Start resource monitoring every 30 seconds
    this.resourceMonitor.startResourceMonitoring();
  }

  /**
   * Acquire a browser for a session
   * @nist ac-3 "Access enforcement"
   * @nist ac-4 "Information flow enforcement"
   */
  async acquireBrowser(sessionId: string): Promise<BrowserInstance> {
    const helpers = createBrowserPoolHelpers(this.browsers, this.options, (event, data) =>
      this.emit(event, data),
    );

    try {
      const browser = await acquireBrowserFacade({
        sessionId,
        isShuttingDown: this.isShuttingDown,
        findIdleBrowser: helpers.findIdleBrowser,
        activateBrowser: helpers.activateBrowser,
        createAndAcquireBrowser: (sid) => this.lifecycleHandler.createAndAcquireBrowser(sid),
        canCreateNewBrowser: helpers.canCreateNewBrowser,
        queueAcquisition: (sid) => this.queueAcquisition(sid),
      });

      // Log successful browser acquisition
      await this.eventLogger.logBrowserAcquisition(true, sessionId, browser.id);

      return browser;
    } catch (error) {
      // Log browser acquisition failure
      await this.eventLogger.logBrowserAcquisition(
        false,
        sessionId,
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Release a browser back to the pool
   * @nist ac-12 "Session termination"
   */
  async releaseBrowser(browserId: string, sessionId: string): Promise<void> {
    try {
      releaseBrowser(browserId, this.browsers, this.queue, (id) =>
        this.emit('browser:released', { browserId: id }),
      );

      // Log browser release
      await this.eventLogger.logBrowserRelease(true, browserId, sessionId);
    } catch (error) {
      // Log browser release failure
      await this.eventLogger.logBrowserRelease(
        false,
        browserId,
        sessionId,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
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
    return this.metricsHandler.getExtendedMetrics();
  }

  /**
   * Shutdown the pool
   * @nist ac-12 "Session termination"
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.resourceMonitor.stopResourceMonitoring();

    try {
      await shutdownBrowserPool(this.browsers, this.healthMonitor, this.queue, this.maintenance);

      // Log successful shutdown
      await this.eventLogger.logPoolShutdown(true);
    } catch (error) {
      // Log shutdown failure
      await this.eventLogger.logPoolShutdown(
        false,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Create a new page in a browser
   * @nist ac-4 "Information flow enforcement"
   */
  async createPage(browserId: string, sessionId: string): Promise<Page> {
    return this.pageManager.createPage(browserId, sessionId);
  }

  /**
   * Close a page in a browser
   */
  async closePage(browserId: string, sessionId: string): Promise<void> {
    return this.pageManager.closePage(browserId, sessionId);
  }

  /**
   * Perform health check on all browsers
   * @nist si-4 "Information system monitoring"
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    return this.resourceMonitor.performHealthCheck();
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
      removeBrowser: (id) => this.lifecycleHandler.removeBrowser(id),
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
      this.lifecycleHandler.removeBrowser(browserId),
    );
  }

  /**
   * Configure pool options
   * @nist cm-7 "Least functionality"
   */
  configure(options: Partial<BrowserPoolOptions>): void {
    const oldOptions = { ...this.options };
    this.options = configure(this.options, options, this.maintenance, () =>
      this.lifecycleHandler.performMaintenance(),
    );

    // Log configuration change
    void this.eventLogger.logConfigurationChange(oldOptions, this.options, Object.keys(options));
  }

  /**
   * Delegate methods to lifecycleHandler
   */
  private performMaintenance(): Promise<void> {
    return this.lifecycleHandler.performMaintenance();
  }

  private queueAcquisition(sessionId: string): Promise<BrowserInstance> {
    return this.lifecycleHandler.queueAcquisition(sessionId);
  }
}
