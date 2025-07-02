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
import { 
  launchBrowser, 
  closeBrowser, 
  restartBrowser, 
  isIdleTooLong,
  needsRestart 
} from './browser-lifecycle.js';
import { BrowserHealthMonitor } from './browser-health.js';
import { BrowserQueue } from './browser-queue.js';

const logger = createLogger('browser-pool');

/**
 * Internal browser instance with additional state tracking
 */
interface InternalBrowserInstance extends BrowserInstance {
  state: 'idle' | 'active';
  sessionId: string | null;
  errorCount: number;
}

/**
 * Default pool options
 */
const DEFAULT_OPTIONS: Partial<BrowserPoolOptions> = {
  maxBrowsers: 5,
  maxPagesPerBrowser: 10,
  idleTimeout: 5 * 60 * 1000, // 5 minutes
  acquisitionTimeout: 30000,
  healthCheckInterval: 30000,
  launchOptions: {
    headless: true,
  },
};

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
  private maintenanceInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(options: Partial<BrowserPoolOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options } as BrowserPoolOptions;
    
    // Start maintenance cycle
    this.startMaintenance();

    // Set up queue event handling
    this.setupQueueHandlers();
  }

  /**
   * Initialize the pool
   * @nist ac-3 "Access enforcement"
   */
  async initialize(): Promise<void> {
    logger.info({
      maxBrowsers: this.options.maxBrowsers,
    }, 'Initializing browser pool');

    // Launch one browser initially
    try {
      await this.launchNewBrowser();
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to launch initial browser');
    }

    logger.info({
      activeBrowsers: this.browsers.size,
    }, 'Browser pool initialized');
  }

  /**
   * Acquire a browser for a session
   * @nist ac-3 "Access enforcement"
   * @nist ac-4 "Information flow enforcement"
   */
  async acquireBrowser(sessionId: string): Promise<BrowserInstance> {
    if (this.isShuttingDown) {
      throw new AppError('Browser pool is shutting down', 503);
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
  async releaseBrowser(browserId: string): Promise<void> {
    const instance = this.browsers.get(browserId);
    if (!instance) {
      logger.warn({ browserId }, 'Attempted to release unknown browser');
      return;
    }

    logger.debug({ browserId, sessionId: instance.sessionId }, 'Releasing browser');

    // Update state
    instance.state = 'idle';
    instance.sessionId = null;
    instance.lastUsedAt = new Date();

    // Process queue
    this.queue.processNext(instance);

    // Emit event
    this.emit('browser:released', { browserId });
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
    const instances = Array.from(this.browsers.values());

    const totalPages = instances.reduce((sum, i) => sum + i.pageCount, 0);
    const activePages = totalPages; // Simplified - all pages are considered active
    
    return {
      totalBrowsers: this.browsers.size,
      activeBrowsers: instances.filter(i => i.pageCount > 0).length,
      idleBrowsers: instances.filter(i => i.pageCount === 0).length,
      totalPages,
      activePages,
      browsersCreated: 0, // TODO: Track this metric
      browsersDestroyed: 0, // TODO: Track this metric
      avgBrowserLifetime: 0, // TODO: Calculate this metric
      utilizationPercentage: this.browsers.size > 0 
        ? (instances.filter(i => i.pageCount > 0).length / this.options.maxBrowsers) * 100
        : 0,
      lastHealthCheck: new Date(),
    };
  }

  /**
   * Shutdown the pool
   * @nist ac-12 "Session termination"
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down browser pool');
    this.isShuttingDown = true;

    // Stop maintenance
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    // Stop health monitoring
    this.healthMonitor.stopAll();

    // Clear queue
    this.queue.clear();

    // Close all browsers
    const closePromises = Array.from(this.browsers.values()).map(instance =>
      closeBrowser(instance.browser, instance).catch(error => {
        logger.error({ browserId: instance.id, error }, 'Error closing browser');
      })
    );

    await Promise.allSettled(closePromises);

    this.browsers.clear();
    logger.info('Browser pool shutdown complete');
  }

  /**
   * Find an idle browser
   * @private
   */
  private findIdleBrowser(): InternalBrowserInstance | null {
    for (const instance of this.browsers.values()) {
      if (instance.state === 'idle' && instance.browser.isConnected()) {
        return instance;
      }
    }
    return null;
  }

  /**
   * Activate a browser for a session
   * @private
   */
  private activateBrowser(instance: InternalBrowserInstance, sessionId: string): InternalBrowserInstance {
    instance.state = 'active';
    instance.sessionId = sessionId;
    instance.lastUsedAt = new Date();

    logger.debug({
      browserId: instance.id,
      sessionId,
    }, 'Browser activated for session');

    this.emit('browser:acquired', { browserId: instance.id, sessionId });

    return instance;
  }

  /**
   * Create and acquire a new browser
   * @private
   */
  private async createAndAcquireBrowser(sessionId: string): Promise<BrowserInstance> {
    const { instance } = await this.launchNewBrowser();
    
    // Activate for session
    instance.state = 'active';
    instance.sessionId = sessionId;
    instance.lastUsedAt = new Date();

    this.emit('browser:acquired', { browserId: instance.id, sessionId });

    return instance;
  }

  /**
   * Queue a browser acquisition request
   * @private
   */
  private queueAcquisition(sessionId: string): Promise<BrowserInstance> {
    return new Promise((resolve, reject) => {
      this.queue.enqueue({
        sessionId,
        priority: 0, // Default priority
        timeout: this.options.acquisitionTimeout ?? 30000,
        resolve,
        reject,
      });
    });
  }

  /**
   * Launch a new browser
   * @private
   */
  private async launchNewBrowser(): Promise<{ browser: Browser; instance: InternalBrowserInstance }> {
    const result = await launchBrowser(this.options);
    
    // Create internal instance with additional state
    const internalInstance: InternalBrowserInstance = {
      ...result.instance,
      state: 'idle',
      sessionId: null,
      errorCount: 0,
    };
    
    // Store instance
    this.browsers.set(internalInstance.id, internalInstance);

    // Start health monitoring
    this.healthMonitor.startMonitoring(
      internalInstance.id,
      result.browser,
      internalInstance,
      () => void this.handleUnhealthyBrowser(internalInstance.id),
      this.options.healthCheckInterval
    );

    this.emit('browser:created', { browserId: internalInstance.id });

    return { browser: result.browser, instance: internalInstance };
  }

  /**
   * Handle unhealthy browser
   * @private
   */
  private async handleUnhealthyBrowser(browserId: string): Promise<void> {
    const instance = this.browsers.get(browserId);
    if (!instance) {
      return;
    }

    logger.warn({ browserId }, 'Handling unhealthy browser');

    try {
      // Restart the browser
      const result = await restartBrowser(
        instance.browser,
        instance,
        this.options
      );

      // Create internal instance with additional state
      const internalInstance: InternalBrowserInstance = {
        ...result.instance,
        state: instance.state,
        sessionId: instance.sessionId,
        errorCount: 0,
      };
      
      // Update instance
      this.browsers.set(browserId, internalInstance);

      // Restart health monitoring
      this.healthMonitor.startMonitoring(
        browserId,
        result.browser,
        internalInstance,
        () => void this.handleUnhealthyBrowser(browserId),
        this.options.healthCheckInterval
      );

      this.emit('browser:restarted', { browserId });

    } catch (error) {
      logger.error({ browserId, error }, 'Failed to restart unhealthy browser');
      
      // Remove from pool
      this.browsers.delete(browserId);
      this.healthMonitor.stopMonitoring(browserId);
      
      this.emit('browser:removed', { browserId });
    }
  }

  /**
   * Start maintenance cycle
   * @private
   */
  private startMaintenance(): void {
    this.maintenanceInterval = setInterval(
      () => void this.performMaintenance(),
      60000 // 1 minute
    );
  }

  /**
   * Perform pool maintenance
   * @private
   */
  private async performMaintenance(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    logger.debug('Performing pool maintenance');

    // Remove idle browsers if above minimum
    if (this.browsers.size > 1) {
      for (const instance of this.browsers.values()) {
        if (isIdleTooLong(instance, this.options.idleTimeout)) {
          await this.removeBrowser(instance.id);
          
          if (this.browsers.size <= 1) {
            break;
          }
        }
      }
    }

    // Restart browsers that need it
    for (const instance of this.browsers.values()) {
      if (needsRestart(instance)) {
        await this.handleUnhealthyBrowser(instance.id);
      }
    }

    // Ensure minimum browsers
    while (this.browsers.size < 1 && !this.isShuttingDown) {
      try {
        await this.launchNewBrowser();
      } catch (error) {
        logger.error({ error }, 'Failed to launch browser during maintenance');
        break;
      }
    }
  }

  /**
   * Remove a browser from the pool
   * @private
   */
  private async removeBrowser(browserId: string): Promise<void> {
    const instance = this.browsers.get(browserId);
    if (!instance) {
      return;
    }

    logger.info({ browserId }, 'Removing browser from pool');

    // Stop health monitoring
    this.healthMonitor.stopMonitoring(browserId);

    // Close browser
    await closeBrowser(instance.browser, instance);

    // Remove from pool
    this.browsers.delete(browserId);

    this.emit('browser:removed', { browserId });
  }

  /**
   * Create a new page in a browser
   * @nist ac-4 "Information flow enforcement"
   */
  async createPage(browserId: string, sessionId: string): Promise<Page> {
    const instance = this.browsers.get(browserId);
    if (!instance) {
      throw new AppError('Browser not found', 404);
    }

    if (instance.sessionId !== sessionId) {
      throw new AppError('Browser not assigned to session', 403);
    }

    const page = await instance.browser.newPage();
    instance.pageCount++;
    instance.lastUsedAt = new Date();

    return page;
  }

  /**
   * Close a page in a browser
   */
  async closePage(browserId: string, sessionId: string): Promise<void> {
    const instance = this.browsers.get(browserId);
    if (!instance) {
      return;
    }

    if (instance.sessionId !== sessionId) {
      throw new AppError('Browser not assigned to session', 403);
    }

    // Decrement page count
    instance.pageCount = Math.max(0, instance.pageCount - 1);
    instance.lastUsedAt = new Date();
  }

  /**
   * Perform health check on all browsers
   * @nist si-4 "Information system monitoring"
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [browserId, instance] of this.browsers) {
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
   * Recycle a browser instance
   */
  async recycleBrowser(browserId: string): Promise<void> {
    const instance = this.browsers.get(browserId);
    if (!instance) {
      return;
    }

    logger.info({ browserId }, 'Recycling browser');

    try {
      const result = await restartBrowser(instance.browser, instance, this.options);
      const internalInstance: InternalBrowserInstance = {
        ...result.instance,
        state: instance.state,
        sessionId: instance.sessionId,
        errorCount: 0,
      };
      this.browsers.set(browserId, internalInstance);
    } catch (error) {
      logger.error({ browserId, error }, 'Failed to recycle browser');
      await this.removeBrowser(browserId);
    }
  }

  /**
   * List all browser instances
   */
  listBrowsers(): BrowserInstance[] {
    return Array.from(this.browsers.values()).map(internal => {
      const { state, sessionId, errorCount, ...browserInstance } = internal;
      return browserInstance;
    });
  }

  /**
   * Clean up idle browsers
   */
  async cleanupIdle(): Promise<number> {
    let cleaned = 0;

    for (const [browserId, instance] of this.browsers) {
      if (isIdleTooLong(instance, this.options.idleTimeout) && this.browsers.size > 1) {
        await this.removeBrowser(browserId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Stop maintenance tasks
   * @private
   */
  private stopMaintenance(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = undefined;
    }
  }

  /**
   * Configure pool options
   * @nist cm-7 "Least functionality"
   */
  configure(options: Partial<BrowserPoolOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Restart maintenance if interval changed
    if (options.healthCheckInterval) {
      this.stopMaintenance();
      this.startMaintenance();
    }
  }

  /**
   * Set up queue event handlers
   * @private
   */
  private setupQueueHandlers(): void {
    // When a browser becomes available, try to process queue
    this.on('browser:released', () => {
      const idleBrowser = this.findIdleBrowser();
      if (idleBrowser) {
        this.queue.processNext(idleBrowser);
      }
    });
  }
}