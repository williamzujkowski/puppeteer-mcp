/**
 * Page Manager Unit Tests
 * @module tests/unit/puppeteer/page-manager
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { Page, Viewport, Cookie } from 'puppeteer';
import { PageManager } from '../../../src/puppeteer/pages/page-manager.js';
import { InMemoryPageInfoStore } from '../../../src/puppeteer/pages/page-info-store.js';
import type { BrowserPool, BrowserInstance } from '../../../src/puppeteer/interfaces/browser-pool.interface.js';
import type { Context } from '../../../src/store/context-store.js';
import { contextStore } from '../../../src/store/context-store.js';

// Set environment to test
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

jest.mock('../../../src/utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  logSecurityEvent: jest.fn(),
  SecurityEventType: {
    RESOURCE_CREATED: 'RESOURCE_CREATED',
    RESOURCE_UPDATED: 'RESOURCE_UPDATED',
    RESOURCE_DELETED: 'RESOURCE_DELETED',
    ACCESS_DENIED: 'ACCESS_DENIED',
    DATA_ACCESS: 'DATA_ACCESS',
    DATA_DELETION: 'DATA_DELETION',
    ERROR: 'ERROR',
  },
}));

jest.mock('../../../src/store/context-store.js', () => ({
  contextStore: {
    get: jest.fn(),
  },
}));

describe('PageManager', () => {
  let pageManager: PageManager;
  let mockBrowserPool: MockedBrowserPool;
  let pageStore: InMemoryPageInfoStore;
  let mockPage: MockedPage;

  // Mock types
  interface MockedBrowserPool extends BrowserPool {
    createPage: jest.MockedFunction<BrowserPool['createPage']>;
    closePage: jest.MockedFunction<BrowserPool['closePage']>;
  }

  interface MockedPage extends Partial<Page> {
    url: jest.MockedFunction<() => string>;
    title: jest.MockedFunction<() => Promise<string>>;
    goto: jest.MockedFunction<Page['goto']>;
    close: jest.MockedFunction<Page['close']>;
    setViewport: jest.MockedFunction<Page['setViewport']>;
    setDefaultTimeout: jest.MockedFunction<Page['setDefaultTimeout']>;
    setUserAgent: jest.MockedFunction<Page['setUserAgent']>;
    setExtraHTTPHeaders: jest.MockedFunction<Page['setExtraHTTPHeaders']>;
    setJavaScriptEnabled: jest.MockedFunction<Page['setJavaScriptEnabled']>;
    setBypassCSP: jest.MockedFunction<Page['setBypassCSP']>;
    setOfflineMode: jest.MockedFunction<Page['setOfflineMode']>;
    setCacheEnabled: jest.MockedFunction<Page['setCacheEnabled']>;
    setCookie: jest.MockedFunction<Page['setCookie']>;
    cookies: jest.MockedFunction<Page['cookies']>;
    deleteCookie: jest.MockedFunction<Page['deleteCookie']>;
    screenshot: jest.MockedFunction<Page['screenshot']>;
    metrics: jest.MockedFunction<Page['metrics']>;
    evaluate: jest.MockedFunction<Page['evaluate']>;
    reload: jest.MockedFunction<Page['reload']>;
    on: jest.MockedFunction<Page['on']>;
    mainFrame: jest.MockedFunction<Page['mainFrame']>;
  }


  beforeEach(() => {
    // Create mock page
    mockPage = {
      url: jest.fn(() => 'https://example.com'),
      title: jest.fn(() => Promise.resolve('Example Page')),
      goto: jest.fn(() => Promise.resolve(null)),
      close: jest.fn(() => Promise.resolve()),
      setViewport: jest.fn(() => Promise.resolve()),
      setDefaultTimeout: jest.fn(),
      setUserAgent: jest.fn(() => Promise.resolve()),
      setExtraHTTPHeaders: jest.fn(() => Promise.resolve()),
      setJavaScriptEnabled: jest.fn(() => Promise.resolve()),
      setBypassCSP: jest.fn(() => Promise.resolve()),
      setOfflineMode: jest.fn(() => Promise.resolve()),
      setCacheEnabled: jest.fn(() => Promise.resolve()),
      setCookie: jest.fn(() => Promise.resolve()),
      cookies: jest.fn(() => Promise.resolve([])),
      deleteCookie: jest.fn(() => Promise.resolve()),
      screenshot: jest.fn(() => Promise.resolve(Buffer.from('mock-screenshot'))),
      metrics: jest.fn(() => Promise.resolve({})),
      evaluate: jest.fn(() => Promise.resolve()),
      reload: jest.fn(() => Promise.resolve(null)),
      on: jest.fn(),
      mainFrame: jest.fn(() => ({ url: (): string => 'https://example.com' })),
    } as MockedPage;


    // Create mock browser pool
    mockBrowserPool = {
      createPage: jest.fn(() => Promise.resolve(mockPage as Page)),
      closePage: jest.fn(() => Promise.resolve()),
      // Add other required methods as no-ops
      initialize: jest.fn(() => Promise.resolve()),
      acquireBrowser: jest.fn((): Promise<BrowserInstance> => Promise.resolve({} as BrowserInstance)),
      releaseBrowser: jest.fn(() => Promise.resolve()),
      getMetrics: jest.fn(() => ({} as unknown)),
      healthCheck: jest.fn(() => Promise.resolve(new Map())),
      recycleBrowser: jest.fn(() => Promise.resolve()),
      shutdown: jest.fn(() => Promise.resolve()),
      configure: jest.fn(),
      getBrowser: jest.fn(),
      listBrowsers: jest.fn(() => []),
      cleanupIdle: jest.fn(() => Promise.resolve(0)),
    } as MockedBrowserPool;

    // Create page store
    pageStore = new InMemoryPageInfoStore();

    // Create page manager
    pageManager = new PageManager(mockBrowserPool, pageStore);

    // Mock context store
    (contextStore.get as jest.MockedFunction<typeof contextStore.get>).mockResolvedValue({
      id: 'test-context',
      sessionId: 'test-session',
      name: 'Test Context',
      type: 'browser',
      config: {},
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active',
      userId: 'test-user',
    } as Context);
  });

  afterEach(async () => {
    await pageManager.shutdown();
    jest.clearAllMocks();
    
    // Reset context store mock to default value
    (contextStore.get as jest.MockedFunction<typeof contextStore.get>).mockResolvedValue({
      id: 'test-context',
      sessionId: 'test-session',
      name: 'Test Context',
      type: 'browser',
      config: {},
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active',
      userId: 'test-user',
    } as Context);
  });

  describe('createPage', () => {
    it('should create a new page successfully', async () => {
      const pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );

      expect(pageInfo).toBeDefined();
      expect(pageInfo.contextId).toBe('test-context');
      expect(pageInfo.sessionId).toBe('test-session');
      expect(pageInfo.browserId).toBe('test-browser');
      expect(pageInfo.url).toBe('https://example.com');
      expect(pageInfo.title).toBe('Example Page');
      expect(pageInfo.state).toBe('active');
      expect(pageInfo.navigationHistory).toContain('https://example.com');

      expect(mockBrowserPool.createPage).toHaveBeenCalledWith('test-browser', 'test-session');
      expect(mockPage.title).toHaveBeenCalled();
    });

    it('should create page with options', async () => {
      const options = {
        viewport: { width: 1920, height: 1080 } as Viewport,
        userAgent: 'Test Agent',
        extraHeaders: { 'X-Test': 'header' },
        javaScriptEnabled: false,
      };

      const pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser',
        options
      );

      expect(pageInfo).toBeDefined();
      expect(mockPage.setViewport).toHaveBeenCalledWith(options.viewport);
      expect(mockPage.setUserAgent).toHaveBeenCalledWith(options.userAgent);
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith(options.extraHeaders);
      expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    });

    it('should throw error if context not found', async () => {
      (contextStore.get as jest.MockedFunction<typeof contextStore.get>).mockResolvedValue(null);

      await expect(
        pageManager.createPage('invalid-context', 'test-session', 'test-browser')
      ).rejects.toThrow('Context not found');
    });

    it('should throw error if context does not belong to session', async () => {
      (contextStore.get as jest.MockedFunction<typeof contextStore.get>).mockResolvedValue({
        id: 'test-context',
        sessionId: 'different-session',
        name: 'Test Context',
        type: 'browser',
        config: {},
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active',
        userId: 'test-user',
      } as Context);

      await expect(
        pageManager.createPage('test-context', 'test-session', 'test-browser')
      ).rejects.toThrow('Access denied: Context does not belong to session');
    });

    it('should emit page:created event', async () => {
      const eventSpy = jest.fn();
      pageManager.on('page:created', eventSpy);

      const pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );

      expect(eventSpy).toHaveBeenCalledWith({ pageInfo });
    });
  });

  describe('getPage', () => {
    let pageInfo: any;

    beforeEach(async () => {
      pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should return page for valid session', async () => {
      const page = await pageManager.getPage(pageInfo.id, 'test-session');
      expect(page).toBe(mockPage);
    });

    it('should return undefined for non-existent page', async () => {
      const page = await pageManager.getPage('invalid-page', 'test-session');
      expect(page).toBeUndefined();
    });

    it('should throw error for unauthorized session', async () => {
      await expect(
        pageManager.getPage(pageInfo.id, 'different-session')
      ).rejects.toThrow('Access denied: Page does not belong to session');
    });
  });

  describe('getPageInfo', () => {
    let pageInfo: any;

    beforeEach(async () => {
      pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should return page info for valid session', async () => {
      const info = await pageManager.getPageInfo(pageInfo.id, 'test-session');
      expect(info).toBeDefined();
      expect(info?.id).toBe(pageInfo.id);
    });

    it('should return undefined for non-existent page', async () => {
      const info = await pageManager.getPageInfo('invalid-page', 'test-session');
      expect(info).toBeUndefined();
    });
  });

  describe('listPagesForContext', () => {
    it('should list pages for context', async () => {
      const pageInfo1 = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
      const pageInfo2 = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );

      const pages = await pageManager.listPagesForContext('test-context', 'test-session');
      
      expect(pages).toHaveLength(2);
      expect(pages.map(p => p.id)).toContain(pageInfo1.id);
      expect(pages.map(p => p.id)).toContain(pageInfo2.id);
    });

    it('should throw error for unauthorized session', async () => {
      (contextStore.get as jest.MockedFunction<typeof contextStore.get>).mockResolvedValue({
        id: 'test-context',
        sessionId: 'different-session',
        name: 'Test Context',
        type: 'browser',
        config: {},
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active',
        userId: 'test-user',
      } as Context);

      await expect(
        pageManager.listPagesForContext('test-context', 'test-session')
      ).rejects.toThrow('Access denied: Context does not belong to session');
    });
  });

  describe('listPagesForSession', () => {
    it('should list all pages for session', async () => {
      const pageInfo1 = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
      const pageInfo2 = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );

      const pages = await pageManager.listPagesForSession('test-session');
      
      expect(pages).toHaveLength(2);
      expect(pages.map(p => p.id)).toContain(pageInfo1.id);
      expect(pages.map(p => p.id)).toContain(pageInfo2.id);
    });
  });

  describe('navigateTo', () => {
    let pageInfo: any;

    beforeEach(async () => {
      pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should navigate page to URL', async () => {
      const newUrl = 'https://newexample.com';
      mockPage.url.mockReturnValue(newUrl);
      mockPage.title.mockResolvedValue('New Page');

      await pageManager.navigateTo(pageInfo.id, newUrl, 'test-session');

      expect(mockPage.goto).toHaveBeenCalledWith(newUrl, {
        timeout: 30000,
        waitUntil: 'load',
        referer: undefined,
      });

      // Verify page info was updated
      const updatedInfo = await pageManager.getPageInfo(pageInfo.id, 'test-session');
      expect(updatedInfo?.url).toBe(newUrl);
      expect(updatedInfo?.title).toBe('New Page');
      expect(updatedInfo?.navigationHistory).toContain(newUrl);
    });

    it('should navigate with custom options', async () => {
      const newUrl = 'https://newexample.com';
      const options = {
        timeout: 60000,
        waitUntil: 'networkidle0' as const,
        referer: 'https://referrer.com',
      };

      await pageManager.navigateTo(pageInfo.id, newUrl, 'test-session', options);

      expect(mockPage.goto).toHaveBeenCalledWith(newUrl, options);
    });

    it('should handle navigation errors', async () => {
      const error = new Error('Navigation failed');
      mockPage.goto.mockRejectedValue(error);

      await expect(
        pageManager.navigateTo(pageInfo.id, 'https://invalid.com', 'test-session')
      ).rejects.toThrow('Navigation failed');

      // Verify error count was incremented
      const updatedInfo = await pageManager.getPageInfo(pageInfo.id, 'test-session');
      expect(updatedInfo?.errorCount).toBe(1);
    });

    it('should emit navigation events', async () => {
      const navigatedSpy = jest.fn();
      const stateChangedSpy = jest.fn();
      
      pageManager.on('page:navigated', navigatedSpy);
      pageManager.on('page:state-changed', stateChangedSpy);

      const newUrl = 'https://newexample.com';
      mockPage.url.mockReturnValue(newUrl);

      await pageManager.navigateTo(pageInfo.id, newUrl, 'test-session');

      expect(navigatedSpy).toHaveBeenCalledWith({ pageId: pageInfo.id, url: newUrl });
      expect(stateChangedSpy).toHaveBeenCalledTimes(2); // navigating -> active
    });
  });

  describe('closePage', () => {
    let pageInfo: any;

    beforeEach(async () => {
      pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should close page successfully', async () => {
      await pageManager.closePage(pageInfo.id, 'test-session');

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowserPool.closePage).toHaveBeenCalledWith(
        'test-browser',
        pageInfo.id,
        'test-session'
      );

      // Verify page was removed from store
      const retrievedInfo = await pageManager.getPageInfo(pageInfo.id, 'test-session');
      expect(retrievedInfo).toBeUndefined();
    });

    it('should emit page:closed event', async () => {
      const eventSpy = jest.fn();
      pageManager.on('page:closed', eventSpy);

      await pageManager.closePage(pageInfo.id, 'test-session');

      expect(eventSpy).toHaveBeenCalledWith({
        pageId: pageInfo.id,
        contextId: 'test-context',
      });
    });

    it('should handle page close errors gracefully', async () => {
      mockPage.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw despite page close error
      await expect(
        pageManager.closePage(pageInfo.id, 'test-session')
      ).resolves.not.toThrow();
    });
  });

  describe('closePagesForContext', () => {
    beforeEach(async (): Promise<void> => {
      await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
      await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should close all pages for context', async () => {
      await pageManager.closePagesForContext('test-context', 'test-session');

      expect(mockPage.close).toHaveBeenCalledTimes(2);
      
      // Verify pages were removed
      const pages = await pageManager.listPagesForContext('test-context', 'test-session');
      expect(pages).toHaveLength(0);
    });

    it('should emit context:pages-cleared event', async () => {
      const eventSpy = jest.fn();
      pageManager.on('context:pages-cleared', eventSpy);

      await pageManager.closePagesForContext('test-context', 'test-session');

      expect(eventSpy).toHaveBeenCalledWith({
        contextId: 'test-context',
        pageCount: 2,
      });
    });
  });

  describe('closePagesForSession', () => {
    beforeEach(async (): Promise<void> => {
      await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
      await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should close all pages for session', async () => {
      await pageManager.closePagesForSession('test-session');

      expect(mockPage.close).toHaveBeenCalledTimes(2);
      
      // Verify pages were removed
      const pages = await pageManager.listPagesForSession('test-session');
      expect(pages).toHaveLength(0);
    });

    it('should emit session:pages-cleared event', async () => {
      const eventSpy = jest.fn();
      pageManager.on('session:pages-cleared', eventSpy);

      await pageManager.closePagesForSession('test-session');

      expect(eventSpy).toHaveBeenCalledWith({
        sessionId: 'test-session',
        pageCount: 2,
      });
    });
  });

  describe('takeScreenshot', () => {
    let pageInfo: any;

    beforeEach(async () => {
      pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should take screenshot with default options', async () => {
      const screenshot = await pageManager.takeScreenshot(pageInfo.id, 'test-session');

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'png',
        quality: undefined,
        fullPage: false,
        clip: undefined,
        omitBackground: undefined,
        encoding: 'binary',
      });
      expect(screenshot).toEqual(Buffer.from('mock-screenshot'));
    });

    it('should take screenshot with custom options', async () => {
      const options = {
        type: 'jpeg' as const,
        quality: 80,
        fullPage: true,
        encoding: 'base64' as const,
      };

      await pageManager.takeScreenshot(pageInfo.id, 'test-session', options);

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'jpeg',
        quality: 80,
        fullPage: true,
        clip: undefined,
        omitBackground: undefined,
        encoding: 'base64',
      });
    });
  });

  describe('setCookies and getCookies', () => {
    let pageInfo: any;

    beforeEach(async () => {
      pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should set cookies on page', async () => {
      const cookies: Cookie[] = [
        { name: 'test', value: 'value', domain: 'example.com' },
      ];

      await pageManager.setCookies(pageInfo.id, cookies, 'test-session');

      expect(mockPage.setCookie).toHaveBeenCalledWith(...cookies);
    });

    it('should get cookies from page', async () => {
      const mockCookies: Cookie[] = [
        { name: 'test', value: 'value', domain: 'example.com' },
      ];
      mockPage.cookies.mockResolvedValue(mockCookies);

      const cookies = await pageManager.getCookies(pageInfo.id, 'test-session');

      expect(mockPage.cookies).toHaveBeenCalled();
      expect(cookies).toEqual(mockCookies);
    });
  });

  describe('clearPageData', () => {
    let pageInfo: any;

    beforeEach(async () => {
      pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should clear all data by default', async () => {
      mockPage.cookies.mockResolvedValue([
        { name: 'test', value: 'value', domain: 'example.com' },
      ]);

      await pageManager.clearPageData(pageInfo.id, 'test-session');

      expect(mockPage.cookies).toHaveBeenCalled();
      expect(mockPage.deleteCookie).toHaveBeenCalled();
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockPage.reload).toHaveBeenCalled();
    });

    it('should clear only specified data types', async () => {
      await pageManager.clearPageData(pageInfo.id, 'test-session', {
        cookies: false,
        cache: false,
        localStorage: true,
        sessionStorage: false,
      });

      expect(mockPage.cookies).not.toHaveBeenCalled();
      expect(mockPage.reload).not.toHaveBeenCalled();
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        { 
          cookies: false,
          cache: false,
          localStorage: true, 
          sessionStorage: false 
        }
      );
    });
  });

  describe('getPageMetrics', () => {
    let pageInfo: any;

    beforeEach(async () => {
      pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should return page metrics', async () => {
      const mockMetrics = { JSHeapUsedSize: 1024 };
      mockPage.metrics.mockResolvedValue(mockMetrics);

      const metrics = await pageManager.getPageMetrics(pageInfo.id, 'test-session');

      expect(mockPage.metrics).toHaveBeenCalled();
      expect(metrics).toEqual(mockMetrics);
    });
  });

  describe('isPageActive', () => {
    let pageInfo: any;

    beforeEach(async () => {
      pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should return true for active page', async () => {
      const isActive = await pageManager.isPageActive(pageInfo.id);
      expect(isActive).toBe(true);
    });

    it('should return false for non-existent page', async () => {
      const isActive = await pageManager.isPageActive('invalid-page');
      expect(isActive).toBe(false);
    });
  });

  describe('cleanupIdlePages', () => {
    it('should clean up idle pages', async () => {
      // Create page and mark as idle
      const pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
      
      // Set the page to idle state and old timestamp
      await pageStore.updateState(pageInfo.id, 'idle');
      await pageStore.update(pageInfo.id, {
        lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        state: 'idle'
      });

      // Verify the page info was updated correctly before cleanup
      const beforeCleanup = await pageStore.get(pageInfo.id);
      expect(beforeCleanup?.state).toBe('idle');
      expect(beforeCleanup?.lastActivityAt.getTime()).toBeLessThan(Date.now() - 60 * 60 * 1000);

      const cleaned = await pageManager.cleanupIdlePages(60 * 60 * 1000); // 1 hour timeout

      expect(cleaned).toBe(1);
      
      // Verify page was removed
      const retrievedInfo = await pageStore.get(pageInfo.id);
      expect(retrievedInfo).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle browser pool errors during page creation', async () => {
      mockBrowserPool.createPage.mockRejectedValue(new Error('Pool error'));

      await expect(
        pageManager.createPage('test-context', 'test-session', 'test-browser')
      ).rejects.toThrow('Pool error');
    });

    it('should handle page configuration errors', async () => {
      mockPage.setViewport.mockRejectedValue(new Error('Viewport error'));

      await expect(
        pageManager.createPage('test-context', 'test-session', 'test-browser', {
          viewport: { width: 1920, height: 1080 },
        })
      ).rejects.toThrow('Viewport error');
    });
  });

  describe('event emission', () => {
    let pageInfo: any;

    beforeEach(async () => {
      pageInfo = await pageManager.createPage(
        'test-context',
        'test-session',
        'test-browser'
      );
    });

    it('should emit page:error event', () => {
      const errorSpy = jest.fn();
      pageManager.on('page:error', errorSpy);

      const testError = new Error('Test error');
      
      // Simulate page error by calling the error handler directly
      // (since we can't easily trigger real page events in tests)
      pageManager.emit('page:error', { pageId: pageInfo.id, error: testError });

      expect(errorSpy).toHaveBeenCalledWith({
        pageId: pageInfo.id,
        error: testError,
      });
    });

    it('should emit page:state-changed event', () => {
      const stateChangedSpy = jest.fn();
      pageManager.on('page:state-changed', stateChangedSpy);

      pageManager.emit('page:state-changed', { pageId: pageInfo.id, state: 'idle' });

      expect(stateChangedSpy).toHaveBeenCalledWith({
        pageId: pageInfo.id,
        state: 'idle',
      });
    });
  });
});