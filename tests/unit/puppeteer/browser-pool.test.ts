/**
 * Browser Pool Unit Tests
 * @module tests/unit/puppeteer/browser-pool
 * @nist si-4 "Information system monitoring"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';
import type { Browser, Page } from 'puppeteer';

// Set environment to test
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Create mock logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  child: jest.fn(() => mockLogger),
};

// Mock puppeteer
const mockBrowser = {
  newPage: jest.fn(),
  close: jest.fn(),
  pages: jest.fn(),
  process: jest.fn(() => ({ pid: 12345 })),
  isConnected: jest.fn(() => true),
  on: jest.fn(),
  off: jest.fn(),
} as unknown as jest.Mocked<Browser>;

const mockPage = {
  close: jest.fn(),
  url: jest.fn(() => 'about:blank'),
  goto: jest.fn(),
  evaluate: jest.fn().mockResolvedValue(42),
  setRequestInterception: jest.fn(),
  metrics: jest.fn().mockResolvedValue({
    JSHeapUsedSize: 100 * 1024 * 1024, // 100MB
    JSHeapTotalSize: 200 * 1024 * 1024,
  }),
} as unknown as jest.Mocked<Page>;

mockBrowser.newPage.mockResolvedValue(mockPage);
mockBrowser.pages.mockResolvedValue([mockPage]);

// Mock modules
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue(mockBrowser),
}));

jest.mock('../../../src/utils/logger.js', () => ({
  createLogger: jest.fn(() => mockLogger),
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  SecurityEventType: {
    SERVICE_START: 'SERVICE_START',
    SERVICE_STOP: 'SERVICE_STOP',
    RESOURCE_CREATED: 'RESOURCE_CREATED',
    RESOURCE_DELETED: 'RESOURCE_DELETED',
    ACCESS_DENIED: 'ACCESS_DENIED',
  },
}));

// Import modules
import { BrowserPool } from '../../../src/puppeteer/pool/browser-pool.js';
import type { BrowserPoolOptions, BrowserInstance } from '../../../src/puppeteer/interfaces/browser-pool.interface.js';
import * as puppeteer from 'puppeteer';

describe('BrowserPool', () => {
  let pool: BrowserPool;
  let options: BrowserPoolOptions;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset puppeteer mock
    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);

    // Setup pool options
    options = {
      maxBrowsers: 3,
      maxPagesPerBrowser: 5,
      launchOptions: {
        headless: true,
        args: ['--no-sandbox'],
      },
      idleTimeout: 30000,
      healthCheckInterval: 10000,
      recycleAfterUses: 100,
      enableRequestInterception: true,
    };

    pool = new BrowserPool(options);
  });

  afterEach(async () => {
    await pool.shutdown(true);
  });

  describe('Pool Initialization', () => {
    it('should initialize pool with correct configuration', async () => {
      await pool.initialize();
      
      const metrics = pool.getMetrics();
      expect(metrics.totalBrowsers).toBe(0);
      expect(metrics.activeBrowsers).toBe(0);
      expect(metrics.idleBrowsers).toBe(0);
    });

    it('should apply configuration options correctly', () => {
      pool.configure({ maxBrowsers: 5 });
      // Configuration should be updated
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ maxBrowsers: 5 }),
        'Browser pool configuration updated'
      );
    });

    it('should reject invalid configuration', () => {
      expect(() => {
        pool.configure({ maxBrowsers: -1 });
      }).toThrow('Invalid configuration: maxBrowsers must be positive');
    });
  });

  describe('Browser Acquisition and Release', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should acquire a browser instance', async () => {
      const instance = await pool.acquireBrowser('session-123');
      
      expect(instance).toBeDefined();
      expect(instance.id).toBeDefined();
      expect(instance.browser).toBe(mockBrowser);
      expect(instance.useCount).toBe(1);
      
      const metrics = pool.getMetrics();
      expect(metrics.totalBrowsers).toBe(1);
      expect(metrics.activeBrowsers).toBe(1);
      expect(metrics.idleBrowsers).toBe(0);
    });

    it('should release a browser back to pool', async () => {
      const instance = await pool.acquireBrowser('session-123');
      pool.releaseBrowser(instance.id);
      
      const metrics = pool.getMetrics();
      expect(metrics.activeBrowsers).toBe(0);
      expect(metrics.idleBrowsers).toBe(1);
    });

    it('should reuse idle browsers', async () => {
      const instance1 = await pool.acquireBrowser('session-123');
      pool.releaseBrowser(instance1.id);
      
      const instance2 = await pool.acquireBrowser('session-456');
      
      expect(instance2.id).toBe(instance1.id);
      expect(instance2.useCount).toBe(2);
      expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent acquisitions', async () => {
      let launchCount = 0;
      (puppeteer.launch as jest.Mock).mockImplementation(() => {
        launchCount++;
        return {
          ...mockBrowser,
          // Create unique browser instances
          _id: launchCount,
        };
      });

      const promises = [
        pool.acquireBrowser('session-1'),
        pool.acquireBrowser('session-2'),
        pool.acquireBrowser('session-3'),
      ];

      const instances = await Promise.all(promises);
      
      expect(instances).toHaveLength(3);
      expect(new Set(instances.map(i => i.id)).size).toBe(3);
      expect(puppeteer.launch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Pool Size Limits', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should enforce maximum browser limit', async () => {
      // Acquire max browsers
      const instances = await Promise.all([
        pool.acquireBrowser('session-1'),
        pool.acquireBrowser('session-2'),
        pool.acquireBrowser('session-3'),
      ]);

      // Should queue when at limit
      const acquirePromise = pool.acquireBrowser('session-4');
      
      // Give some time to ensure it's queued
      await new Promise<void>(resolve => { setTimeout(resolve, 100); });
      
      // Release one browser
      pool.releaseBrowser(instances[0].id);
      
      // Now the queued request should complete
      const instance4 = await acquirePromise;
      expect(instance4).toBeDefined();
    });

    it('should timeout acquisition requests', async () => {
      // Fill the pool
      await Promise.all([
        pool.acquireBrowser('session-1'),
        pool.acquireBrowser('session-2'),
        pool.acquireBrowser('session-3'),
      ]);

      // Configure short timeout
      pool.configure({ acquisitionTimeout: 100 } as any);

      // This should timeout
      await expect(pool.acquireBrowser('session-4')).rejects.toThrow(
        'Browser acquisition timeout'
      );
    });
  });

  describe('Page Management', () => {
    let instance: BrowserInstance;

    beforeEach(async () => {
      await pool.initialize();
      instance = await pool.acquireBrowser('session-123');
    });

    it('should create a new page', async () => {
      const page = await pool.createPage(instance.id, 'session-123');
      
      expect(page).toBe(mockPage);
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(instance.pageCount).toBe(1);
    });

    it('should enforce page limit per browser', async () => {
      // Create max pages
      for (let i = 0; i < 5; i++) {
        await pool.createPage(instance.id, 'session-123');
      }

      // Should reject when at limit
      await expect(pool.createPage(instance.id, 'session-123')).rejects.toThrow(
        'Page limit reached for browser'
      );
    });

    it('should close pages', async () => {
      await pool.createPage(instance.id, 'session-123');
      
      pool.closePage(instance.id, 'session-123');
      
      expect(mockPage.close).toHaveBeenCalled();
      expect(instance.pageCount).toBe(0);
    });
  });

  describe('Idle Timeout', () => {
    beforeEach(async () => {
      await pool.initialize();
      pool.configure({ idleTimeout: 100 }); // 100ms for testing
    });

    it('should clean up idle browsers after timeout', async () => {
      const instance = await pool.acquireBrowser('session-123');
      pool.releaseBrowser(instance.id);

      // Wait for idle timeout
      await new Promise<void>(resolve => { setTimeout(resolve, 150); });
      
      const cleaned = pool.cleanupIdle();
      
      expect(cleaned).toBe(1);
      expect(mockBrowser.close).toHaveBeenCalled();
      
      const metrics = pool.getMetrics();
      expect(metrics.totalBrowsers).toBe(0);
    });

    it('should not clean up active browsers', async () => {
      await pool.acquireBrowser('session-123'); // Keep active

      await new Promise<void>(resolve => { setTimeout(resolve, 150); });
      
      const cleaned = pool.cleanupIdle();
      
      expect(cleaned).toBe(0);
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });
  });

  describe('Health Checks', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should perform health check on all browsers', async () => {
      const instance1 = await pool.acquireBrowser('session-1');
      const instance2 = await pool.acquireBrowser('session-2');

      const healthResults = pool.healthCheck();
      
      expect(healthResults.size).toBe(2);
      expect(healthResults.get(instance1.id)).toBe(true);
      expect(healthResults.get(instance2.id)).toBe(true);
    });

    it('should detect unhealthy browsers', async () => {
      const unhealthyBrowser = {
        ...mockBrowser,
        isConnected: jest.fn(() => false),
      };
      (puppeteer.launch as jest.Mock).mockResolvedValue(unhealthyBrowser);

      const instance = await pool.acquireBrowser('session-123');
      
      const healthResults = pool.healthCheck();
      
      expect(healthResults.get(instance.id)).toBe(false);
    });

    it('should restart unhealthy browsers', async () => {
      const unhealthyBrowser = {
        ...mockBrowser,
        isConnected: jest.fn(() => false),
      };
      
      (puppeteer.launch as jest.Mock)
        .mockResolvedValueOnce(unhealthyBrowser)
        .mockResolvedValueOnce(mockBrowser); // New healthy browser

      const instance = await pool.acquireBrowser('session-123');
      pool.releaseBrowser(instance.id);
      
      // Perform health check which should trigger restart
      pool.healthCheck();
      
      expect(unhealthyBrowser.close).toHaveBeenCalled();
      expect(puppeteer.launch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Browser Recycling', () => {
    beforeEach(async () => {
      await pool.initialize();
      pool.configure({ recycleAfterUses: 3 });
    });

    it('should recycle browser after specified uses', async () => {
      let instance = await pool.acquireBrowser('session-1');
      const originalId = instance.id;
      
      // Use the browser 3 times
      for (let i = 0; i < 2; i++) {
        pool.releaseBrowser(instance.id);
        instance = await pool.acquireBrowser('session-1');
        expect(instance.useCount).toBe(i + 2);
      }

      // Release the browser after 3rd use - this should trigger recycling
      pool.releaseBrowser(instance.id);

      // Next acquisition should get a new browser
      const newInstance = await pool.acquireBrowser('session-new');
      expect(newInstance.id).not.toBe(originalId);
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should manually recycle a browser', async () => {
      const instance = await pool.acquireBrowser('session-123');
      pool.releaseBrowser(instance.id);
      
      await pool.recycleBrowser(instance.id);
      
      expect(mockBrowser.close).toHaveBeenCalled();
      const metrics = pool.getMetrics();
      expect(metrics.totalBrowsers).toBe(0);
    });
  });

  describe('Graceful Shutdown', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should shutdown gracefully', async () => {
      await pool.acquireBrowser('session-1');
      const instance2 = await pool.acquireBrowser('session-2');
      pool.releaseBrowser(instance2.id);

      await pool.shutdown();
      
      expect(mockBrowser.close).toHaveBeenCalledTimes(2);
      
      const metrics = pool.getMetrics();
      expect(metrics.totalBrowsers).toBe(0);
    });

    it('should force shutdown when requested', async () => {
      await pool.acquireBrowser('session-1'); // Keep active
      
      await pool.shutdown(true);
      
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should reject new acquisitions after shutdown', async () => {
      await pool.shutdown();
      
      await expect(pool.acquireBrowser('session-123')).rejects.toThrow(
        'Browser pool is shutting down'
      );
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should track browser lifecycle metrics', async () => {
      const instance = await pool.acquireBrowser('session-123');
      
      // Add a small delay to ensure measurable lifetime
      await new Promise<void>(resolve => { setTimeout(resolve, 10); });
      
      pool.releaseBrowser(instance.id);
      
      // Manually destroy the browser to test lifetime calculation
      await pool.recycleBrowser(instance.id);
      
      const metrics = pool.getMetrics();
      
      expect(metrics.browsersCreated).toBe(1);
      expect(metrics.browsersDestroyed).toBe(1);
      expect(metrics.avgBrowserLifetime).toBeGreaterThan(0);
    });

    it('should calculate utilization percentage', async () => {
      await pool.acquireBrowser('session-1');
      await pool.acquireBrowser('session-2');
      
      const metrics = pool.getMetrics();
      
      expect(metrics.utilizationPercentage).toBeCloseTo(66.67, 1); // 2/3 * 100
    });

    it('should track page counts', async () => {
      const instance = await pool.acquireBrowser('session-123');
      await pool.createPage(instance.id, 'session-123');
      await pool.createPage(instance.id, 'session-123');
      
      const metrics = pool.getMetrics();
      
      expect(metrics.totalPages).toBe(2);
      expect(metrics.activePages).toBe(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should handle browser launch failures', async () => {
      (puppeteer.launch as jest.Mock).mockRejectedValue(new Error('Launch failed'));

      await expect(pool.acquireBrowser('session-123')).rejects.toThrow('Launch failed');
      
      const metrics = pool.getMetrics();
      expect(metrics.totalBrowsers).toBe(0);
    });

    it('should handle page creation failures', async () => {
      mockBrowser.newPage.mockRejectedValue(new Error('Page creation failed'));

      const instance = await pool.acquireBrowser('session-123');
      
      await expect(pool.createPage(instance.id, 'session-123')).rejects.toThrow(
        'Page creation failed'
      );
    });

    it('should handle browser close failures gracefully', async () => {
      mockBrowser.close.mockRejectedValue(new Error('Close failed'));

      const instance = await pool.acquireBrowser('session-123');
      pool.releaseBrowser(instance.id);
      
      // Should not throw
      await expect(pool.recycleBrowser(instance.id)).resolves.not.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to close browser'
      );
    });

    it('should validate session IDs', async () => {
      const instance = await pool.acquireBrowser('session-123');
      
      // Try to release with wrong session ID
      await expect(pool.releaseBrowser(instance.id, 'wrong-session')).rejects.toThrow(
        'Unauthorized: Browser not acquired by this session'
      );
    });
  });

  describe('Browser Instance Helpers', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should get browser by ID', async () => {
      const instance = await pool.acquireBrowser('session-123');
      
      const retrieved = pool.getBrowser(instance.id);
      expect(retrieved).toBe(instance);
    });

    it('should list all browsers', async () => {
      await pool.acquireBrowser('session-1');
      await pool.acquireBrowser('session-2');
      
      const browsers = pool.listBrowsers();
      expect(browsers).toHaveLength(2);
    });

    it('should return undefined for non-existent browser', () => {
      const browser = pool.getBrowser('non-existent');
      expect(browser).toBeUndefined();
    });
  });
});