/**
 * Browser Health Checker Unit Tests
 * @module tests/unit/puppeteer/browser-health-checker
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

// Mock modules
jest.mock('../../../src/utils/logger.js', () => ({
  createLogger: jest.fn(() => mockLogger),
}));

jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

// Import modules
import { BrowserHealthChecker } from '../../../src/puppeteer/pool/browser-health-checker.js';
import type { BrowserInstance } from '../../../src/puppeteer/interfaces/browser-pool.interface.js';
import * as puppeteer from 'puppeteer';

describe('BrowserHealthChecker', () => {
  let healthChecker: BrowserHealthChecker;
  let mockBrowser: jest.Mocked<Browser>;
  let mockPage: jest.Mocked<Page>;
  let mockInstance: BrowserInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock page with default successful responses
    mockPage = {
      close: jest.fn(),
      url: jest.fn(() => 'about:blank'),
      goto: jest.fn(),
      evaluate: jest.fn().mockResolvedValue(42), // Default: responsive
      metrics: jest.fn().mockResolvedValue({
        JSHeapUsedSize: 100 * 1024 * 1024, // 100MB - normal usage
        JSHeapTotalSize: 200 * 1024 * 1024,
      }),
    } as unknown as jest.Mocked<Page>;

    // Setup mock browser with default healthy responses
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
      pages: jest.fn().mockResolvedValue([mockPage]), // Single page - normal count
      process: jest.fn(() => ({ pid: 12345 })),
      isConnected: jest.fn(() => true), // Default: connected
      on: jest.fn(),
      off: jest.fn(),
    } as unknown as jest.Mocked<Browser>;

    // Setup mock instance
    mockInstance = {
      id: 'browser-123',
      browser: mockBrowser,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 10,
      pageCount: 1,
      pid: 12345,
    };

    healthChecker = new BrowserHealthChecker({
      maxMemoryMB: 512,
      maxPageCount: 10,
      responseTimeout: 1000, // Shorter timeout for tests
      checkInterval: 10000,
    });
  });

  describe('Connection Health', () => {
    it('should detect healthy browser connection', async () => {
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.isHealthy).toBe(true);
      expect(result.connectionHealthy).toBe(true);
      expect(mockBrowser.isConnected as jest.Mock).toHaveBeenCalled();
    });

    it('should detect disconnected browser', async () => {
      mockBrowser.isConnected.mockReturnValue(false);
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.isHealthy).toBe(false);
      expect(result.connectionHealthy).toBe(false);
      expect(result.reason).toContain('Browser disconnected');
    });

    it('should handle browser without process', async () => {
      mockBrowser.process.mockReturnValue(null);
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.isHealthy).toBe(false);
      expect(result.reason).toContain('Browser process not found');
    });
  });

  describe('Responsiveness Check', () => {
    it('should detect responsive browser', async () => {
      mockPage.evaluate.mockResolvedValue(42);
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.isHealthy).toBe(true);
      expect(result.responsive).toBe(true);
      expect(mockPage.evaluate as jest.Mock).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should detect unresponsive browser', async () => {
      // Mock a long-running promise that exceeds the timeout
      mockPage.evaluate.mockImplementation(() => 
        new Promise(resolve => { setTimeout(resolve, 2000); }) // Longer than 1000ms timeout
      );
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.isHealthy).toBe(false);
      expect(result.responsive).toBe(false);
      expect(result.reason).toContain('Browser unresponsive');
    }, 10000); // Increase test timeout

    it('should handle evaluation errors', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Evaluation failed'));
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.isHealthy).toBe(false);
      expect(result.responsive).toBe(false);
      expect(result.reason).toContain('Browser unresponsive');
    });
  });

  describe('Memory Usage Check', () => {
    it('should detect normal memory usage', async () => {
      mockPage.metrics.mockResolvedValue({
        JSHeapUsedSize: 100 * 1024 * 1024, // 100MB
        JSHeapTotalSize: 200 * 1024 * 1024,
      } as any);
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.isHealthy).toBe(true);
      expect(result.memoryHealthy).toBe(true);
      expect(result.metrics.memoryUsageMB).toBeCloseTo(100, 1);
    });

    it('should detect excessive memory usage', async () => {
      mockPage.metrics.mockResolvedValue({
        JSHeapUsedSize: 600 * 1024 * 1024, // 600MB
        JSHeapTotalSize: 800 * 1024 * 1024,
      } as any);
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.isHealthy).toBe(false);
      expect(result.memoryHealthy).toBe(false);
      expect(result.reason).toContain('Excessive memory usage');
      expect(result.metrics.memoryUsageMB).toBeCloseTo(600, 1);
    });

    it('should handle memory check failures', async () => {
      mockPage.metrics.mockRejectedValue(new Error('Metrics failed'));
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      // Should still be healthy if only metrics fail
      expect(result.isHealthy).toBe(true);
      expect(result.memoryHealthy).toBe(true);
      expect(result.metrics.memoryUsageMB).toBe(0);
    });
  });

  describe('Page Count Check', () => {
    it('should detect normal page count', async () => {
      mockBrowser.pages.mockResolvedValue([mockPage, mockPage, mockPage]);
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.isHealthy).toBe(true);
      expect(result.pageCountHealthy).toBe(true);
      expect(result.metrics.pageCount).toBe(3);
    });

    it('should detect excessive page count', async () => {
      const pages = Array(15).fill(mockPage);
      mockBrowser.pages.mockResolvedValue(pages);
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.isHealthy).toBe(false);
      expect(result.pageCountHealthy).toBe(false);
      expect(result.reason).toContain('Too many pages');
      expect(result.metrics.pageCount).toBe(15);
    });
  });

  describe('Restart Functionality', () => {
    it('should restart unhealthy browser', async () => {
      const newBrowser = { ...mockBrowser };
      (puppeteer.launch as jest.Mock).mockResolvedValue(newBrowser);
      
      mockBrowser.isConnected.mockReturnValue(false);
      
      const launchOptions = { headless: true };
      const result = await healthChecker.restartBrowser(mockInstance, launchOptions);
      
      expect(mockBrowser.close as jest.Mock).toHaveBeenCalled();
      expect(puppeteer.launch).toHaveBeenCalledWith(launchOptions);
      expect(result).toBe(newBrowser);
    });

    it('should handle restart failures', async () => {
      (puppeteer.launch as jest.Mock).mockRejectedValue(new Error('Launch failed'));
      
      const launchOptions = { headless: true };
      
      await expect(healthChecker.restartBrowser(mockInstance, launchOptions))
        .rejects.toThrow('Launch failed');
      
      expect(mockBrowser.close as jest.Mock).toHaveBeenCalled();
    });

    it('should handle close failures during restart', async () => {
      const newBrowser = { ...mockBrowser };
      (puppeteer.launch as jest.Mock).mockResolvedValue(newBrowser);
      
      mockBrowser.close.mockRejectedValue(new Error('Close failed'));
      
      const launchOptions = { headless: true };
      const result = await healthChecker.restartBrowser(mockInstance, launchOptions);
      
      // Should still launch new browser
      expect(result).toBe(newBrowser);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        'Failed to close unhealthy browser'
      );
    });
  });

  describe('Metrics Collection', () => {
    it('should collect comprehensive metrics', async () => {
      mockPage.metrics.mockResolvedValue({
        JSHeapUsedSize: 100 * 1024 * 1024,
        JSHeapTotalSize: 200 * 1024 * 1024,
        Timestamp: Date.now(),
      } as any);
      
      mockBrowser.pages.mockResolvedValue([mockPage, mockPage]);
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.metrics).toEqual({
        memoryUsageMB: expect.any(Number),
        pageCount: 2,
        useCount: 10,
        uptime: expect.any(Number),
        lastChecked: expect.any(Date),
      });
    });

    it('should calculate uptime correctly', async () => {
      const createdAt = new Date(Date.now() - 60000); // 1 minute ago
      mockInstance.createdAt = createdAt;
      
      const result = await healthChecker.checkHealth(mockInstance);
      
      expect(result.metrics.uptime).toBeGreaterThanOrEqual(59000);
      expect(result.metrics.uptime).toBeLessThanOrEqual(61000);
    });
  });

  describe('Batch Health Checks', () => {
    it('should check multiple browsers', async () => {
      const instances = [
        mockInstance,
        { ...mockInstance, id: 'browser-456' },
        { ...mockInstance, id: 'browser-789' },
      ];
      
      const results = await healthChecker.checkMultiple(instances);
      
      expect(results.size).toBe(3);
      expect(results.get('browser-123')).toBeDefined();
      expect(results.get('browser-456')).toBeDefined();
      expect(results.get('browser-789')).toBeDefined();
    });

    it('should handle failures in batch checks', async () => {
      const healthyInstance = mockInstance;
      const unhealthyBrowser = {
        ...mockBrowser,
        isConnected: jest.fn(() => false),
      };
      const unhealthyInstance = {
        ...mockInstance,
        id: 'browser-456',
        browser: unhealthyBrowser,
      };
      
      const results = await healthChecker.checkMultiple([
        healthyInstance,
        unhealthyInstance,
      ]);
      
      expect(results.get('browser-123')?.isHealthy).toBe(true);
      expect(results.get('browser-456')?.isHealthy).toBe(false);
    });
  });

  describe('Auto-Recovery', () => {
    it('should perform auto-recovery when enabled', async () => {
      const newBrowser = { ...mockBrowser };
      (puppeteer.launch as jest.Mock).mockResolvedValue(newBrowser);
      
      healthChecker = new BrowserHealthChecker({
        maxMemoryMB: 512,
        maxPageCount: 10,
        responseTimeout: 5000,
        checkInterval: 10000,
        enableAutoRecovery: true,
      });
      
      mockBrowser.isConnected.mockReturnValue(false);
      
      const launchOptions = { headless: true };
      const result = await healthChecker.checkAndRecover(mockInstance, launchOptions);
      
      expect(result.recovered).toBe(true);
      expect(result.newBrowser).toBe(newBrowser);
      expect(puppeteer.launch).toHaveBeenCalled();
    });

    it('should not recover healthy browsers', async () => {
      healthChecker = new BrowserHealthChecker({
        maxMemoryMB: 512,
        maxPageCount: 10,
        responseTimeout: 5000,
        checkInterval: 10000,
        enableAutoRecovery: true,
      });
      
      const result = await healthChecker.checkAndRecover(mockInstance, {});
      
      expect(result.recovered).toBe(false);
      expect(result.newBrowser).toBeUndefined();
    });

    it('should respect auto-recovery disabled setting', async () => {
      mockBrowser.isConnected.mockReturnValue(false);
      
      const result = await healthChecker.checkAndRecover(mockInstance, {});
      
      expect(result.recovered).toBe(false);
      expect(result.health.isHealthy).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      healthChecker.updateConfig({
        maxMemoryMB: 1024,
        responseTimeout: 10000,
      });
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ 
          maxMemoryMB: 1024,
          responseTimeout: 10000,
        }),
        'Health checker configuration updated'
      );
    });

    it('should validate configuration values', () => {
      expect(() => {
        healthChecker.updateConfig({ maxMemoryMB: -1 });
      }).toThrow('Invalid configuration: maxMemoryMB must be positive');
      
      expect(() => {
        healthChecker.updateConfig({ maxPageCount: 0 });
      }).toThrow('Invalid configuration: maxPageCount must be positive');
      
      expect(() => {
        healthChecker.updateConfig({ responseTimeout: -1000 });
      }).toThrow('Invalid configuration: responseTimeout must be positive');
    });
  });
});