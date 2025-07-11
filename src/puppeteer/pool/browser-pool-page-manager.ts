/**
 * Browser Pool Page Manager
 * Handles page creation, closure, and lifecycle management within browser instances
 * @module puppeteer/pool/browser-pool-page-manager
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import type { BrowserPoolEventLogger } from './browser-pool-event-logger.js';
import type { BrowserPoolMetricsHandler } from './browser-pool-metrics-handler.js';
import { createPage, closePage } from './browser-pool-public-methods.js';

/**
 * Browser release callback type
 */
export type BrowserReleaseCallback = (browserId: string, sessionId: string) => Promise<void>;

/**
 * Browser Pool Page Manager
 * Manages page lifecycle operations with comprehensive logging and metrics
 */
export class BrowserPoolPageManager {
  constructor(
    private browsers: Map<string, InternalBrowserInstance>,
    _options: BrowserPoolOptions,
    private eventLogger: BrowserPoolEventLogger,
    private metricsHandler: BrowserPoolMetricsHandler,
    private releaseBrowserCallback: BrowserReleaseCallback,
  ) {
    // Initialize
  }

  /**
   * Create a new page in a browser
   * @nist ac-4 "Information flow enforcement"
   */
  async createPage(browserId: string, sessionId: string): Promise<Page> {
    const startTime = Date.now();
    let page: Page;
    let duration: number;

    try {
      page = await createPage(browserId, sessionId, this.browsers);
      duration = Date.now() - startTime;

      // Record metrics
      this.metricsHandler.recordPageCreation(duration);
      this.metricsHandler.recordUtilization();

      // Log successful page creation
      await this.eventLogger.logPageCreation(true, browserId, sessionId, duration);

      return page;
    } catch (error) {
      duration = Date.now() - startTime;

      // Log page creation failure
      await this.eventLogger.logPageCreation(
        false,
        browserId,
        sessionId,
        duration,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Close a page in a browser
   * Automatically releases browser if no pages remain
   */
  async closePage(browserId: string, sessionId: string): Promise<void> {
    const startTime = Date.now();
    const initialPageCount = this.browsers.get(browserId)?.pageCount ?? 0;
    let duration: number;

    try {
      await closePage(browserId, sessionId, this.browsers);
      duration = Date.now() - startTime;

      // Check if browser should be released after page closure
      const instance = this.browsers.get(browserId);
      if (instance && instance.pageCount === 0 && instance.state === 'active') {
        // Emit event for tracking
        this.eventLogger.emitBrowserReleasing(browserId, sessionId, 'no_pages');

        // Release the browser back to the pool
        await this.releaseBrowserCallback(browserId, sessionId);
      }

      // Record metrics
      this.metricsHandler.recordPageDestruction(duration);
      this.metricsHandler.recordUtilization();

      // Log successful page closure
      await this.eventLogger.logPageClosure(true, browserId, sessionId, duration, initialPageCount);
    } catch (error) {
      duration = Date.now() - startTime;

      // Log page closure failure
      await this.eventLogger.logPageClosure(
        false,
        browserId,
        sessionId,
        duration,
        initialPageCount,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get current page count for a browser
   */
  getBrowserPageCount(browserId: string): number {
    return this.browsers.get(browserId)?.pageCount ?? 0;
  }

  /**
   * Check if browser has active pages
   */
  hasBrowserActivePages(browserId: string): boolean {
    const instance = this.browsers.get(browserId);
    return instance ? instance.pageCount > 0 : false;
  }

  /**
   * Get total page count across all browsers
   */
  getTotalPageCount(): number {
    let totalPages = 0;
    for (const instance of this.browsers.values()) {
      totalPages += instance.pageCount;
    }
    return totalPages;
  }

  /**
   * Get active page count across all browsers
   */
  getActivePageCount(): number {
    let activePages = 0;
    for (const instance of this.browsers.values()) {
      if (instance.state === 'active') {
        activePages += instance.pageCount;
      }
    }
    return activePages;
  }
}
