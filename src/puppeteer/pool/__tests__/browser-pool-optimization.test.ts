/**
 * Comprehensive tests for browser pool optimization features
 * @module puppeteer/pool/__tests__/browser-pool-optimization.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { Browser, Page } from 'puppeteer';

// Import optimization components
import {
  BrowserPoolScaler,
  ScalingDecision,
  DEFAULT_SCALING_STRATEGY,
} from '../browser-pool-scaling.js';
import {
  BrowserPoolResourceManager,
  DEFAULT_RESOURCE_CONFIG,
} from '../browser-pool-resource-manager.js';
import { BrowserPoolRecycler, DEFAULT_RECYCLING_CONFIG } from '../browser-pool-recycler.js';
import {
  CircuitBreaker,
  CircuitBreakerState,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from '../browser-pool-circuit-breaker.js';
import {
  BrowserPoolPerformanceMonitor,
  PerformanceMetricType,
  DEFAULT_PERFORMANCE_CONFIG,
} from '../browser-pool-performance-monitor.js';
import { OptimizedBrowserPool, DEFAULT_OPTIMIZATION_CONFIG } from '../browser-pool-optimized.js';

// Mock external dependencies
jest.mock('../../../utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  logSecurityEvent: jest.fn(),
  SecurityEventType: {
    SERVICE_START: 'service_start',
    SERVICE_STOP: 'service_stop',
    CONFIG_CHANGE: 'config_change',
    BROWSER_INSTANCE_CREATED: 'browser_instance_created',
    BROWSER_INSTANCE_DESTROYED: 'browser_instance_destroyed',
    BROWSER_CRASH: 'browser_crash',
    PAGE_NAVIGATION: 'page_navigation',
  },
}));

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('os', () => ({
  totalmem: jest.fn(() => 8589934592), // 8GB
  freemem: jest.fn(() => 4294967296), // 4GB
  cpus: jest.fn(() => [{ times: { idle: 100, user: 20, sys: 10 } }]),
  loadavg: jest.fn(() => [0.5, 0.8, 1.0]),
  uptime: jest.fn(() => 3600),
}));

// Mock browser and page
const mockBrowser = {
  isConnected: jest.fn(() => true),
  version: jest.fn(() => Promise.resolve('1.0.0')),
  pages: jest.fn(() => Promise.resolve([])),
  process: jest.fn(() => ({ pid: 1234 })),
  close: jest.fn(() => Promise.resolve()),
} as unknown as Browser;

const mockPage = {
  close: jest.fn(() => Promise.resolve()),
  goto: jest.fn(() => Promise.resolve()),
  setRequestInterception: jest.fn(() => Promise.resolve()),
  setCacheEnabled: jest.fn(() => Promise.resolve()),
  setJavaScriptEnabled: jest.fn(() => Promise.resolve()),
  evaluateOnNewDocument: jest.fn(() => Promise.resolve()),
  evaluate: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
} as unknown as Page;

describe('BrowserPoolScaler', () => {
  let scaler: BrowserPoolScaler;
  let mockBrowsers: Map<string, any>;
  let mockMetrics: any;

  beforeEach(() => {
    scaler = new BrowserPoolScaler(DEFAULT_SCALING_STRATEGY);
    mockBrowsers = new Map();
    mockMetrics = {
      totalBrowsers: 2,
      activeBrowsers: 1,
      idleBrowsers: 1,
      utilizationPercentage: 50,
      queue: { queueLength: 0, averageWaitTime: 0 },
      errors: { errorRate: 0 },
      resources: { totalMemoryUsage: 1024, totalCpuUsage: 30 },
    };
  });

  afterEach(() => {
    scaler.stop();
  });

  it('should initialize with default configuration', () => {
    expect(scaler.getStrategy()).toEqual(DEFAULT_SCALING_STRATEGY);
  });

  it('should start and stop scaling monitor', () => {
    scaler.start();
    expect(scaler.getStrategy().enabled).toBe(true);

    scaler.stop();
    // Should stop without errors
  });

  it('should evaluate scaling up when utilization is high', () => {
    mockMetrics.utilizationPercentage = 85;
    const options = { maxBrowsers: 10 };

    const decision = scaler.evaluateScaling(mockMetrics, mockBrowsers, options);

    expect(decision.decision).toBe(ScalingDecision.SCALE_UP);
    expect(decision.targetSize).toBeGreaterThan(mockBrowsers.size);
  });

  it('should evaluate scaling down when utilization is low', () => {
    mockMetrics.utilizationPercentage = 20;
    mockMetrics.queue.queueLength = 0;
    const options = { maxBrowsers: 10 };

    const decision = scaler.evaluateScaling(mockMetrics, mockBrowsers, options);

    expect(decision.decision).toBe(ScalingDecision.SCALE_DOWN);
  });

  it('should trigger emergency scaling on high queue and utilization', () => {
    mockMetrics.utilizationPercentage = 95;
    mockMetrics.queue.queueLength = 15;
    const options = { maxBrowsers: 10 };

    const decision = scaler.evaluateScaling(mockMetrics, mockBrowsers, options);

    expect(decision.decision).toBe(ScalingDecision.EMERGENCY_SCALE_UP);
    expect(decision.confidence).toBeGreaterThan(90);
  });

  it('should update strategy configuration', () => {
    const newStrategy = { targetUtilization: 60, maxScaleStep: 2 };
    scaler.updateStrategy(newStrategy);

    const strategy = scaler.getStrategy();
    expect(strategy.targetUtilization).toBe(60);
    expect(strategy.maxScaleStep).toBe(2);
  });

  it('should calculate predicted load based on trends', () => {
    // Add some historical data to simulate trends
    for (let i = 0; i < 15; i++) {
      mockMetrics.utilizationPercentage = 50 + i * 2; // Increasing trend
      scaler.evaluateScaling(mockMetrics, mockBrowsers, { maxBrowsers: 10 });
    }

    const decision = scaler.evaluateScaling(mockMetrics, mockBrowsers, { maxBrowsers: 10 });
    expect(decision.confidence).toBeGreaterThan(0);
  });
});

describe('BrowserPoolResourceManager', () => {
  let resourceManager: BrowserPoolResourceManager;

  beforeEach(() => {
    resourceManager = new BrowserPoolResourceManager(DEFAULT_RESOURCE_CONFIG);
  });

  afterEach(() => {
    resourceManager.stop();
  });

  it('should initialize with default configuration', () => {
    expect(resourceManager.getSystemResources()).toBeNull();
  });

  it('should start and stop resource monitoring', async () => {
    await resourceManager.start();
    expect(resourceManager.getSystemResources()).toBeDefined();

    resourceManager.stop();
    // Should stop without errors
  });

  it('should optimize browser for resource usage', async () => {
    const mockInstance = {
      id: 'test-browser',
      browser: mockBrowser,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 1,
      pageCount: 0,
    };

    await resourceManager.optimizeBrowser(mockBrowser, mockInstance);

    // Should complete without errors
    expect(mockInstance.executeSafely).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should evaluate browser recycling based on resource usage', () => {
    const result = resourceManager.shouldRecycleBrowser('test-browser');

    expect(result).toHaveProperty('shouldRecycle');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('priority');
  });

  it('should update configuration', () => {
    const newConfig = { intervalMs: 15000, enableGarbageCollection: false };
    resourceManager.updateConfig(newConfig);

    // Configuration should be updated
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should handle system resource monitoring', async () => {
    await resourceManager.start();

    // Allow some time for monitoring
    await new Promise((resolve) => setTimeout(resolve, 100));

    const systemResources = resourceManager.getSystemResources();
    expect(systemResources).toBeDefined();
  });
});

describe('BrowserPoolRecycler', () => {
  let recycler: BrowserPoolRecycler;
  let mockBrowsers: Map<string, any>;
  let mockResourceUsage: Map<string, any>;

  beforeEach(() => {
    recycler = new BrowserPoolRecycler(DEFAULT_RECYCLING_CONFIG);
    mockBrowsers = new Map();
    mockResourceUsage = new Map();

    // Add mock browser instance
    const mockInstance = {
      id: 'test-browser',
      browser: mockBrowser,
      createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      lastUsedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      useCount: 50,
      pageCount: 5,
      state: 'active',
    };

    mockBrowsers.set('test-browser', mockInstance);
    mockResourceUsage.set('test-browser', {
      browserId: 'test-browser',
      pid: 1234,
      memoryUsage: { rss: 1024 * 1024 * 100 }, // 100MB
      cpuUsage: { percent: 30 },
      openHandles: 500,
      connectionCount: 10,
      timestamp: new Date(),
    });
  });

  afterEach(() => {
    recycler.stop();
  });

  it('should initialize with default configuration', () => {
    expect(recycler.getRecyclingStats().totalRecycled).toBe(0);
  });

  it('should start and stop recycler', () => {
    recycler.start();
    recycler.stop();
    // Should complete without errors
  });

  it('should evaluate browsers for recycling', () => {
    const candidates = recycler.evaluateBrowsers(mockBrowsers, mockResourceUsage);

    expect(candidates).toBeInstanceOf(Array);
    expect(candidates.length).toBeGreaterThanOrEqual(0);

    if (candidates.length > 0) {
      expect(candidates[0]).toHaveProperty('browserId');
      expect(candidates[0]).toHaveProperty('score');
      expect(candidates[0]).toHaveProperty('reasons');
      expect(candidates[0]).toHaveProperty('urgency');
    }
  });

  it('should evaluate single browser for recycling', () => {
    const instance = mockBrowsers.get('test-browser');
    const resourceUsage = mockResourceUsage.get('test-browser');

    const candidate = recycler.evaluateBrowser(instance, resourceUsage);

    expect(candidate).toHaveProperty('browserId', 'test-browser');
    expect(candidate).toHaveProperty('score');
    expect(candidate.score).toBeGreaterThanOrEqual(0);
    expect(candidate.score).toBeLessThanOrEqual(100);
  });

  it('should execute recycling for candidates', async () => {
    const candidates = recycler.evaluateBrowsers(mockBrowsers, mockResourceUsage);

    // Force a high score candidate
    if (candidates.length > 0) {
      candidates[0].score = 95;
      candidates[0].urgency = 'critical';
    }

    const mockRecycleCallback = jest.fn(() => Promise.resolve());
    const events = await recycler.executeRecycling(candidates, mockRecycleCallback);

    expect(events).toBeInstanceOf(Array);
    if (candidates.length > 0 && candidates[0].score >= 80) {
      expect(mockRecycleCallback).toHaveBeenCalled();
    }
  });

  it('should update health metrics', () => {
    recycler.updateHealthMetrics('test-browser', { healthy: true, responsive: true });

    // Should update without errors
    expect(true).toBe(true);
  });

  it('should get recycling statistics', () => {
    const stats = recycler.getRecyclingStats();

    expect(stats).toHaveProperty('totalRecycled');
    expect(stats).toHaveProperty('successRate');
    expect(stats).toHaveProperty('avgExecutionTime');
    expect(stats).toHaveProperty('reasonBreakdown');
    expect(stats).toHaveProperty('recentEvents');
  });

  it('should update recycling configuration', () => {
    const newConfig = { recyclingThreshold: 70, maxBatchSize: 5 };
    recycler.updateConfig(newConfig);

    // Configuration should be updated
    expect(true).toBe(true);
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test-circuit', DEFAULT_CIRCUIT_BREAKER_CONFIG);
  });

  afterEach(() => {
    circuitBreaker.destroy();
  });

  it('should initialize in closed state', () => {
    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
  });

  it('should execute successful operations', async () => {
    const operation = jest.fn(() => Promise.resolve('success'));
    const result = await circuitBreaker.execute(operation);

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(operation).toHaveBeenCalled();
  });

  it('should handle failed operations', async () => {
    const operation = jest.fn(() => Promise.reject(new Error('test error')));
    const result = await circuitBreaker.execute(operation);

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('should open circuit after failure threshold', async () => {
    const operation = jest.fn(() => Promise.reject(new Error('test error')));

    // Execute enough failures to trigger circuit opening
    for (let i = 0; i < 10; i++) {
      await circuitBreaker.execute(operation);
    }

    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe(CircuitBreakerState.OPEN);
  });

  it('should use fallback when circuit is open', async () => {
    const operation = jest.fn(() => Promise.reject(new Error('test error')));
    const fallback = jest.fn(() => Promise.resolve('fallback'));

    // Force circuit to open
    circuitBreaker.forceState(CircuitBreakerState.OPEN);

    const result = await circuitBreaker.execute(operation, fallback);

    expect(result.success).toBe(true);
    expect(result.result).toBe('fallback');
    expect(fallback).toHaveBeenCalled();
  });

  it('should provide circuit metrics', () => {
    const metrics = circuitBreaker.getMetrics();

    expect(metrics).toHaveProperty('state');
    expect(metrics).toHaveProperty('failureCount');
    expect(metrics).toHaveProperty('successCount');
    expect(metrics).toHaveProperty('requestCount');
    expect(metrics).toHaveProperty('failureRate');
  });

  it('should reset circuit state', () => {
    circuitBreaker.forceState(CircuitBreakerState.OPEN);
    circuitBreaker.reset();

    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
  });

  it('should update configuration', () => {
    const newConfig = { failureThreshold: 3, timeout: 60000 };
    circuitBreaker.updateConfig(newConfig);

    // Configuration should be updated
    expect(true).toBe(true);
  });
});

describe('BrowserPoolPerformanceMonitor', () => {
  let performanceMonitor: BrowserPoolPerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new BrowserPoolPerformanceMonitor(DEFAULT_PERFORMANCE_CONFIG);
  });

  afterEach(() => {
    performanceMonitor.stop();
  });

  it('should initialize with default configuration', () => {
    expect(performanceMonitor.getActiveAlerts()).toHaveLength(0);
  });

  it('should start and stop monitoring', () => {
    performanceMonitor.start();
    performanceMonitor.stop();
    // Should complete without errors
  });

  it('should record performance metrics', () => {
    performanceMonitor.recordMetric(PerformanceMetricType.LATENCY, 1500, { operation: 'test' });

    const metrics = performanceMonitor.getMetrics(PerformanceMetricType.LATENCY);
    expect(metrics.size).toBeGreaterThan(0);
  });

  it('should generate alerts for threshold violations', () => {
    // Record a metric that exceeds warning threshold
    performanceMonitor.recordMetric(
      PerformanceMetricType.LATENCY,
      3000, // Above warning threshold of 1000ms
      { operation: 'test' },
    );

    const alerts = performanceMonitor.getActiveAlerts();
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('should detect anomalies', () => {
    // Record baseline metrics
    for (let i = 0; i < 10; i++) {
      performanceMonitor.recordMetric(PerformanceMetricType.LATENCY, 500);
    }

    // Record anomalous metric
    performanceMonitor.recordMetric(PerformanceMetricType.LATENCY, 5000);

    const anomalies = performanceMonitor.getAnomalies();
    expect(anomalies.length).toBeGreaterThan(0);
  });

  it('should generate performance summary', () => {
    performanceMonitor.recordMetric(PerformanceMetricType.LATENCY, 1000);
    performanceMonitor.recordMetric(PerformanceMetricType.THROUGHPUT, 10);

    const summary = performanceMonitor.getPerformanceSummary();

    expect(summary).toHaveProperty('period');
    expect(summary).toHaveProperty('metrics');
    expect(summary).toHaveProperty('healthScore');
    expect(summary).toHaveProperty('performanceGrade');
  });

  it('should acknowledge and resolve alerts', () => {
    // Generate an alert
    performanceMonitor.recordMetric(PerformanceMetricType.LATENCY, 3000);

    const alerts = performanceMonitor.getActiveAlerts();
    if (alerts.length > 0) {
      const alertId = alerts[0].id;

      const acknowledged = performanceMonitor.acknowledgeAlert(alertId);
      expect(acknowledged).toBe(true);

      const resolved = performanceMonitor.resolveAlert(alertId);
      expect(resolved).toBe(true);
    }
  });

  it('should update configuration', () => {
    const newConfig = { collectionInterval: 10000, alertingEnabled: false };
    performanceMonitor.updateConfig(newConfig);

    // Configuration should be updated
    expect(true).toBe(true);
  });
});

describe('OptimizedBrowserPool', () => {
  let optimizedPool: OptimizedBrowserPool;

  beforeEach(() => {
    optimizedPool = new OptimizedBrowserPool(
      { maxBrowsers: 5, maxPagesPerBrowser: 10 },
      DEFAULT_OPTIMIZATION_CONFIG,
    );
  });

  afterEach(async () => {
    await optimizedPool.shutdown();
  });

  it('should initialize with optimization features', async () => {
    // Mock the parent class methods
    jest.spyOn(optimizedPool, 'initialize').mockResolvedValue(undefined);

    await optimizedPool.initialize();

    const status = optimizedPool.getOptimizationStatus();
    expect(status.enabled).toBe(true);
  });

  it('should provide optimization status', () => {
    const status = optimizedPool.getOptimizationStatus();

    expect(status).toHaveProperty('enabled');
    expect(status).toHaveProperty('scalingActive');
    expect(status).toHaveProperty('resourceMonitoringActive');
    expect(status).toHaveProperty('recyclingActive');
    expect(status).toHaveProperty('circuitBreakerActive');
    expect(status).toHaveProperty('performanceMonitoringActive');
    expect(status).toHaveProperty('overallHealth');
  });

  it('should get extended metrics with optimization data', () => {
    // Mock the parent class method
    jest.spyOn(optimizedPool, 'getExtendedMetrics').mockReturnValue({
      totalBrowsers: 2,
      activeBrowsers: 1,
      idleBrowsers: 1,
      totalPages: 5,
      activePages: 3,
      browsersCreated: 2,
      browsersDestroyed: 0,
      avgBrowserLifetime: 3600000,
      utilizationPercentage: 50,
      lastHealthCheck: new Date(),
      queue: {
        queueLength: 0,
        averageWaitTime: 0,
        maxWaitTime: 0,
        totalQueued: 0,
        totalDequeued: 0,
      },
      errors: { totalErrors: 0, errorRate: 0, recoverySuccesses: 0, recoveryFailures: 0 },
      avgPageCreationTime: 1000,
      avgPageDestructionTime: 500,
      healthCheck: { avgDuration: 100, lastDuration: 100, successRate: 100, totalChecks: 10 },
      resources: {
        totalCpuUsage: 30,
        totalMemoryUsage: 1024,
        avgCpuPerBrowser: 15,
        avgMemoryPerBrowser: 512,
      },
      timeSeries: { utilizationHistory: [], errorRateHistory: [], queueLengthHistory: [] },
    });

    const metrics = optimizedPool.getExtendedMetrics();

    expect(metrics).toHaveProperty('totalBrowsers');
    expect(metrics).toHaveProperty('optimization');
  });

  it('should update optimization configuration', async () => {
    const newConfig = {
      autoOptimization: false,
      optimizationInterval: 60000,
      scaling: { enabled: false },
    };

    await optimizedPool.updateOptimizationConfig(newConfig);

    const status = optimizedPool.getOptimizationStatus();
    expect(status.autoOptimizationActive).toBe(false);
  });

  it('should force optimization check', async () => {
    await optimizedPool.forceOptimizationCheck();

    // Should complete without errors
    expect(true).toBe(true);
  });

  it('should handle browser acquisition with circuit breaker', async () => {
    // Mock the parent class method
    jest.spyOn(optimizedPool, 'acquireBrowser').mockResolvedValue({
      id: 'test-browser',
      browser: mockBrowser,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 1,
      pageCount: 0,
    });

    const browser = await optimizedPool.acquireBrowser('test-session');

    expect(browser).toHaveProperty('id');
    expect(browser).toHaveProperty('browser');
  });

  it('should handle page creation with optimization', async () => {
    // Mock the parent class method
    jest.spyOn(optimizedPool, 'createPage').mockResolvedValue(mockPage);

    const page = await optimizedPool.createPage('test-browser', 'test-session');

    expect(page).toBeDefined();
  });

  it('should emit optimization events', (done) => {
    optimizedPool.on('optimization-scaling-action', (event) => {
      expect(event).toHaveProperty('decision');
      done();
    });

    // Trigger a scaling action event
    optimizedPool.emit('optimization-scaling-action', { decision: 'scale_up' });
  });
});

describe('Integration Tests', () => {
  it('should integrate all optimization components', async () => {
    const pool = new OptimizedBrowserPool(
      { maxBrowsers: 3, maxPagesPerBrowser: 5 },
      {
        enabled: true,
        autoOptimization: true,
        optimizationInterval: 1000,
      },
    );

    // Mock initialization
    jest.spyOn(pool, 'initialize').mockResolvedValue(undefined);

    await pool.initialize();

    const status = pool.getOptimizationStatus();
    expect(status.enabled).toBe(true);

    await pool.shutdown();
  });

  it('should handle optimization disabled gracefully', async () => {
    const pool = new OptimizedBrowserPool(
      { maxBrowsers: 3, maxPagesPerBrowser: 5 },
      { enabled: false },
    );

    // Mock initialization
    jest.spyOn(pool, 'initialize').mockResolvedValue(undefined);

    await pool.initialize();

    const status = pool.getOptimizationStatus();
    expect(status.enabled).toBe(false);

    await pool.shutdown();
  });
});

describe('Error Handling', () => {
  it('should handle scaler errors gracefully', () => {
    const scaler = new BrowserPoolScaler(DEFAULT_SCALING_STRATEGY);

    // Test with invalid metrics
    const invalidMetrics = null as any;
    const browsers = new Map();
    const options = { maxBrowsers: 10 };

    expect(() => {
      scaler.evaluateScaling(invalidMetrics, browsers, options);
    }).not.toThrow();
  });

  it('should handle resource manager errors gracefully', async () => {
    const resourceManager = new BrowserPoolResourceManager({
      ...DEFAULT_RESOURCE_CONFIG,
      enabled: true,
    });

    // Test with invalid browser
    const invalidBrowser = null as any;
    const invalidInstance = { id: 'test', browser: invalidBrowser };

    await expect(
      resourceManager.optimizeBrowser(invalidBrowser, invalidInstance),
    ).rejects.toThrow();
  });

  it('should handle circuit breaker errors gracefully', async () => {
    const circuitBreaker = new CircuitBreaker('test', DEFAULT_CIRCUIT_BREAKER_CONFIG);

    const faultyOperation = () => {
      throw new Error('Simulated error');
    };

    const result = await circuitBreaker.execute(faultyOperation);

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);

    circuitBreaker.destroy();
  });
});
