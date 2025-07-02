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

const logger = createLogger('page-manager');

/**
 * Page lifecycle events
 */
export interface PageEvents {
  'page:created': { pageInfo: PageInfo };
  'page:navigated': { pageId: string; url: string };
  'page:closed': { pageId: string; contextId: string };
  'page:error': { pageId: string; error: Error };
  'page:state-changed': { pageId: string; state: PageInfo['state'] };
  'context:pages-cleared': { contextId: string; pageCount: number };
  'session:pages-cleared': { sessionId: string; pageCount: number };
}

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
      () => this.performCleanup(),
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

    logger.debug({
      contextId,
      sessionId,
      browserId,
    }, 'Creating new page');

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
      throw new AppError('Access denied: Context does not belong to session', 403);
    }

    // Create page in browser
    const page = await this.browserPool.createPage(browserId, sessionId);
    const pageId = uuidv4();
    (page as any)._id = pageId;

    // Configure page with options
    if (options) {
      await this.configurePageOptions(page, options);
    }

    // Get initial page data
    const url = page.url() || 'about:blank';
    const title = await page.title().catch(() => '');

    // Create page info
    const pageInfo = await this.pageStore.create({
      contextId,
      sessionId,
      browserId,
      url,
      title,
      state: 'active',
      navigationHistory: [url],
      errorCount: 0,
      metadata: options?.viewport ? { viewport: options.viewport } : undefined,
    });

    // Store page reference
    this.pages.set(pageInfo.id, page);

    // Set up page event listeners
    this.setupPageEventListeners(page, pageInfo);

    logger.info({
      pageId: pageInfo.id,
      contextId,
      sessionId,
      browserId,
      url,
    }, 'Page created successfully');

    // Emit page created event
    this.emit('page:created', { pageInfo });

    await logSecurityEvent(SecurityEventType.RESOURCE_CREATED, {
      resource: `page:${pageInfo.id}`,
      userId: sessionId,
      action: 'create_page',
      result: 'success',
      metadata: {
        contextId,
        browserId,
        url,
      },
    });

    return pageInfo;
  }

  /**
   * Get page by ID
   * @nist ac-3 "Access enforcement"
   */
  async getPage(pageId: string, sessionId: string): Promise<Page | undefined> {
    const pageInfo = await this.pageStore.get(pageId);
    if (!pageInfo) {
      return undefined;
    }

    // Verify session access
    if (pageInfo.sessionId !== sessionId) {
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        userId: sessionId,
        resource: `page:${pageId}`,
        result: 'failure',
        reason: 'Page does not belong to session',
      });
      throw new AppError('Access denied: Page does not belong to session', 403);
    }

    return this.pages.get(pageId);
  }

  /**
   * Get page info
   */
  async getPageInfo(pageId: string, sessionId: string): Promise<PageInfo | undefined> {
    const pageInfo = await this.pageStore.get(pageId);
    if (!pageInfo) {
      return undefined;
    }

    // Verify session access
    if (pageInfo.sessionId !== sessionId) {
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        userId: sessionId,
        resource: `page:${pageId}`,
        result: 'failure',
        reason: 'Page does not belong to session',
      });
      throw new AppError('Access denied: Page does not belong to session', 403);
    }

    return pageInfo;
  }

  /**
   * List pages for a context
   */
  async listPagesForContext(contextId: string, sessionId: string): Promise<PageInfo[]> {
    // Verify context belongs to session
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
      throw new AppError('Access denied: Context does not belong to session', 403);
    }

    return this.pageStore.listByContext(contextId);
  }

  /**
   * List all pages for a session
   */
  async listPagesForSession(sessionId: string): Promise<PageInfo[]> {
    return this.pageStore.listBySession(sessionId);
  }

  /**
   * Navigate to URL
   * @nist ac-4 "Information flow enforcement"
   */
  async navigateTo(
    pageId: string,
    url: string,
    sessionId: string,
    options?: NavigationOptions
  ): Promise<void> {
    const page = await this.getPage(pageId, sessionId);
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    logger.debug({
      pageId,
      url,
      sessionId,
    }, 'Navigating page to URL');

    // Update page state
    await this.pageStore.updateState(pageId, 'navigating');
    this.emit('page:state-changed', { pageId, state: 'navigating' });

    try {
      // Navigate to URL
      await page.goto(url, {
        timeout: options?.timeout ?? 30000,
        waitUntil: options?.waitUntil ?? 'load',
        referer: options?.referer,
      });

      // Update page info
      const newUrl = page.url();
      const title = await page.title().catch(() => '');
      
      await this.pageStore.updateUrl(pageId, newUrl);
      await this.pageStore.updateTitle(pageId, title);
      await this.pageStore.addNavigationHistory(pageId, newUrl);
      await this.pageStore.updateState(pageId, 'active');
      await this.pageStore.touchActivity(pageId);

      logger.info({
        pageId,
        url: newUrl,
        title,
      }, 'Page navigation completed');

      this.emit('page:navigated', { pageId, url: newUrl });
      this.emit('page:state-changed', { pageId, state: 'active' });

      await logSecurityEvent(SecurityEventType.DATA_ACCESS, {
        userId: sessionId,
        resource: `page:${pageId}`,
        action: 'navigate',
        result: 'success',
        metadata: { url: newUrl, title },
      });
    } catch (error) {
      await this.pageStore.updateState(pageId, 'active');
      await this.pageStore.incrementErrorCount(pageId);
      
      logger.error({
        pageId,
        url,
        error,
      }, 'Page navigation failed');

      this.emit('page:error', { pageId, error: error as Error });
      this.emit('page:state-changed', { pageId, state: 'active' });

      await logSecurityEvent(SecurityEventType.ERROR, {
        userId: sessionId,
        resource: `page:${pageId}`,
        action: 'navigate',
        result: 'failure',
        reason: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Close a page
   * @nist ac-12 "Session termination"
   */
  async closePage(pageId: string, sessionId: string): Promise<void> {
    const pageInfo = await this.getPageInfo(pageId, sessionId);
    if (!pageInfo) {
      throw new AppError('Page not found', 404);
    }

    const page = this.pages.get(pageId);
    if (page) {
      try {
        await page.close();
      } catch (error) {
        logger.warn({
          pageId,
          error,
        }, 'Error closing page, continuing cleanup');
      }
      this.pages.delete(pageId);
    }

    // Close page in browser pool
    try {
      await this.browserPool.closePage(pageInfo.browserId, pageId, sessionId);
    } catch (error) {
      logger.warn({
        pageId,
        browserId: pageInfo.browserId,
        error,
      }, 'Error closing page in browser pool');
    }

    // Remove from store
    await this.pageStore.delete(pageId);

    logger.info({
      pageId,
      contextId: pageInfo.contextId,
    }, 'Page closed');

    this.emit('page:closed', { pageId, contextId: pageInfo.contextId });

    await logSecurityEvent(SecurityEventType.RESOURCE_DELETED, {
      resource: `page:${pageId}`,
      userId: sessionId,
      action: 'close_page',
      result: 'success',
    });
  }

  /**
   * Close all pages for a context
   */
  async closePagesForContext(contextId: string, sessionId: string): Promise<void> {
    const pages = await this.listPagesForContext(contextId, sessionId);
    
    logger.info({
      contextId,
      pageCount: pages.length,
    }, 'Closing all pages for context');

    const closePromises = pages.map(page => 
      this.closePage(page.id, sessionId).catch(error => {
        logger.error({
          pageId: page.id,
          contextId,
          error,
        }, 'Failed to close page during context cleanup');
      })
    );

    await Promise.allSettled(closePromises);

    this.emit('context:pages-cleared', { contextId, pageCount: pages.length });

    await logSecurityEvent(SecurityEventType.DATA_DELETION, {
      resource: `context:${contextId}`,
      userId: sessionId,
      action: 'close_context_pages',
      result: 'success',
      metadata: { pageCount: pages.length },
    });
  }

  /**
   * Close all pages for a session
   */
  async closePagesForSession(sessionId: string): Promise<void> {
    const pages = await this.listPagesForSession(sessionId);
    
    logger.info({
      sessionId,
      pageCount: pages.length,
    }, 'Closing all pages for session');

    const closePromises = pages.map(page => 
      this.closePage(page.id, sessionId).catch(error => {
        logger.error({
          pageId: page.id,
          sessionId,
          error,
        }, 'Failed to close page during session cleanup');
      })
    );

    await Promise.allSettled(closePromises);

    this.emit('session:pages-cleared', { sessionId, pageCount: pages.length });

    await logSecurityEvent(SecurityEventType.DATA_DELETION, {
      resource: `session:${sessionId}`,
      userId: sessionId,
      action: 'close_session_pages',
      result: 'success',
      metadata: { pageCount: pages.length },
    });
  }

  /**
   * Update page options
   */
  async updatePageOptions(
    pageId: string,
    options: Partial<PageOptions>,
    sessionId: string
  ): Promise<void> {
    const page = await this.getPage(pageId, sessionId);
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    await this.configurePageOptions(page, options);
    await this.pageStore.touchActivity(pageId);

    logger.debug({
      pageId,
      options,
    }, 'Page options updated');
  }

  /**
   * Take screenshot of a page
   */
  async takeScreenshot(
    pageId: string,
    sessionId: string,
    options?: ScreenshotOptions
  ): Promise<Buffer | string> {
    const page = await this.getPage(pageId, sessionId);
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    await this.pageStore.touchActivity(pageId);

    const screenshot = await page.screenshot({
      type: options?.type ?? 'png',
      quality: options?.quality,
      fullPage: options?.fullPage ?? false,
      clip: options?.clip,
      omitBackground: options?.omitBackground,
      encoding: options?.encoding ?? 'binary',
    });

    logger.debug({
      pageId,
      type: options?.type ?? 'png',
      fullPage: options?.fullPage ?? false,
    }, 'Screenshot taken');

    return screenshot as Buffer | string;
  }

  /**
   * Get page metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  async getPageMetrics(pageId: string, sessionId: string): Promise<Record<string, unknown>> {
    const page = await this.getPage(pageId, sessionId);
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    const metrics = await page.metrics();
    await this.pageStore.touchActivity(pageId);

    return metrics as Record<string, unknown>;
  }

  /**
   * Set page cookies
   */
  async setCookies(pageId: string, cookies: Cookie[], sessionId: string): Promise<void> {
    const page = await this.getPage(pageId, sessionId);
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    await page.setCookie(...cookies);
    await this.pageStore.touchActivity(pageId);

    logger.debug({
      pageId,
      cookieCount: cookies.length,
    }, 'Cookies set on page');
  }

  /**
   * Get page cookies
   */
  async getCookies(pageId: string, sessionId: string): Promise<Cookie[]> {
    const page = await this.getPage(pageId, sessionId);
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    const cookies = await page.cookies();
    await this.pageStore.touchActivity(pageId);

    return cookies;
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
    const page = await this.getPage(pageId, sessionId);
    if (!page) {
      throw new AppError('Page not found', 404);
    }

    const clearOptions = {
      cookies: true,
      cache: true,
      localStorage: true,
      sessionStorage: true,
      ...options,
    };

    if (clearOptions.cookies) {
      const cookies = await page.cookies();
      if (cookies.length > 0) {
        await page.deleteCookie(...cookies);
      }
    }

    if (clearOptions.localStorage || clearOptions.sessionStorage) {
      await page.evaluate((opts: { localStorage?: boolean; sessionStorage?: boolean }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = globalThis as any;
        if (opts.localStorage && win.localStorage) {
          win.localStorage.clear();
        }
        if (opts.sessionStorage && win.sessionStorage) {
          win.sessionStorage.clear();
        }
      }, clearOptions);
    }

    if (clearOptions.cache) {
      // Note: Puppeteer doesn't have direct cache clearing, 
      // but reloading will clear some cache
      await page.reload({ waitUntil: 'networkidle0' });
    }

    await this.pageStore.touchActivity(pageId);

    logger.debug({
      pageId,
      options: clearOptions,
    }, 'Page data cleared');
  }

  /**
   * Check if page is active
   */
  async isPageActive(pageId: string): Promise<boolean> {
    const pageInfo = await this.pageStore.get(pageId);
    return pageInfo?.state === 'active';
  }

  /**
   * Clean up idle pages
   */
  async cleanupIdlePages(idleTimeout: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - idleTimeout);
    let cleaned = 0;
    
    // Get all pages and check which ones need cleanup
    const allPages = await this.pageStore.listAll();
    
    for (const pageInfo of allPages) {
      if (pageInfo.state === 'idle' && pageInfo.lastActivityAt < cutoffTime) {
        try {
          await this.closePage(pageInfo.id, pageInfo.sessionId);
          cleaned++;
        } catch (error) {
          logger.warn({
            pageId: pageInfo.id,
            sessionId: pageInfo.sessionId,
            error,
          }, 'Failed to cleanup idle page');
        }
      }
    }
    
    return cleaned;
  }

  /**
   * Shutdown page manager
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all pages
    const allPages = Array.from(this.pages.keys());
    const closePromises = allPages.map(async (pageId) => {
      const pageInfo = await this.pageStore.get(pageId);
      if (pageInfo) {
        await this.closePage(pageId, pageInfo.sessionId).catch(error => {
          logger.error({ pageId, error }, 'Error closing page during shutdown');
        });
      }
    });

    await Promise.allSettled(closePromises);
    
    await this.pageStore.clear();
    this.pages.clear();

    logger.info('Page manager shutdown complete');
  }

  /**
   * Configure page with options
   * @private
   */
  private async configurePageOptions(page: Page, options: Partial<PageOptions>): Promise<void> {
    if (options.viewport) {
      await page.setViewport(options.viewport);
    }

    if (options.defaultTimeout) {
      page.setDefaultTimeout(options.defaultTimeout);
    }

    if (options.userAgent) {
      await page.setUserAgent(options.userAgent);
    }

    if (options.extraHeaders) {
      await page.setExtraHTTPHeaders(options.extraHeaders);
    }

    if (options.javaScriptEnabled !== undefined) {
      await page.setJavaScriptEnabled(options.javaScriptEnabled);
    }

    if (options.bypassCSP !== undefined) {
      await page.setBypassCSP(options.bypassCSP);
    }

    if (options.offline !== undefined) {
      await page.setOfflineMode(options.offline);
    }

    if (options.cacheEnabled !== undefined) {
      await page.setCacheEnabled(options.cacheEnabled);
    }

    if (options.cookies && options.cookies.length > 0) {
      await page.setCookie(...options.cookies);
    }
  }

  /**
   * Set up page event listeners
   * @private
   */
  private setupPageEventListeners(page: Page, pageInfo: PageInfo): void {
    const pageId = pageInfo.id;

    // Navigation events
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        const title = await page.title().catch(() => '');
        
        await this.pageStore.updateUrl(pageId, url);
        await this.pageStore.updateTitle(pageId, title);
        await this.pageStore.addNavigationHistory(pageId, url);
        await this.pageStore.touchActivity(pageId);

        this.emit('page:navigated', { pageId, url });
      }
    });

    // Error events
    page.on('error', async (error) => {
      await this.pageStore.incrementErrorCount(pageId);
      await this.pageStore.touchActivity(pageId);
      
      logger.error({
        pageId,
        error,
      }, 'Page error occurred');

      this.emit('page:error', { pageId, error });
    });

    page.on('pageerror', async (error) => {
      await this.pageStore.incrementErrorCount(pageId);
      await this.pageStore.touchActivity(pageId);
      
      logger.error({
        pageId,
        error,
      }, 'Page script error occurred');

      this.emit('page:error', { pageId, error });
    });

    // Console events for activity tracking
    page.on('console', async () => {
      await this.pageStore.touchActivity(pageId);
    });

    // Request events for activity tracking
    page.on('request', async () => {
      await this.pageStore.touchActivity(pageId);
    });
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
      // Clean up idle pages (30 minutes idle timeout)
      const cleaned = await this.cleanupIdlePages(30 * 60 * 1000);
      
      if (cleaned > 0) {
        logger.info({ cleaned }, 'Cleaned up idle pages');
      }
    } catch (error) {
      logger.error({ error }, 'Error during page cleanup');
    }
  }
}

/**
 * Singleton instance of page manager
 */
let pageManagerInstance: PageManager | undefined;

/**
 * Get or create page manager instance
 */
export const getPageManager = (browserPool?: BrowserPool): PageManager => {
  if (!pageManagerInstance && browserPool) {
    pageManagerInstance = new PageManager(browserPool);
  }
  
  if (!pageManagerInstance) {
    throw new Error('Page manager not initialized. Call with browserPool first.');
  }
  
  return pageManagerInstance;
};