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
import type { BrowserPool } from '../interfaces/browser-pool.interface.js';
import type {
  PageManager as IPageManager,
  PageInfo,
  PageOptions,
  NavigationOptions,
  ScreenshotOptions,
} from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';
import { configurePageOptions } from './page-configuration.js';
import { type PageEvents } from './page-event-handler.js';
import {
  getPageMetrics,
  setCookies,
  getCookies,
  clearPageData,
  takeScreenshot,
  isPageActive,
} from './page-operations.js';
import {
  navigatePage,
  navigateToWithEvents,
  updatePageOptions,
} from './page-navigation.js';
import {
  performCleanup,
  shutdownPageManager,
} from './page-manager-lifecycle.js';
import { 
  getPageWithAccessControl,
  getPageInfoWithAccessControl
} from './page-access-control.js';
import {
  listPagesForSession,
  listPagesForContext,
} from './page-list-operations.js';
import {
  closePageOperation,
  closePagesForContextOperation,
  closePagesForSessionOperation,
} from './page-close-operations.js';
import { initializePageManager } from './page-manager-init.js';
import { createPageImpl } from './page-manager-methods.js';
import { cleanupIdlePagesWithLogging } from './page-cleanup-methods.js';

// Type imports only for return types
import type { Cookie } from 'puppeteer';

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
    const init = initializePageManager(
      browserPool,
      pageStore,
      this,
      () => this.performCleanup()
    );
    
    this.browserPool = init.browserPool;
    this.pageStore = init.pageStore;
    this.pages = init.pages;
    this.cleanupInterval = init.cleanupInterval;
    this.isShuttingDown = init.isShuttingDown;
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
    return createPageImpl(
      contextId,
      sessionId,
      browserId,
      options,
      this.browserPool,
      this.pages,
      this.pageStore,
      this,
      this.isShuttingDown
    );
  }

  async getPage(pageId: string, sessionId: string): Promise<Page> {
    return getPageWithAccessControl(pageId, sessionId, this.pages, this.pageStore);
  }

  async getPageInfo(pageId: string, sessionId: string): Promise<PageInfo> {
    return getPageInfoWithAccessControl(pageId, sessionId, this.pageStore);
  }

  async navigatePage(
    pageId: string,
    sessionId: string,
    url: string,
    options?: NavigationOptions
  ): Promise<void> {
    return navigatePage(pageId, sessionId, url, options, this.pages, this.pageStore);
  }

  async navigateTo(
    pageId: string,
    url: string,
    sessionId: string,
    options?: NavigationOptions
  ): Promise<void> {
    return navigateToWithEvents(pageId, url, sessionId, options, this.pages, this.pageStore, this);
  }

  async updatePageOptions(
    pageId: string,
    options: Partial<PageOptions>,
    sessionId: string
  ): Promise<void> {
    return updatePageOptions(pageId, options, sessionId, this.pages, this.pageStore, configurePageOptions);
  }

  async takeScreenshot(
    pageId: string,
    sessionId: string,
    options?: ScreenshotOptions
  ): Promise<Buffer> {
    return takeScreenshot(pageId, sessionId, options, this.pages, this.pageStore);
  }

  async listPagesForSession(sessionId: string): Promise<PageInfo[]> {
    return listPagesForSession(sessionId, this.pageStore);
  }

  async listPagesForContext(contextId: string, sessionId: string): Promise<PageInfo[]> {
    return listPagesForContext(contextId, sessionId, this.pageStore);
  }

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

  async closePagesForContext(contextId: string): Promise<void> {
    return closePagesForContextOperation(contextId, this.pages, this.pageStore, this);
  }

  async closePagesForSession(sessionId: string): Promise<void> {
    return closePagesForSessionOperation(sessionId, this.pages, this.pageStore, this);
  }

  private async performCleanup(): Promise<void> {
    await performCleanup(this.pages, this.pageStore, this.isShuttingDown);
  }

  async getPageMetrics(pageId: string, sessionId: string): Promise<Record<string, unknown>> {
    return getPageMetrics(pageId, sessionId, this.pages, this.pageStore);
  }

  async setCookies(pageId: string, cookies: Cookie[], sessionId: string): Promise<void> {
    return setCookies(pageId, cookies, sessionId, this.pages, this.pageStore);
  }

  async getCookies(pageId: string, sessionId: string): Promise<Cookie[]> {
    return getCookies(pageId, sessionId, this.pages, this.pageStore);
  }

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

  async isPageActive(pageId: string): Promise<boolean> {
    return isPageActive(pageId, this.pageStore);
  }

  async cleanupIdlePages(idleTimeout: number): Promise<number> {
    return cleanupIdlePagesWithLogging(idleTimeout, this.pageStore);
  }


  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    await shutdownPageManager(this.pages, this.pageStore, this.cleanupInterval);
  }
}

// Re-export types
export type { PageEvents };

// Re-export factory function
export { getPageManager } from './page-manager-factory.js';
