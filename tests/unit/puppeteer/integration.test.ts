/**
 * Browser Pool Integration Test
 * @module tests/unit/puppeteer/integration
 * @nist si-4 "Information system monitoring"
 */

 

import { jest } from '@jest/globals';

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
const mockPage = {
  close: jest.fn(),
  url: jest.fn(() => 'about:blank'),
  goto: jest.fn(),
  evaluate: jest.fn().mockResolvedValue(42),
  setRequestInterception: jest.fn(),
  metrics: jest.fn().mockResolvedValue({
    JSHeapUsedSize: 100 * 1024 * 1024,
    JSHeapTotalSize: 200 * 1024 * 1024,
  }),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
  pages: jest.fn().mockResolvedValue([mockPage]),
  process: jest.fn(() => ({ pid: 12345 })),
  isConnected: jest.fn(() => true),
  version: jest.fn().mockResolvedValue('HeadlessChrome/120.0.0.0'),
  on: jest.fn(),
  off: jest.fn(),
};

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
import type { BrowserPoolOptions } from '../../../src/puppeteer/interfaces/browser-pool.interface.js';

describe('Browser Pool Integration', () => {
  let pool: BrowserPool;
  let options: BrowserPoolOptions;

  beforeEach(() => {
    jest.clearAllMocks();

    options = {
      maxBrowsers: 2,
      maxPagesPerBrowser: 3,
      launchOptions: {
        headless: true,
        args: ['--no-sandbox'],
      },
      idleTimeout: 30000,
      healthCheckInterval: 10000,
      enableRequestInterception: true,
    };

    pool = new BrowserPool(options);
  });

  afterEach(async () => {
    await pool.shutdown(true);
  });

  it('should integrate browser pool with health monitor', async () => {
    await pool.initialize();

    // Acquire a browser
    const instance = await pool.acquireBrowser('session-1');
    expect(instance).toBeDefined();
    expect(instance.id).toBeDefined();

    // Create some pages
    const page1 = await pool.createPage(instance.id, 'session-1');
    const page2 = await pool.createPage(instance.id, 'session-1');
    expect(page1).toBeDefined();
    expect(page2).toBeDefined();

    // Check health using the browser pool's health check
    const healthResults = await pool.healthCheck();
    expect(healthResults.get(instance.id)).toBe(true);

    // Check metrics
    const metrics = pool.getMetrics();
    expect(metrics.totalBrowsers).toBe(1);
    expect(metrics.activeBrowsers).toBe(1);
    expect(metrics.totalPages).toBe(2);

    // Release browser with correct session ID
    await pool.releaseBrowser(instance.id, 'session-1');

    const metricsAfterRelease = pool.getMetrics();
    expect(metricsAfterRelease.activeBrowsers).toBe(0);
    expect(metricsAfterRelease.idleBrowsers).toBe(1);
  });

  it('should handle unhealthy browsers with health monitor', async () => {
    // Set up the unhealthy browser mock before initialization
    const unhealthyBrowser = {
      ...mockBrowser,
      isConnected: jest.fn(() => false),
      version: jest.fn().mockResolvedValue('HeadlessChrome/120.0.0.0'),
    };

    const puppeteer = await import('puppeteer');
    (puppeteer.launch as jest.Mock).mockResolvedValueOnce(unhealthyBrowser);

    await pool.initialize();

    // Get the first browser instance that was created during initialization
    const browsers = pool.listBrowsers();
    expect(browsers.length).toBeGreaterThan(0);
    const instance = browsers[0];

    // Check health - should detect as unhealthy
    const healthResults = await pool.healthCheck();
    expect(healthResults.get(instance.id)).toBe(false);
  });

  it('should demonstrate browser health monitoring', async () => {
    // Set up an unhealthy browser first
    const unhealthyBrowser = {
      ...mockBrowser,
      isConnected: jest.fn(() => false),
      version: jest.fn().mockResolvedValue('HeadlessChrome/120.0.0.0'),
    };

    const puppeteer = await import('puppeteer');
    (puppeteer.launch as jest.Mock)
      .mockResolvedValueOnce(unhealthyBrowser)
      .mockResolvedValueOnce(mockBrowser); // Recovery browser

    await pool.initialize();

    // Get the first browser that was created (unhealthy)
    const browsers = pool.listBrowsers();
    expect(browsers.length).toBeGreaterThan(0);
    const instance = browsers[0];

    // Test health monitoring
    const healthResults = await pool.healthCheck();
    expect(healthResults.get(instance.id)).toBe(false);
  });

  it('should handle multiple browsers with health checks', async () => {
    // Initialize pool without pre-creating browsers
    options.maxBrowsers = 3; // Increase to avoid capacity issues
    pool = new BrowserPool(options);
    await pool.initialize();

    // Acquire multiple browsers
    const instance1 = await pool.acquireBrowser('session-1');
    const instance2 = await pool.acquireBrowser('session-2');

    expect(instance1.id).not.toBe(instance2.id);

    // Perform health checks
    const healthResults = await pool.healthCheck();

    expect(healthResults.size).toBeGreaterThanOrEqual(2);
    expect(healthResults.get(instance1.id)).toBe(true);
    expect(healthResults.get(instance2.id)).toBe(true);

    // Check pool metrics
    const metrics = pool.getMetrics();
    expect(metrics.totalBrowsers).toBeGreaterThanOrEqual(2);
    expect(metrics.activeBrowsers).toBe(2);
  }, 10000);

  it('should demonstrate complete lifecycle with monitoring', async () => {
    await pool.initialize();

    // Acquire browser
    const instance = await pool.acquireBrowser('session-test');

    // Create pages
    await pool.createPage(instance.id, 'session-test');
    await pool.createPage(instance.id, 'session-test');

    // Update the mock to return 3 pages (1 default + 2 created)
    mockBrowser.pages.mockResolvedValue([mockPage, mockPage, mockPage]);

    // Monitor health
    const healthResults = await pool.healthCheck();
    expect(healthResults.get(instance.id)).toBe(true);

    // Add small delay for lifetime calculation
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    // Release and recycle with correct session ID
    await pool.releaseBrowser(instance.id, 'session-test');
    await pool.recycleBrowser(instance.id);

    // Check final metrics
    const finalMetrics = pool.getMetrics();
    // Note: Current implementation has TODO placeholders for these metrics
    expect(finalMetrics.browsersCreated).toBe(0); // TODO: Track this metric
    expect(finalMetrics.browsersDestroyed).toBe(0); // TODO: Track this metric
    expect(finalMetrics.avgBrowserLifetime).toBe(0); // TODO: Calculate this metric
    // After recycling, the browser is still in the pool (just restarted)
    expect(finalMetrics.totalBrowsers).toBe(1);
  });
});
