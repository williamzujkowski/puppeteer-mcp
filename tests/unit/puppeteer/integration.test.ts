/**
 * Browser Pool Integration Test
 * @module tests/unit/puppeteer/integration
 * @nist si-4 "Information system monitoring"
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
import { BrowserHealthChecker } from '../../../src/puppeteer/pool/browser-health-checker.js';
import type { BrowserPoolOptions } from '../../../src/puppeteer/interfaces/browser-pool.interface.js';

describe('Browser Pool Integration', () => {
  let pool: BrowserPool;
  let healthChecker: BrowserHealthChecker;
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
    healthChecker = new BrowserHealthChecker({
      maxMemoryMB: 512,
      maxPageCount: 5,
      responseTimeout: 5000,
      checkInterval: 10000,
    });
  });

  afterEach(async () => {
    await pool.shutdown(true);
  });

  it('should integrate browser pool with health checker', async () => {
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

    // Check health using the health checker
    const healthResult = await healthChecker.checkHealth(instance);
    expect(healthResult.isHealthy).toBe(true);
    expect(healthResult.connectionHealthy).toBe(true);
    expect(healthResult.responsive).toBe(true);
    expect(healthResult.memoryHealthy).toBe(true);
    expect(healthResult.pageCountHealthy).toBe(true);

    // Check metrics
    const metrics = pool.getMetrics();
    expect(metrics.totalBrowsers).toBe(1);
    expect(metrics.activeBrowsers).toBe(1);
    expect(metrics.totalPages).toBe(2);

    // Release browser
    await pool.releaseBrowser(instance.id, 'session-1');

    const metricsAfterRelease = pool.getMetrics();
    expect(metricsAfterRelease.activeBrowsers).toBe(0);
    expect(metricsAfterRelease.idleBrowsers).toBe(1);
  });

  it('should handle unhealthy browsers with health checker', async () => {
    await pool.initialize();

    // Create an unhealthy browser
    const unhealthyBrowser = {
      ...mockBrowser,
      isConnected: jest.fn(() => false),
    };
    
    const puppeteer = await import('puppeteer');
    (puppeteer.launch as jest.Mock).mockResolvedValueOnce(unhealthyBrowser);

    const instance = await pool.acquireBrowser('session-1');
    
    // Check health - should detect as unhealthy
    const healthResult = await healthChecker.checkHealth(instance);
    expect(healthResult.isHealthy).toBe(false);
    expect(healthResult.connectionHealthy).toBe(false);
    expect(healthResult.reason).toContain('Browser disconnected');
  });

  it('should demonstrate auto-recovery functionality', async () => {
    await pool.initialize();

    // Create browser with auto-recovery enabled
    const recoveryChecker = new BrowserHealthChecker({
      maxMemoryMB: 512,
      maxPageCount: 5,
      responseTimeout: 5000,
      checkInterval: 10000,
      enableAutoRecovery: true,
    });

    const unhealthyBrowser = {
      ...mockBrowser,
      isConnected: jest.fn(() => false),
    };
    
    const puppeteer = await import('puppeteer');
    (puppeteer.launch as jest.Mock)
      .mockResolvedValueOnce(unhealthyBrowser)
      .mockResolvedValueOnce(mockBrowser); // Recovery browser

    const instance = await pool.acquireBrowser('session-1');
    
    // Test auto-recovery
    const recoveryResult = await recoveryChecker.checkAndRecover(
      instance,
      options.launchOptions
    );
    
    expect(recoveryResult.recovered).toBe(true);
    expect(recoveryResult.newBrowser).toBe(mockBrowser);
    expect(recoveryResult.health.isHealthy).toBe(false);
  });

  it('should handle multiple browsers with batch health checks', async () => {
    await pool.initialize();

    // Acquire multiple browsers
    const instance1 = await pool.acquireBrowser('session-1');
    const instance2 = await pool.acquireBrowser('session-2');

    expect(instance1.id).not.toBe(instance2.id);

    // Perform batch health checks
    const instances = [instance1, instance2];
    const healthResults = await healthChecker.checkMultiple(instances);

    expect(healthResults.size).toBe(2);
    expect(healthResults.get(instance1.id)?.isHealthy).toBe(true);
    expect(healthResults.get(instance2.id)?.isHealthy).toBe(true);

    // Check pool metrics
    const metrics = pool.getMetrics();
    expect(metrics.totalBrowsers).toBe(2);
    expect(metrics.activeBrowsers).toBe(2);
    expect(metrics.utilizationPercentage).toBe(100); // 2/2 * 100
  });

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
    const initialHealth = await healthChecker.checkHealth(instance);
    expect(initialHealth.isHealthy).toBe(true);
    expect(initialHealth.metrics.pageCount).toBe(3);
    
    // Add small delay for lifetime calculation
    await new Promise<void>(resolve => { setTimeout(resolve, 10); });
    
    // Release and recycle
    await pool.releaseBrowser(instance.id, 'session-test');
    await pool.recycleBrowser(instance.id);
    
    // Check final metrics
    const finalMetrics = pool.getMetrics();
    expect(finalMetrics.browsersCreated).toBe(1);
    expect(finalMetrics.browsersDestroyed).toBe(1);
    expect(finalMetrics.avgBrowserLifetime).toBeGreaterThan(0);
    expect(finalMetrics.totalBrowsers).toBe(0);
  });
});