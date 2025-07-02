/**
 * Page Manager Implementation for Puppeteer Integration
 * @module puppeteer/pages/page-manager
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 * @nist sc-2 "Application partitioning"
 */

import type { Page } from 'puppeteer';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType, createLogger } from '../../utils/logger.js';
import { contextStore } from '../../store/context-store.js';
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
import { closeContextPages, closeSessionPages, closePage, performPeriodicCleanup } from './page-cleanup.js';

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

    // Verify context exists and belongs to session
    const context = await contextStore.get(contextId);
    if (!context) {
      throw new AppError('Context not found', 404);
    }

    if (context.sessionId !== sessionId) {
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        userId: sessionId,
        resource: `context:${contextId}`,
        result: 'failure',
        reason: 'Context does not belong to session',
      });
      throw new AppError('Unauthorized access to context', 403);
    }

    try {
      // Get browser from pool
      const browser = await this.browserPool.getBrowser(browserId);
      if (!browser) {
        throw new AppError('Browser not found', 404);
      }

      // Create new page
      const page = await browser.newPage();
      const pageId = uuidv4();

      // Configure page options
      if (options) {
        await configurePageOptions(page, options);
      }

      // Create page info
      const pageInfo: PageInfo = {
        id: pageId,
        contextId,
        sessionId,
        browserId,
        url: 'about:blank',
        title: '',
        state: 'active',
        createdAt: new Date(),
        lastActivity: new Date(),
        navigationHistory: [],
        errorCount: 0,
      };

      // Store page
      this.pages.set(pageId, page);
      await this.pageStore.create(pageInfo);

      // Set up event listeners
      configurePageEventHandlers(page, pageId, this);
      this.setupPageStoreHandlers(page, pageInfo);

      // Emit creation event
      this.emit('page:created', { pageInfo });

      logger.info({
        pageId,
        contextId,
        sessionId,
        browserId,
      }, 'Page created successfully');

      return pageInfo;

    } catch (error) {
      logger.error({
        contextId,
        sessionId,
        browserId,
        error,
      }, 'Failed to create page');

      throw error instanceof AppError 
        ? error 
        : new AppError('Failed to create page', 500, error);
    }
  }

  /**
   * Get page by ID
   * @nist ac-3 "Access enforcement"
   */
  async getPage(pageId: string, sessionId: string): Promise<Page> {
    const pageInfo = await this.pageStore.get(pageId);
    if (!pageInfo) {
      throw new AppError('Page not found', 404);
    }

    if (pageInfo.sessionId !== sessionId) {
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        userId: sessionId,
        resource: `page:${pageId}`,
        result: 'failure',
        reason: 'Page does not belong to session',
      });
      throw new AppError('Unauthorized access to page', 403);
    }

    const page = this.pages.get(pageId);
    if (!page || page.isClosed()) {
      await this.pageStore.delete(pageId);
      this.pages.delete(pageId);
      throw new AppError('Page is closed', 410);
    }

    // Update activity
    await this.pageStore.touchActivity(pageId);

    return page;
  }

  /**
   * Get page info
   * @nist ac-3 "Access enforcement"
   */
  async getPageInfo(pageId: string, sessionId: string): Promise<PageInfo> {
    const pageInfo = await this.pageStore.get(pageId);
    if (!pageInfo) {
      throw new AppError('Page not found', 404);
    }

    if (pageInfo.sessionId !== sessionId) {
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        userId: sessionId,
        resource: `page:${pageId}`,
        result: 'failure',
        reason: 'Page does not belong to session',
      });
      throw new AppError('Unauthorized access to page', 403);
    }

    return pageInfo;
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
    const page = await this.getPage(pageId, sessionId);
    
    logger.debug({ pageId, url }, 'Navigating page');

    await page.goto(url, {
      waitUntil: options?.waitUntil ?? 'networkidle2',
      timeout: options?.timeout ?? 30000,
    });
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
    const page = await this.getPage(pageId, sessionId);
    
    const screenshot = await page.screenshot({
      type: options?.type ?? 'png',
      fullPage: options?.fullPage ?? false,
      quality: options?.quality,
      clip: options?.clip,
      encoding: 'binary',
    });

    return Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
  }

  /**
   * List pages for session
   * @nist ac-3 "Access enforcement"
   */
  async listPagesForSession(sessionId: string): Promise<PageInfo[]> {
    return this.pageStore.listBySession(sessionId);
  }

  /**
   * List pages for context
   * @nist ac-3 "Access enforcement"
   */
  async listPagesForContext(contextId: string, sessionId: string): Promise<PageInfo[]> {
    // Verify context belongs to session
    const context = await contextStore.get(contextId);
    if (!context) {
      throw new AppError('Context not found', 404);
    }

    if (context.sessionId !== sessionId) {
      throw new AppError('Unauthorized access to context', 403);
    }

    return this.pageStore.listByContext(contextId);
  }

  /**
   * Close page
   * @nist ac-12 "Session termination"
   */
  async closePage(pageId: string, sessionId: string): Promise<void> {
    const pageInfo = await this.getPageInfo(pageId, sessionId);
    
    await closePage(pageId, this.pages, this.pageStore);
    
    this.emit('page:closed', { pageId, contextId: pageInfo.contextId });
    
    logger.info({ pageId, contextId: pageInfo.contextId }, 'Page closed');
  }

  /**
   * Close all pages for context
   * @nist ac-12 "Session termination"
   */
  async closePagesForContext(contextId: string, sessionId: string): Promise<void> {
    const result = await closeContextPages(contextId, this.pages, this.pageStore);
    
    this.emit('context:pages-cleared', { 
      contextId, 
      pageCount: result.pageCount 
    });
    
    logger.info(result, 'Context pages closed');
  }

  /**
   * Close all pages for session
   * @nist ac-12 "Session termination"
   */
  async closePagesForSession(sessionId: string): Promise<void> {
    const results = await closeSessionPages(sessionId, this.pages, this.pageStore);
    
    let totalPages = 0;
    for (const result of results.values()) {
      totalPages += result.pageCount;
    }
    
    this.emit('session:pages-cleared', { 
      sessionId, 
      pageCount: totalPages 
    });
    
    logger.info({ sessionId, totalPages }, 'Session pages closed');
  }

  /**
   * Perform periodic cleanup
   * @private
   */
  private async performCleanup(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    try {
      const cleanedCount = await performPeriodicCleanup(
        this.pages, 
        this.pageStore
      );
      
      if (cleanedCount > 0) {
        logger.info({ cleanedCount }, 'Cleaned up idle pages');
      }
    } catch (error) {
      logger.error({ error }, 'Error during periodic cleanup');
    }
  }

  /**
   * Set up page store event handlers
   * @private
   */
  private setupPageStoreHandlers(page: Page, pageInfo: PageInfo): void {
    const pageId = pageInfo.id;

    // Update store on navigation
    this.on('page:navigated', async ({ pageId: navPageId, url }) => {
      if (navPageId === pageId) {
        const title = await page.title().catch(() => '');
        await this.pageStore.updateUrl(pageId, url);
        await this.pageStore.updateTitle(pageId, title);
        await this.pageStore.addNavigationHistory(pageId, url);
        await this.pageStore.touchActivity(pageId);
      }
    });

    // Update error count
    this.on('page:error', async ({ pageId: errorPageId }) => {
      if (errorPageId === pageId) {
        await this.pageStore.incrementErrorCount(pageId);
        await this.pageStore.touchActivity(pageId);
      }
    });
  }

  /**
   * Shutdown page manager
   * @nist ac-12 "Session termination"
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down page manager');
    this.isShuttingDown = true;

    // Stop periodic cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all pages
    const allPages = Array.from(this.pages.keys());
    await Promise.allSettled(
      allPages.map(pageId => 
        closePage(pageId, this.pages, this.pageStore).catch(error => {
          logger.error({ pageId, error }, 'Error closing page during shutdown');
        })
      )
    );

    await this.pageStore.clear();
    this.pages.clear();

    logger.info('Page manager shutdown complete');
  }
}

// Re-export types
export type { PageEvents };
