/**
 * Browser Pool Implementation
 * @module puppeteer/pool/browser-pool
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist ac-12 "Session termination"
 * @nist au-3 "Content of audit records"
 */

import type { Browser } from 'puppeteer';
import { EventEmitter } from 'events';
import { AppError } from '../../core/errors/app-error.js';
import { createLogger } from '../../utils/logger.js';
import type { 
  BrowserPool as IBrowserPool,
  BrowserInstance,
  BrowserPoolOptions,
  BrowserPoolMetrics,
} from '../interfaces/browser-pool.interface.js';
import { 
  launchBrowser, 
  closeBrowser, 
  restartBrowser, 
  isIdleTooLong,
  needsRestart 
} from './browser-lifecycle.js';
import { BrowserHealthMonitor, checkBrowserHealth } from './browser-health.js';
import { BrowserQueue } from './browser-queue.js';

const logger = createLogger('browser-pool');

/**
 * Default pool options
 */
const DEFAULT_OPTIONS: Partial<BrowserPoolOptions> = {
  maxBrowsers: 5,
  minBrowsers: 1,
  idleTimeout: 5 * 60 * 1000, // 5 minutes
  acquisitionTimeout: 30000,
  healthCheckInterval: 30000,
  headless: true,
};

/**
 * Browser pool implementation
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export class BrowserPool extends EventEmitter implements IBrowserPool {
  private options: BrowserPoolOptions;
  private browsers = new Map<string, BrowserInstance>();
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
      minBrowsers: this.options.minBrowsers,
    }, 'Initializing browser pool');

    // Launch minimum browsers
    const launchPromises = [];
    for (let i = 0; i < this.options.minBrowsers; i++) {
      launchPromises.push(this.launchNewBrowser());
    }

    await Promise.allSettled(launchPromises);

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
    instance.lastActivity = new Date();

    // Process queue
    this.queue.processNext(instance);

    // Emit event
    this.emit('browser:released', { browserId });
  }

  /**
   * Get browser by ID
   * @nist ac-3 "Access enforcement"
   */
  async getBrowser(browserId: string): Promise<Browser | null> {
    const instance = this.browsers.get(browserId);
    return instance?.browser ?? null;
  }

  /**
   * Get pool metrics
   * @nist au-3 "Content of audit records"
   */
  async getMetrics(): Promise<BrowserPoolMetrics> {
    const instances = Array.from(this.browsers.values());
    const queueStats = this.queue.getStats();

    return {
      totalBrowsers: this.browsers.size,
      activeBrowsers: instances.filter(i => i.state === 'active').length,
      idleBrowsers: instances.filter(i => i.state === 'idle').length,
      queuedRequests: queueStats.length,
      oldestQueueTime: queueStats.oldestWaitTime,
      avgPageCount: instances.length > 0
        ? instances.reduce((sum, i) => sum + i.pageCount, 0) / instances.length
        : 0,
      totalErrors: instances.reduce((sum, i) => sum + i.errorCount, 0),
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
  private findIdleBrowser(): BrowserInstance | null {
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
  private activateBrowser(instance: BrowserInstance, sessionId: string): BrowserInstance {
    instance.state = 'active';
    instance.sessionId = sessionId;
    instance.lastActivity = new Date();

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
    const { browser, instance } = await this.launchNewBrowser();
    
    // Activate for session
    instance.state = 'active';
    instance.sessionId = sessionId;
    instance.lastActivity = new Date();

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
        timeout: this.options.acquisitionTimeout,
        resolve,
        reject,
      });
    });
  }

  /**
   * Launch a new browser
   * @private
   */
  private async launchNewBrowser(): Promise<{ browser: Browser; instance: BrowserInstance }> {
    const result = await launchBrowser(this.options);
    
    // Store instance
    this.browsers.set(result.instance.id, result.instance);

    // Start health monitoring
    this.healthMonitor.startMonitoring(
      result.instance.id,
      result.browser,
      result.instance,
      () => void this.handleUnhealthyBrowser(result.instance.id),
      this.options.healthCheckInterval
    );

    this.emit('browser:created', { browserId: result.instance.id });

    return result;
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

      // Update instance
      this.browsers.set(browserId, result.instance);

      // Restart health monitoring
      this.healthMonitor.startMonitoring(
        browserId,
        result.browser,
        result.instance,
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
    if (this.browsers.size > this.options.minBrowsers) {
      for (const instance of this.browsers.values()) {
        if (isIdleTooLong(instance, this.options.idleTimeout)) {
          await this.removeBrowser(instance.id);
          
          if (this.browsers.size <= this.options.minBrowsers) {
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
    while (this.browsers.size < this.options.minBrowsers && !this.isShuttingDown) {
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