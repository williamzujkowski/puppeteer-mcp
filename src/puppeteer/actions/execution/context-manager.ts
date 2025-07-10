/**
 * Browser context and page management for actions
 * @module puppeteer/actions/execution/context-manager
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import type { Page } from 'puppeteer';
import type { ActionContext } from '../../interfaces/action-executor.interface.js';
import type { PageManager } from '../../interfaces/page-manager.interface.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:context-manager');

/**
 * Context manager for browser actions
 * @nist ac-3 "Access enforcement"
 */
export class ActionContextManager {
  private readonly pageManager?: PageManager;
  private readonly pageCache = new Map<string, Page>();
  private readonly cacheTimeout = 30000; // 30 seconds

  constructor(pageManager?: PageManager) {
    this.pageManager = pageManager;
    
    // Clean up cache periodically
    setInterval(() => {
      this.cleanupCache();
    }, this.cacheTimeout);
  }

  /**
   * Get page instance for action execution
   * @param pageId - Page identifier
   * @param context - Execution context
   * @returns Page instance or null if not found
   */
  async getPage(pageId: string, context: ActionContext): Promise<Page | null> {
    try {
      logger.debug('Getting page instance', {
        pageId,
        sessionId: context.sessionId,
        contextId: context.contextId,
      });

      // Check cache first
      const cachedPage = this.pageCache.get(pageId);
      if (cachedPage && !cachedPage.isClosed()) {
        logger.debug('Retrieved page from cache', { pageId });
        return cachedPage;
      }

      // Remove stale cache entry
      if (cachedPage) {
        this.pageCache.delete(pageId);
      }

      // Get from page manager
      if (!this.pageManager) {
        throw new Error('Page manager not configured');
      }

      const page = await this.pageManager.getPage(pageId, context.sessionId);
      if (!page) {
        logger.warn('Page not found', {
          pageId,
          sessionId: context.sessionId,
          contextId: context.contextId,
        });
        return null;
      }

      // Cache the page
      this.pageCache.set(pageId, page);

      logger.debug('Retrieved page from manager', {
        pageId,
        sessionId: context.sessionId,
        contextId: context.contextId,
      });

      return page;
    } catch (error) {
      logger.error('Failed to get page instance', {
        pageId,
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Validate page is ready for action execution
   * @param page - Page instance
   * @param context - Execution context
   * @returns True if page is ready
   */
  async validatePageReady(page: Page, context: ActionContext): Promise<boolean> {
    try {
      // Check if page is closed
      if (page.isClosed()) {
        logger.warn('Page is closed', {
          sessionId: context.sessionId,
          contextId: context.contextId,
        });
        return false;
      }

      // Check if page has navigated to a URL
      const url = page.url();
      if (!url || url === 'about:blank') {
        logger.debug('Page has no URL or is blank', {
          url,
          sessionId: context.sessionId,
          contextId: context.contextId,
        });
        // This is not necessarily an error - some actions work on blank pages
      }

      // Try to evaluate a simple expression to ensure page is responsive
      try {
        await page.evaluate(() => true);
      } catch (error) {
        logger.warn('Page is not responsive', {
          sessionId: context.sessionId,
          contextId: context.contextId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to validate page readiness', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Setup page for action execution
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Default timeout for actions
   */
  async setupPageForAction(
    page: Page,
    context: ActionContext,
    timeout: number = 30000,
  ): Promise<void> {
    try {
      logger.debug('Setting up page for action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        timeout,
      });

      // Set default timeout
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);

      // Set viewport if not already set
      const viewport = page.viewport();
      if (!viewport) {
        await page.setViewport({
          width: 1280,
          height: 720,
          deviceScaleFactor: 1,
        });
      }

      // Ensure page is not loading
      try {
        await page.waitForLoadState?.('networkidle', { timeout: 5000 });
      } catch {
        // Ignore timeout - page might be in a valid state
        logger.debug('Page load state timeout (ignored)', {
          sessionId: context.sessionId,
          contextId: context.contextId,
        });
      }

      logger.debug('Page setup completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url: page.url(),
        viewport: page.viewport(),
      });
    } catch (error) {
      logger.error('Failed to setup page for action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clean up page after action execution
   * @param page - Page instance
   * @param context - Execution context
   * @param preserveState - Whether to preserve page state
   */
  async cleanupAfterAction(
    page: Page,
    context: ActionContext,
    preserveState: boolean = true,
  ): Promise<void> {
    try {
      logger.debug('Cleaning up after action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        preserveState,
      });

      if (!preserveState) {
        // Clear cookies if not preserving state
        try {
          const cookies = await page.cookies();
          if (cookies.length > 0) {
            await page.deleteCookie(...cookies);
          }
        } catch (error) {
          logger.debug('Failed to clear cookies during cleanup', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        // Clear local storage
        try {
          await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
          });
        } catch (error) {
          logger.debug('Failed to clear storage during cleanup', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Remove any temporary event listeners or modifications
      try {
        await page.evaluate(() => {
          // Remove any added event listeners with our namespace
          const elements = document.querySelectorAll('[data-puppeteer-listener]');
          elements.forEach(el => {
            el.removeAttribute('data-puppeteer-listener');
            // Note: We can't easily remove event listeners without references
          });
        });
      } catch (error) {
        logger.debug('Failed to cleanup event listeners', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      logger.debug('Page cleanup completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
      });
    } catch (error) {
      logger.error('Failed to cleanup after action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - cleanup failures shouldn't break the action flow
    }
  }

  /**
   * Get page information for debugging
   * @param page - Page instance
   * @returns Page information object
   */
  async getPageInfo(page: Page): Promise<{
    url: string;
    title: string;
    viewport: { width: number; height: number } | null;
    cookies: number;
    isLoading: boolean;
    isClosed: boolean;
  }> {
    try {
      const [url, title, viewport, cookies, isLoading] = await Promise.all([
        page.url(),
        page.title().catch(() => ''),
        page.viewport(),
        page.cookies().catch(() => []),
        page.evaluate(() => document.readyState !== 'complete').catch(() => false),
      ]);

      return {
        url,
        title,
        viewport,
        cookies: cookies.length,
        isLoading,
        isClosed: page.isClosed(),
      };
    } catch (error) {
      logger.error('Failed to get page info', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        url: '',
        title: '',
        viewport: null,
        cookies: 0,
        isLoading: false,
        isClosed: page.isClosed(),
      };
    }
  }

  /**
   * Check if page manager is available
   * @returns True if page manager is configured
   */
  hasPageManager(): boolean {
    return this.pageManager !== undefined;
  }

  /**
   * Get cache stats for monitoring
   * @returns Cache statistics
   */
  getCacheStats(): {
    size: number;
    pages: string[];
  } {
    return {
      size: this.pageCache.size,
      pages: Array.from(this.pageCache.keys()),
    };
  }

  /**
   * Clear page cache
   */
  clearCache(): void {
    logger.debug('Clearing page cache', { size: this.pageCache.size });
    this.pageCache.clear();
  }

  /**
   * Clean up stale cache entries
   */
  private cleanupCache(): void {
    const stalePagesIds: string[] = [];
    
    this.pageCache.forEach((page, pageId) => {
      if (page.isClosed()) {
        stalePagesIds.push(pageId);
      }
    });

    if (stalePagesIds.length > 0) {
      logger.debug('Cleaning up stale cache entries', {
        count: stalePagesIds.length,
        pageIds: stalePagesIds,
      });
      
      for (const pageId of stalePagesIds) {
        this.pageCache.delete(pageId);
      }
    }
  }
}

/**
 * Wait for page load state
 * Note: This is a compatibility shim since page.waitForLoadState doesn't exist in Puppeteer
 * We'll implement similar functionality using existing Puppeteer methods
 */
declare module 'puppeteer' {
  interface Page {
    waitForLoadState?(
      state: 'load' | 'domcontentloaded' | 'networkidle',
      options?: { timeout?: number }
    ): Promise<void>;
  }
}

// Note: waitForLoadState implementation is provided as a compatibility shim
// but is not actually implemented here to avoid runtime prototype modification