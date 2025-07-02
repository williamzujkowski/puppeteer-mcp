/**
 * Page Manager Implementation for Puppeteer Integration
 * @module puppeteer/pages/page-manager
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 * @nist sc-2 "Application partitioning"
 */

import type { Page, Cookie } from 'puppeteer';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../core/errors/app-error.js';
import { createLogger } from '../../utils/logger.js';
import type { BrowserPool } from '../interfaces/browser-pool.interface.js';
import type {
  PageManager as IPageManager,
  PageInfo,
  PageOptions,
  NavigationOptions,
  ScreenshotOptions,
} from '../interfaces/page-manager.interface.js';
import { pageInfoStore, type PageInfoStore } from './page-info-store.js';
import { configurePageOptions } from './page-configuration.js';
import { configurePageEventHandlers, type PageEvents } from './page-event-handler.js';
import {
  getPageMetrics,
  setCookies,
  getCookies,
  clearPageData,
  takeScreenshot,
  isPageActive,
  cleanupIdlePages,
} from './page-operations.js';
import {
  navigatePage,
  navigateTo,
  updatePageOptions,
} from './page-navigation.js';
import {
  performCleanup,
  shutdownPageManager,
} from './page-manager-lifecycle.js';
import { setupPageStoreHandlers } from './page-manager-events.js';
import { 
  getPageWithAccessControl,
  getPageInfoWithAccessControl
} from './page-access-control.js';
import {
  listPagesForSession,
  listPagesForContext,
} from './page-list-operations.js';
import {
  createPageInfo,
  verifyContextAccess,
  createAndConfigurePage,
} from './page-create-operations.js';
import {
  closePageOperation,
  closePagesForContextOperation,
  closePagesForSessionOperation,
} from './page-close-operations.js';

const logger = createLogger('page-manager');

/**
 * Page manager implementation
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export class PageManager extends EventEmitter implements IPageManager {
  private browserPool: BrowserPool;
  private pageStore: PageInfoStore;
  private pages: Map<string, Page> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(browserPool: BrowserPool, pageStore?: PageInfoStore) {
    super();
    this.browserPool = browserPool;
    this.pageStore = pageStore ?? pageInfoStore;
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(
      () => {
        void this.performCleanup();
      },
      5 * 60 * 1000 // 5 minutes
    );
  }

  /**
   * Create a new page for a context
   * @nist ac-2 "Account management"
   * @nist ac-3 "Access enforcement"
   */
  async createPage(
    contextId: string,
    sessionId: string,
    browserId: string,
    options?: PageOptions
  ): Promise<PageInfo> {
    if (this.isShuttingDown) {
      throw new AppError('Page manager is shutting down', 503);
    }

    logger.debug({ contextId, sessionId, browserId }, 'Creating new page');

    // Verify context access
    await verifyContextAccess(contextId, sessionId);

    try {
      const pageId = uuidv4();
      const pageInfo = createPageInfo(pageId, contextId, sessionId, browserId);
      
      const result = await createAndConfigurePage(
        this.browserPool,
        browserId,
        pageId,
        pageInfo,
        options,
        this.pages,
        this.pageStore,
        this
      );

      setupPageStoreHandlers(result, pageInfo, this.pageStore, this);
      
      // Emit creation event
      this.emit('page:created', { pageInfo });

      return result;

    } catch (error) {
      logger.error({
        contextId,
        sessionId,
        browserId,
        error,
      }, 'Failed to create page');

      throw error instanceof AppError 
        ? error 
        : new AppError('Failed to create page', 500, true, error instanceof Error ? { originalError: error.message } : undefined);
    }
  }

  /**
   * Get page by ID
   * @nist ac-3 "Access enforcement"
   */
  async getPage(pageId: string, sessionId: string): Promise<Page> {
    return getPageWithAccessControl(pageId, sessionId, this.pages, this.pageStore);
  }

  /**
   * Get page info
   * @nist ac-3 "Access enforcement"
   */
  async getPageInfo(pageId: string, sessionId: string): Promise<PageInfo> {
    return getPageInfoWithAccessControl(pageId, sessionId, this.pageStore);
  }

  /**
   * Navigate page
   * @nist ac-3 "Access enforcement"
   */
  async navigatePage(
    pageId: string,
    sessionId: string,
    url: string,
    options?: NavigationOptions
  ): Promise<void> {
    return navigatePage(pageId, sessionId, url, options, this.pages, this.pageStore);
  }

  /**
   * Navigate to URL
   * @param pageId - Page identifier
   * @param url - Target URL
   * @param sessionId - Session identifier for validation
   * @param options - Navigation options
   * @nist ac-4 "Information flow enforcement"
   */
  async navigateTo(
    pageId: string,
    url: string,
    sessionId: string,
    options?: NavigationOptions
  ): Promise<void> {
    await navigateTo(pageId, url, sessionId, options, this.pages, this.pageStore);
    this.emit('page:navigated', { pageId, url });
  }

  /**
   * Update page options
   * @param pageId - Page identifier
   * @param options - Page options to update
   * @param sessionId - Session identifier for validation
   */
  async updatePageOptions(
    pageId: string,
    options: Partial<PageOptions>,
    sessionId: string
  ): Promise<void> {
    return updatePageOptions(pageId, options, sessionId, this.pages, this.pageStore, configurePageOptions);
  }

  /**
   * Take screenshot
   * @nist ac-3 "Access enforcement"
   */
  async takeScreenshot(
    pageId: string,
    sessionId: string,
    options?: ScreenshotOptions
  ): Promise<Buffer> {
    return takeScreenshot(pageId, sessionId, options, this.pages, this.pageStore);
  }

  /**
   * List pages for session
   * @nist ac-3 "Access enforcement"
   */
  async listPagesForSession(sessionId: string): Promise<PageInfo[]> {
    return listPagesForSession(sessionId, this.pageStore);
  }

  /**
   * List pages for context
   * @nist ac-3 "Access enforcement"
   */
  async listPagesForContext(contextId: string, sessionId: string): Promise<PageInfo[]> {
    return listPagesForContext(contextId, sessionId, this.pageStore);
  }

  /**
   * Close page
   * @nist ac-12 "Session termination"
   */
  async closePage(pageId: string, sessionId: string): Promise<void> {
    return closePageOperation(
      pageId,
      sessionId,
      this.pages,
      this.pageStore,
      (pid, sid) => this.getPageInfo(pid, sid),
      this
    );
  }

  /**
   * Close all pages for context
   * @nist ac-12 "Session termination"
   */
  async closePagesForContext(contextId: string): Promise<void> {
    return closePagesForContextOperation(contextId, this.pages, this.pageStore, this);
  }

  /**
   * Close all pages for session
   * @nist ac-12 "Session termination"
   */
  async closePagesForSession(sessionId: string): Promise<void> {
    return closePagesForSessionOperation(sessionId, this.pages, this.pageStore, this);
  }

  /**
   * Perform periodic cleanup
   * @private
   */
  private async performCleanup(): Promise<void> {
    await performCleanup(this.pages, this.pageStore, this.isShuttingDown);
  }

  /**
   * Get page metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  async getPageMetrics(pageId: string, sessionId: string): Promise<Record<string, unknown>> {
    return getPageMetrics(pageId, sessionId, this.pages, this.pageStore);
  }

  /**
   * Set page cookies
   */
  async setCookies(pageId: string, cookies: Cookie[], sessionId: string): Promise<void> {
    return setCookies(pageId, cookies, sessionId, this.pages, this.pageStore);
  }

  /**
   * Get page cookies
   */
  async getCookies(pageId: string, sessionId: string): Promise<Cookie[]> {
    return getCookies(pageId, sessionId, this.pages, this.pageStore);
  }

  /**
   * Clear page data
   */
  async clearPageData(
    pageId: string,
    sessionId: string,
    options?: {
      cookies?: boolean;
      cache?: boolean;
      localStorage?: boolean;
      sessionStorage?: boolean;
    }
  ): Promise<void> {
    return clearPageData(pageId, sessionId, options, this.pages, this.pageStore);
  }

  /**
   * Check if page is active
   */
  async isPageActive(pageId: string): Promise<boolean> {
    return isPageActive(pageId, this.pageStore);
  }

  /**
   * Clean up idle pages
   */
  async cleanupIdlePages(idleTimeout: number): Promise<number> {
    const cleanedCount = await cleanupIdlePages(idleTimeout, this.pageStore);
    
    if (cleanedCount > 0) {
      logger.info({ cleanedCount, idleTimeout }, 'Cleaned up idle pages');
    }

    return cleanedCount;
  }


  /**
   * Shutdown page manager
   * @nist ac-12 "Session termination"
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    await shutdownPageManager(this.pages, this.pageStore, this.cleanupInterval);
  }
}

// Re-export types
export type { PageEvents };

// Re-export factory function
export { getPageManager } from './page-manager-factory.js';
