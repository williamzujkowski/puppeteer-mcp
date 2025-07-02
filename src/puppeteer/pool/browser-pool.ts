/**
 * Browser Pool Implementation for Puppeteer
 * @module puppeteer/pool/browser-pool
 * @nist ac-3 "Access enforcement"
 * @nist au-9 "Protection of audit information"
 * @nist ac-4 "Information flow enforcement"
 * @nist sc-2 "Application partitioning"
 */

import { Page } from 'puppeteer';
import * as puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import type {
  BrowserPool as IBrowserPool,
  BrowserPoolOptions,
  BrowserInstance,
  PoolMetrics
} from '../interfaces/browser-pool.interface.js';
import { BrowserHealthChecker, type HealthCheckResult } from './browser-health-checker.js';
import { createLogger } from '../../utils/logger.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';

const logger = createLogger('browser-pool');

/**
 * Internal browser state
 */
interface InternalBrowserState {
  instance: BrowserInstance;
  status: 'idle' | 'active' | 'recycling';
  acquiredBy?: string; // Session ID
  pages: Map<string, Page>;
  idleSince?: Date;
  lifecycleTimer?: NodeJS.Timeout;
}

/**
 * Acquisition request for queuing
 */
interface AcquisitionRequest {
  sessionId: string;
  resolve: (instance: BrowserInstance) => void;
  reject: (error: Error) => void;
  timestamp: Date;
}

/**
 * Browser pool implementation
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export class BrowserPool implements IBrowserPool {
  private options: BrowserPoolOptions;
  private browsers: Map<string, InternalBrowserState> = new Map();
  private acquisitionQueue: AcquisitionRequest[] = [];
  private healthChecker: BrowserHealthChecker;
  private isShuttingDown = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private metrics = {
    browsersCreated: 0,
    browsersDestroyed: 0,
    totalLifetime: 0,
  };
  private acquisitionTimeout = 30000; // Default 30s

  constructor(options: BrowserPoolOptions) {
    this.options = this.validateOptions(options);
    this.healthChecker = new BrowserHealthChecker({
      maxMemoryMB: 512, // Default 512MB
      maxPageCount: this.options.maxPagesPerBrowser,
      responseTimeout: 5000,
      checkInterval: this.options.healthCheckInterval,
      enableAutoRecovery: true,
    });
  }

  /**
   * Initialize the browser pool
   * @nist ac-2 "Account management"
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  async initialize(): Promise<void> {
    logger.info({
      options: this.options,
    }, 'Initializing browser pool');

    // Start health check interval
    this.healthCheckInterval = setInterval(
      () => {
        void this.performHealthChecks();
      },
      this.options.healthCheckInterval
    );

    // Start cleanup interval
    this.cleanupInterval = setInterval(
      () => {
        void this.cleanupIdle();
      },
      Math.min(this.options.idleTimeout / 2, 30000)
    );

    await logSecurityEvent(SecurityEventType.SERVICE_START, {
      resource: 'browser-pool',
      result: 'success',
    });
  }

  /**
   * Acquire a browser instance from the pool
   * @nist ia-2 "Identification and authentication"
   * @nist ac-3 "Access enforcement"
   */
  async acquireBrowser(sessionId: string): Promise<BrowserInstance> {
    if (this.isShuttingDown) {
      throw new Error('Browser pool is shutting down');
    }

    logger.debug({ sessionId }, 'Browser acquisition requested');

    // Try to find an idle browser
    const idleBrowser = this.findIdleBrowser();
    if (idleBrowser) {
      return this.activateBrowser(idleBrowser, sessionId);
    }

    // Check if we can create a new browser
    if (this.browsers.size < this.options.maxBrowsers) {
      return this.createAndAcquireBrowser(sessionId);
    }

    // Queue the request
    return this.queueAcquisition(sessionId);
  }

  /**
   * Release a browser back to the pool
   * @nist ac-12 "Session termination"
   */
  async releaseBrowser(browserId: string, sessionId: string): Promise<void> {
    const state = this.browsers.get(browserId);
    
    if (!state) {
      throw new Error('Browser not found');
    }

    if (state.acquiredBy !== sessionId) {
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        userId: sessionId,
        resource: `browser:${browserId}`,
        result: 'failure',
        reason: 'Unauthorized session',
      });
      throw new Error('Unauthorized: Browser not acquired by this session');
    }

    // Check if browser should be recycled
    if (this.shouldRecycle(state.instance)) {
      state.status = 'recycling';
      await this.destroyBrowser(browserId);
      // Process queued requests
      this.processQueue();
      return;
    }

    // Mark as idle
    state.status = 'idle';
    state.acquiredBy = undefined;
    state.idleSince = new Date();
    state.instance.lastUsedAt = new Date();

    logger.info({
      browserId,
      sessionId,
      useCount: state.instance.useCount,
    }, 'Browser released to pool');

    // Process queued requests
    this.processQueue();
  }

  /**
   * Create a new page in a browser
   * @nist ac-4 "Information flow enforcement"
   */
  async createPage(browserId: string, sessionId: string): Promise<Page> {
    const state = this.browsers.get(browserId);
    
    if (!state) {
      throw new Error('Browser not found');
    }

    if (state.acquiredBy !== sessionId) {
      throw new Error('Unauthorized: Browser not acquired by this session');
    }

    if (state.pages.size >= this.options.maxPagesPerBrowser) {
      throw new Error('Page limit reached for browser');
    }

    const page = await state.instance.browser.newPage();
    const pageId = uuidv4();
    (page as any)._id = pageId;
    
    state.pages.set(pageId, page);
    state.instance.pageCount = state.pages.size;

    if (this.options.enableRequestInterception) {
      await page.setRequestInterception(true);
    }

    logger.debug({
      browserId,
      pageId,
      pageCount: state.pages.size,
    }, 'Page created');

    return page;
  }

  /**
   * Close a page in a browser
   */
  async closePage(browserId: string, pageId: string, sessionId: string): Promise<void> {
    const state = this.browsers.get(browserId);
    
    if (!state) {
      throw new Error('Browser not found');
    }

    if (state.acquiredBy !== sessionId) {
      throw new Error('Unauthorized: Browser not acquired by this session');
    }

    const page = state.pages.get(pageId);
    if (!page) {
      throw new Error('Page not found');
    }

    await page.close();
    state.pages.delete(pageId);
    state.instance.pageCount = state.pages.size;

    logger.debug({
      browserId,
      pageId,
      pageCount: state.pages.size,
    }, 'Page closed');
  }

  /**
   * Get current pool metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(): PoolMetrics {
    const totalBrowsers = this.browsers.size;
    const activeBrowsers = Array.from(this.browsers.values())
      .filter(state => state.status === 'active').length;
    const idleBrowsers = Array.from(this.browsers.values())
      .filter(state => state.status === 'idle').length;
    
    let totalPages = 0;
    let activePages = 0;
    
    for (const state of this.browsers.values()) {
      totalPages += state.pages.size;
      if (state.status === 'active') {
        activePages += state.pages.size;
      }
    }

    const avgLifetime = this.metrics.browsersDestroyed > 0
      ? this.metrics.totalLifetime / this.metrics.browsersDestroyed
      : 0;

    const utilizationPercentage = this.options.maxBrowsers > 0
      ? (activeBrowsers / this.options.maxBrowsers) * 100
      : 0;

    return {
      totalBrowsers,
      activeBrowsers,
      idleBrowsers,
      totalPages,
      activePages,
      browsersCreated: this.metrics.browsersCreated,
      browsersDestroyed: this.metrics.browsersDestroyed,
      avgBrowserLifetime: avgLifetime,
      utilizationPercentage,
      lastHealthCheck: new Date(),
    };
  }

  /**
   * Perform health check on all browsers
   * @nist si-4 "Information system monitoring"
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const instances = Array.from(this.browsers.values())
      .map(state => state.instance);

    const healthResults = await this.healthChecker.checkMultiple(instances);
    
    for (const [browserId, health] of healthResults) {
      results.set(browserId, health.isHealthy);
      
      // Handle unhealthy idle browsers
      const state = this.browsers.get(browserId);
      if (!health.isHealthy && state?.status === 'idle') {
        logger.warn({
          browserId,
          reason: health.reason,
        }, 'Unhealthy browser detected, scheduling restart');
        
        await this.restartUnhealthyBrowser(browserId, health);
      }
    }

    return results;
  }

  /**
   * Recycle a browser instance
   * @nist ac-12 "Session termination"
   */
  async recycleBrowser(browserId: string): Promise<void> {
    const state = this.browsers.get(browserId);
    
    if (!state) {
      throw new Error('Browser not found');
    }

    if (state.status === 'active') {
      throw new Error('Cannot recycle active browser');
    }

    state.status = 'recycling';
    
    try {
      await this.destroyBrowser(browserId);
    } catch (error) {
      logger.error({
        browserId,
        error,
      }, 'Failed to recycle browser');
    }

    // Process queued requests
    this.processQueue();
  }

  /**
   * Shutdown the browser pool
   * @nist ac-12 "Session termination"
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  async shutdown(force = false): Promise<void> {
    logger.info({ force }, 'Shutting down browser pool');
    this.isShuttingDown = true;

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject queued requests
    for (const request of this.acquisitionQueue) {
      request.reject(new Error('Browser pool shutting down'));
    }
    this.acquisitionQueue = [];

    // Close all browsers
    const closePromises: Promise<void>[] = [];
    
    for (const [browserId, state] of this.browsers) {
      if (!force && state.status === 'active') {
        logger.warn({ browserId }, 'Active browser during shutdown');
      }
      closePromises.push(this.destroyBrowser(browserId));
    }

    await Promise.all(closePromises);

    await logSecurityEvent(SecurityEventType.SERVICE_STOP, {
      resource: 'browser-pool',
      result: 'success',
    });
  }

  /**
   * Set pool configuration
   * @nist cm-7 "Least functionality"
   */
  configure(options: Partial<BrowserPoolOptions>): void {
    const newOptions = { ...this.options, ...options };
    this.options = this.validateOptions(newOptions);
    
    if (options.acquisitionTimeout !== undefined) {
      this.acquisitionTimeout = options.acquisitionTimeout;
    }

    logger.info({
      ...options,
    }, 'Browser pool configuration updated');
  }

  /**
   * Get browser instance by ID
   */
  getBrowser(browserId: string): BrowserInstance | undefined {
    return this.browsers.get(browserId)?.instance;
  }

  /**
   * List all browser instances
   */
  listBrowsers(): BrowserInstance[] {
    return Array.from(this.browsers.values()).map(state => state.instance);
  }

  /**
   * Clean up idle browsers
   */
  async cleanupIdle(): Promise<number> {
    if (this.isShuttingDown) {
      return 0;
    }

    const now = Date.now();
    let cleaned = 0;

    for (const [browserId, state] of this.browsers) {
      if (state.status === 'idle' && state.idleSince) {
        const idleTime = now - state.idleSince.getTime();
        
        if (idleTime > this.options.idleTimeout) {
          logger.info({
            browserId,
            idleTime,
          }, 'Cleaning up idle browser');
          
          await this.destroyBrowser(browserId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Find an idle browser
   */
  private findIdleBrowser(): InternalBrowserState | undefined {
    for (const state of this.browsers.values()) {
      if (state.status === 'idle') {
        return state;
      }
    }
    return undefined;
  }

  /**
   * Activate a browser for use
   */
  private activateBrowser(
    state: InternalBrowserState,
    sessionId: string
  ): BrowserInstance {
    state.status = 'active';
    state.acquiredBy = sessionId;
    state.idleSince = undefined;
    state.instance.useCount++;
    state.instance.lastUsedAt = new Date();

    logger.info({
      browserId: state.instance.id,
      sessionId,
      useCount: state.instance.useCount,
    }, 'Browser activated from pool');

    return state.instance;
  }

  /**
   * Create and acquire a new browser
   */
  private async createAndAcquireBrowser(sessionId: string): Promise<BrowserInstance> {
    const browserId = uuidv4();
    
    logger.info({
      browserId,
      sessionId,
    }, 'Creating new browser instance');

    const browser = await puppeteer.launch(this.options.launchOptions);
    const instance: BrowserInstance = {
      id: browserId,
      browser,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 1,
      pageCount: 0,
      pid: browser.process()?.pid,
    };

    const state: InternalBrowserState = {
      instance,
      status: 'active',
      acquiredBy: sessionId,
      pages: new Map(),
    };

    this.browsers.set(browserId, state);
    this.metrics.browsersCreated++;

    await logSecurityEvent(SecurityEventType.RESOURCE_CREATED, {
      resource: `browser:${browserId}`,
      userId: sessionId,
      result: 'success',
    });

    return instance;
  }

  /**
   * Queue an acquisition request
   */
  private queueAcquisition(sessionId: string): Promise<BrowserInstance> {
    return new Promise((resolve, reject) => {
      const request: AcquisitionRequest = {
        sessionId,
        resolve,
        reject,
        timestamp: new Date(),
      };

      this.acquisitionQueue.push(request);
      
      logger.debug({
        sessionId,
        queueLength: this.acquisitionQueue.length,
      }, 'Browser acquisition queued');

      // Set timeout
      setTimeout(() => {
        const index = this.acquisitionQueue.indexOf(request);
        if (index !== -1) {
          this.acquisitionQueue.splice(index, 1);
          reject(new Error('Browser acquisition timeout'));
        }
      }, this.acquisitionTimeout);
    });
  }

  /**
   * Process queued acquisition requests
   */
  private processQueue(): void {
    while (this.acquisitionQueue.length > 0) {
      const idleBrowser = this.findIdleBrowser();
      if (!idleBrowser) {
        break;
      }

      const request = this.acquisitionQueue.shift()!;
      const instance = this.activateBrowser(idleBrowser, request.sessionId);
      request.resolve(instance);
    }
  }

  /**
   * Destroy a browser instance
   */
  private async destroyBrowser(browserId: string): Promise<void> {
    const state = this.browsers.get(browserId);
    if (!state) {
      return;
    }

    const lifetime = Date.now() - state.instance.createdAt.getTime();
    this.metrics.totalLifetime += lifetime;
    this.metrics.browsersDestroyed++;

    try {
      // Close all pages
      for (const page of state.pages.values()) {
        await page.close();
      }
      
      // Close browser
      await state.instance.browser.close();
    } catch (error) {
      logger.error({
        browserId,
        error,
      }, 'Failed to close browser');
    }

    this.browsers.delete(browserId);

    await logSecurityEvent(SecurityEventType.RESOURCE_DELETED, {
      resource: `browser:${browserId}`,
      result: 'success',
    });
  }

  /**
   * Restart an unhealthy browser
   */
  private async restartUnhealthyBrowser(
    browserId: string,
    health: HealthCheckResult
  ): Promise<void> {
    const state = this.browsers.get(browserId);
    if (!state || state.status !== 'idle') {
      return;
    }

    try {
      const newBrowser = await this.healthChecker.restartBrowser(
        state.instance,
        this.options.launchOptions
      );

      state.instance.browser = newBrowser;
      state.instance.pid = newBrowser.process()?.pid;
      state.pages.clear();
      state.instance.pageCount = 0;

      logger.info({
        browserId,
        reason: health.reason,
      }, 'Browser restarted successfully');
    } catch (error) {
      logger.error({
        browserId,
        error,
      }, 'Failed to restart browser');
      
      // Remove the failed browser
      await this.destroyBrowser(browserId);
    }
  }

  /**
   * Perform periodic health checks
   */
  private async performHealthChecks(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    try {
      await this.healthCheck();
    } catch (error) {
      logger.error({ error }, 'Health check failed');
    }
  }

  /**
   * Check if browser should be recycled
   */
  private shouldRecycle(instance: BrowserInstance): boolean {
    if (!this.options.recycleAfterUses) {
      return false;
    }

    return instance.useCount >= this.options.recycleAfterUses;
  }

  /**
   * Validate pool options
   */
  private validateOptions(options: BrowserPoolOptions): BrowserPoolOptions {
    if (options.maxBrowsers <= 0) {
      throw new Error('Invalid configuration: maxBrowsers must be positive');
    }

    if (options.maxPagesPerBrowser <= 0) {
      throw new Error('Invalid configuration: maxPagesPerBrowser must be positive');
    }

    if (options.idleTimeout <= 0) {
      throw new Error('Invalid configuration: idleTimeout must be positive');
    }

    if (options.healthCheckInterval <= 0) {
      throw new Error('Invalid configuration: healthCheckInterval must be positive');
    }

    if (options.recycleAfterUses !== undefined && options.recycleAfterUses <= 0) {
      throw new Error('Invalid configuration: recycleAfterUses must be positive');
    }

    return options;
  }
}