/**
 * Enhanced browser pool with optimization features
 * @module puppeteer/pool/browser-pool-optimized
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist ac-12 "Session termination"
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import type { Page } from 'puppeteer';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type {
  BrowserPool as IBrowserPool,
  BrowserInstance,
  BrowserPoolOptions,
} from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { BrowserPool } from './browser-pool.js';

// Import optimization components
import { BrowserPoolScaler, DEFAULT_SCALING_STRATEGY, type ScalingStrategy } from './browser-pool-scaling.js';
import { BrowserPoolResourceManager, DEFAULT_RESOURCE_CONFIG, type ResourceMonitoringConfig } from './browser-pool-resource-manager.js';
import { BrowserPoolRecycler, DEFAULT_RECYCLING_CONFIG, type RecyclingConfig } from './browser-pool-recycler.js';
import { CircuitBreakerRegistry, DEFAULT_CIRCUIT_BREAKER_CONFIG, type CircuitBreakerConfig } from './browser-pool-circuit-breaker.js';
import { BrowserPoolPerformanceMonitor, DEFAULT_PERFORMANCE_CONFIG, type PerformanceMonitoringConfig, PerformanceMetricType } from './browser-pool-performance-monitor.js';
import type { ExtendedPoolMetrics } from './browser-pool-metrics.js';

const logger = createLogger('browser-pool-optimized');

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  /** Enable optimization features */
  enabled: boolean;
  /** Scaling configuration */
  scaling: Partial<ScalingStrategy>;
  /** Resource monitoring configuration */
  resourceMonitoring: Partial<ResourceMonitoringConfig>;
  /** Recycling configuration */
  recycling: Partial<RecyclingConfig>;
  /** Circuit breaker configuration */
  circuitBreaker: Partial<CircuitBreakerConfig>;
  /** Performance monitoring configuration */
  performanceMonitoring: Partial<PerformanceMonitoringConfig>;
  /** Enable automatic optimization */
  autoOptimization: boolean;
  /** Optimization check interval (ms) */
  optimizationInterval: number;
}

/**
 * Optimization status
 */
export interface OptimizationStatus {
  enabled: boolean;
  scalingActive: boolean;
  resourceMonitoringActive: boolean;
  recyclingActive: boolean;
  circuitBreakerActive: boolean;
  performanceMonitoringActive: boolean;
  autoOptimizationActive: boolean;
  lastOptimizationCheck: Date;
  optimizationActions: number;
  overallHealth: number;
  recommendations: Array<{
    type: string;
    priority: string;
    description: string;
    timestamp: Date;
  }>;
}

/**
 * Enhanced browser pool with optimization features
 * @nist ac-3 "Access enforcement"
 * @nist si-4 "Information system monitoring"
 */
export class OptimizedBrowserPool extends BrowserPool implements IBrowserPool {
  private optimizationConfig: OptimizationConfig;
  private scaler: BrowserPoolScaler;
  private resourceManager: BrowserPoolResourceManager;
  private recycler: BrowserPoolRecycler;
  private circuitBreakers: CircuitBreakerRegistry;
  private performanceMonitor: BrowserPoolPerformanceMonitor;
  private optimizationTimer?: NodeJS.Timeout;
  private lastOptimizationCheck = new Date(0);
  private optimizationActions = 0;
  private readonly optimizationEnabled: boolean;

  constructor(
    options: Partial<BrowserPoolOptions> = {},
    optimizationConfig: Partial<OptimizationConfig> = {}
  ) {
    super(options);
    
    this.optimizationConfig = {
      enabled: true,
      scaling: DEFAULT_SCALING_STRATEGY,
      resourceMonitoring: DEFAULT_RESOURCE_CONFIG,
      recycling: DEFAULT_RECYCLING_CONFIG,
      circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
      performanceMonitoring: DEFAULT_PERFORMANCE_CONFIG,
      autoOptimization: true,
      optimizationInterval: 30000, // 30 seconds
      ...optimizationConfig,
    };

    this.optimizationEnabled = this.optimizationConfig.enabled;

    // Initialize optimization components
    this.scaler = new BrowserPoolScaler(this.optimizationConfig.scaling);
    this.resourceManager = new BrowserPoolResourceManager(
      this.optimizationConfig.resourceMonitoring
    );
    this.recycler = new BrowserPoolRecycler(this.optimizationConfig.recycling);
    this.circuitBreakers = new CircuitBreakerRegistry(this.optimizationConfig.circuitBreaker);
    this.performanceMonitor = new BrowserPoolPerformanceMonitor(
      this.optimizationConfig.performanceMonitoring
    );

    this.setupOptimizationEventHandlers();
  }

  /**
   * Initialize the optimized pool
   * @nist ac-3 "Access enforcement"
   */
  async initialize(): Promise<void> {
    // Initialize base pool
    await super.initialize();

    if (!this.optimizationEnabled) {
      logger.info('Optimization features disabled');
      return;
    }

    try {
      // Start optimization components
      await this.startOptimizationComponents();

      // Start optimization monitoring
      if (this.optimizationConfig.autoOptimization) {
        this.startOptimizationMonitoring();
      }

      logger.info(
        {
          optimizationConfig: this.optimizationConfig,
        },
        'Optimization features initialized'
      );

      // Log optimization initialization
      await logSecurityEvent(SecurityEventType.SERVICE_START, {
        resource: 'browser_pool_optimization',
        action: 'initialize',
        result: 'success',
        metadata: {
          scalingEnabled: this.optimizationConfig.scaling.enabled,
          resourceMonitoringEnabled: this.optimizationConfig.resourceMonitoring.enabled,
          recyclingEnabled: this.optimizationConfig.recycling.enabled,
          circuitBreakerEnabled: this.optimizationConfig.circuitBreaker.enabled,
          performanceMonitoringEnabled: this.optimizationConfig.performanceMonitoring.enabled,
          autoOptimization: this.optimizationConfig.autoOptimization,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to initialize optimization features');
      throw error;
    }
  }

  /**
   * Enhanced browser acquisition with circuit breaker protection
   * @nist ac-3 "Access enforcement"
   * @nist au-5 "Response to audit processing failures"
   */
  async acquireBrowser(sessionId: string): Promise<BrowserInstance> {
    if (!this.optimizationEnabled) {
      return super.acquireBrowser(sessionId);
    }

    const circuitBreaker = this.circuitBreakers.getCircuitBreaker('browser-acquisition');
    
    return circuitBreaker.execute(
      async () => {
        const startTime = Date.now();
        const browser = await super.acquireBrowser(sessionId);
        const executionTime = Date.now() - startTime;

        // Record performance metrics
        this.performanceMonitor.recordMetric(
          PerformanceMetricType.LATENCY,
          executionTime,
          { operation: 'acquire_browser', sessionId }
        );

        return browser;
      },
      async () => {
        // Fallback: try to get any available browser
        const metrics = this.getExtendedMetrics();
        if (metrics.idleBrowsers > 0) {
          return super.acquireBrowser(sessionId);
        }
        throw new Error('No browsers available and circuit breaker is open');
      },
      `browser-acquisition-${sessionId}`
    ).then(result => {
      if (result.success && result.result) {
        return result.result;
      }
      throw result.error || new Error('Browser acquisition failed');
    });
  }

  /**
   * Enhanced browser release with optimization
   * @nist ac-12 "Session termination"
   */
  async releaseBrowser(browserId: string, sessionId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      await super.releaseBrowser(browserId, sessionId);
      
      if (this.optimizationEnabled) {
        const executionTime = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          PerformanceMetricType.PROCESSING_TIME,
          executionTime,
          { operation: 'release_browser', sessionId, browserId }
        );
      }
    } catch (error) {
      if (this.optimizationEnabled) {
        this.performanceMonitor.recordMetric(
          PerformanceMetricType.ERROR_RATE,
          1,
          { operation: 'release_browser', sessionId, browserId, error: error.message }
        );
      }
      throw error;
    }
  }

  /**
   * Enhanced page creation with optimization
   * @nist ac-4 "Information flow enforcement"
   */
  async createPage(browserId: string, sessionId: string): Promise<Page> {
    if (!this.optimizationEnabled) {
      return super.createPage(browserId, sessionId);
    }

    const circuitBreaker = this.circuitBreakers.getCircuitBreaker('page-creation');
    
    return circuitBreaker.execute(
      async () => {
        const startTime = Date.now();
        const page = await super.createPage(browserId, sessionId);
        const executionTime = Date.now() - startTime;

        // Record performance metrics
        this.performanceMonitor.recordMetric(
          PerformanceMetricType.RESPONSE_TIME,
          executionTime,
          { operation: 'create_page', sessionId, browserId }
        );

        // Apply resource optimizations
        const browserInstance = this.getBrowser(browserId);
        if (browserInstance) {
          await this.resourceManager.optimizeBrowser(browserInstance.browser, browserInstance);
        }

        return page;
      },
      undefined,
      `page-creation-${browserId}-${sessionId}`
    ).then(result => {
      if (result.success && result.result) {
        return result.result;
      }
      throw result.error || new Error('Page creation failed');
    });
  }

  /**
   * Enhanced health check with optimization
   * @nist si-4 "Information system monitoring"
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const startTime = Date.now();
    
    try {
      const results = await super.healthCheck();
      
      if (this.optimizationEnabled) {
        const executionTime = Date.now() - startTime;
        this.performanceMonitor.recordMetric(
          PerformanceMetricType.PROCESSING_TIME,
          executionTime,
          { operation: 'health_check', browserCount: results.size }
        );

        // Update recycler health metrics
        for (const [browserId, healthy] of results) {
          this.recycler.updateHealthMetrics(browserId, { healthy, responsive: healthy });
        }
      }

      return results;
    } catch (error) {
      if (this.optimizationEnabled) {
        this.performanceMonitor.recordMetric(
          PerformanceMetricType.ERROR_RATE,
          1,
          { operation: 'health_check', error: error.message }
        );
      }
      throw error;
    }
  }

  /**
   * Get extended metrics with optimization data
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getExtendedMetrics(): ExtendedPoolMetrics {
    const baseMetrics = super.getExtendedMetrics();
    
    if (!this.optimizationEnabled) {
      return baseMetrics;
    }

    // Add optimization-specific metrics
    const scalingMetrics = this.scaler.getHistoricalData();
    const resourceMetrics = this.resourceManager.getSystemResources();
    const recyclingStats = this.recycler.getRecyclingStats();
    const circuitBreakerStatus = this.circuitBreakers.getStatus();
    const performanceSummary = this.performanceMonitor.getPerformanceSummary();

    return {
      ...baseMetrics,
      optimization: {
        scaling: {
          enabled: this.optimizationConfig.scaling.enabled,
          strategy: this.scaler.getStrategy(),
          historicalData: scalingMetrics.slice(-20), // Last 20 data points
        },
        resourceMonitoring: {
          enabled: this.optimizationConfig.resourceMonitoring.enabled,
          systemResources: resourceMetrics,
          browserResources: Array.from(this.resourceManager.getBrowserResources().values()),
          activeAlerts: Array.from(this.resourceManager.getActiveAlerts().values()),
        },
        recycling: {
          enabled: this.optimizationConfig.recycling.enabled,
          stats: recyclingStats,
        },
        circuitBreaker: {
          enabled: this.optimizationConfig.circuitBreaker.enabled,
          status: circuitBreakerStatus,
        },
        performanceMonitoring: {
          enabled: this.optimizationConfig.performanceMonitoring.enabled,
          summary: performanceSummary,
          activeAlerts: this.performanceMonitor.getActiveAlerts(),
        },
      },
    };
  }

  /**
   * Get optimization status
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getOptimizationStatus(): OptimizationStatus {
    const circuitBreakerStatus = this.circuitBreakers.getStatus();
    const performanceSummary = this.performanceMonitor.getPerformanceSummary();
    const recommendations = this.performanceMonitor.getRecommendations(false);

    return {
      enabled: this.optimizationEnabled,
      scalingActive: this.optimizationConfig.scaling.enabled || false,
      resourceMonitoringActive: this.optimizationConfig.resourceMonitoring.enabled || false,
      recyclingActive: this.optimizationConfig.recycling.enabled || false,
      circuitBreakerActive: this.optimizationConfig.circuitBreaker.enabled || false,
      performanceMonitoringActive: this.optimizationConfig.performanceMonitoring.enabled || false,
      autoOptimizationActive: this.optimizationConfig.autoOptimization,
      lastOptimizationCheck: this.lastOptimizationCheck,
      optimizationActions: this.optimizationActions,
      overallHealth: performanceSummary.healthScore,
      recommendations: recommendations.slice(0, 10).map(r => ({
        type: r.type,
        priority: r.priority,
        description: r.description,
        timestamp: r.timestamp,
      })),
    };
  }

  /**
   * Update optimization configuration
   * @nist cm-7 "Least functionality"
   */
  async updateOptimizationConfig(newConfig: Partial<OptimizationConfig>): Promise<void> {
    const oldConfig = { ...this.optimizationConfig };
    this.optimizationConfig = { ...this.optimizationConfig, ...newConfig };

    // Update component configurations
    if (newConfig.scaling) {
      this.scaler.updateStrategy(newConfig.scaling);
    }

    if (newConfig.resourceMonitoring) {
      this.resourceManager.updateConfig(newConfig.resourceMonitoring);
    }

    if (newConfig.recycling) {
      this.recycler.updateConfig(newConfig.recycling);
    }

    if (newConfig.circuitBreaker) {
      this.circuitBreakers.updateGlobalConfig(newConfig.circuitBreaker);
    }

    if (newConfig.performanceMonitoring) {
      this.performanceMonitor.updateConfig(newConfig.performanceMonitoring);
    }

    logger.info(
      {
        oldConfig,
        newConfig: this.optimizationConfig,
        changes: Object.keys(newConfig),
      },
      'Optimization configuration updated'
    );

    // Log configuration change
    await logSecurityEvent(SecurityEventType.CONFIG_CHANGE, {
      resource: 'browser_pool_optimization',
      action: 'update_config',
      result: 'success',
      metadata: {
        changes: Object.keys(newConfig),
        newConfig: this.optimizationConfig,
      },
    });

    this.emit('optimization-config-updated', { oldConfig, newConfig: this.optimizationConfig });
  }

  /**
   * Force optimization check
   * @nist si-4 "Information system monitoring"
   */
  async forceOptimizationCheck(): Promise<void> {
    if (!this.optimizationEnabled) {
      return;
    }

    logger.info('Forcing optimization check');
    await this.performOptimizationCheck();
  }

  /**
   * Enhanced shutdown with optimization cleanup
   * @nist ac-12 "Session termination"
   */
  async shutdown(): Promise<void> {
    if (this.optimizationEnabled) {
      this.stopOptimizationMonitoring();
      await this.stopOptimizationComponents();
    }

    await super.shutdown();
  }

  /**
   * Start optimization components
   * @private
   */
  private async startOptimizationComponents(): Promise<void> {
    // Start scaler
    if (this.optimizationConfig.scaling.enabled) {
      this.scaler.start();
    }

    // Start resource manager
    if (this.optimizationConfig.resourceMonitoring.enabled) {
      await this.resourceManager.start();
    }

    // Start recycler
    if (this.optimizationConfig.recycling.enabled) {
      this.recycler.start();
    }

    // Start performance monitor
    if (this.optimizationConfig.performanceMonitoring.enabled) {
      this.performanceMonitor.start();
    }

    logger.info('Optimization components started');
  }

  /**
   * Stop optimization components
   * @private
   */
  private async stopOptimizationComponents(): Promise<void> {
    this.scaler.stop();
    this.resourceManager.stop();
    this.recycler.stop();
    this.performanceMonitor.stop();
    this.circuitBreakers.destroy();

    logger.info('Optimization components stopped');
  }

  /**
   * Start optimization monitoring
   * @private
   */
  private startOptimizationMonitoring(): void {
    this.optimizationTimer = setInterval(
      () => this.performOptimizationCheck(),
      this.optimizationConfig.optimizationInterval
    );

    logger.info(
      {
        interval: this.optimizationConfig.optimizationInterval,
      },
      'Optimization monitoring started'
    );
  }

  /**
   * Stop optimization monitoring
   * @private
   */
  private stopOptimizationMonitoring(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = undefined;
    }

    logger.info('Optimization monitoring stopped');
  }

  /**
   * Perform optimization check
   * @private
   */
  private async performOptimizationCheck(): Promise<void> {
    if (!this.optimizationEnabled) {
      return;
    }

    this.lastOptimizationCheck = new Date();
    
    try {
      const browsers = this.getBrowsersInternal();
      const metrics = this.getExtendedMetrics();
      const resourceUsage = this.resourceManager.getBrowserResources();

      // Check for scaling opportunities
      if (this.optimizationConfig.scaling.enabled) {
        await this.checkScalingOpportunities(browsers, metrics);
      }

      // Check for recycling opportunities
      if (this.optimizationConfig.recycling.enabled) {
        await this.checkRecyclingOpportunities(browsers, resourceUsage);
      }

      // Monitor browser resources
      if (this.optimizationConfig.resourceMonitoring.enabled) {
        await this.resourceManager.monitorBrowserResources(browsers);
      }

      // Record throughput metrics
      const throughput = this.calculateThroughput(metrics);
      this.performanceMonitor.recordMetric(
        PerformanceMetricType.THROUGHPUT,
        throughput,
        { timestamp: new Date() }
      );

      // Record utilization metrics
      this.performanceMonitor.recordMetric(
        PerformanceMetricType.RESOURCE_UTILIZATION,
        metrics.utilizationPercentage,
        { timestamp: new Date() }
      );

    } catch (error) {
      logger.error({ error }, 'Error during optimization check');
      this.performanceMonitor.recordMetric(
        PerformanceMetricType.ERROR_RATE,
        1,
        { operation: 'optimization_check', error: error.message }
      );
    }
  }

  /**
   * Check scaling opportunities
   * @private
   */
  private async checkScalingOpportunities(
    browsers: Map<string, InternalBrowserInstance>,
    metrics: ExtendedPoolMetrics
  ): Promise<void> {
    const scalingDecision = this.scaler.evaluateScaling(
      metrics,
      browsers,
      this.getOptionsInternal()
    );

    if (scalingDecision.decision !== 'maintain') {
      logger.info(
        {
          decision: scalingDecision.decision,
          currentSize: browsers.size,
          targetSize: scalingDecision.targetSize,
          reason: scalingDecision.reason,
          confidence: scalingDecision.confidence,
        },
        'Scaling action recommended'
      );

      this.optimizationActions++;
      this.scaler.recordScalingAction(
        scalingDecision.decision,
        browsers.size,
        scalingDecision.targetSize
      );

      this.emit('scaling-recommendation', scalingDecision);
    }
  }

  /**
   * Check recycling opportunities
   * @private
   */
  private async checkRecyclingOpportunities(
    browsers: Map<string, InternalBrowserInstance>,
    resourceUsage: Map<string, any>
  ): Promise<void> {
    const candidates = this.recycler.evaluateBrowsers(browsers, resourceUsage);

    if (candidates.length > 0) {
      logger.info(
        {
          candidates: candidates.length,
          criticalCandidates: candidates.filter(c => c.urgency === 'critical').length,
        },
        'Recycling candidates found'
      );

      const recyclingEvents = await this.recycler.executeRecycling(
        candidates,
        async (browserId) => {
          await this.recycleBrowser(browserId);
        }
      );

      if (recyclingEvents.length > 0) {
        this.optimizationActions += recyclingEvents.length;
        this.emit('browsers-recycled', recyclingEvents);
      }
    }
  }

  /**
   * Setup optimization event handlers
   * @private
   */
  private setupOptimizationEventHandlers(): void {
    // Scaler events
    this.scaler.on('scaling-action', (event) => {
      this.emit('optimization-scaling-action', event);
    });

    // Resource manager events
    this.resourceManager.on('resource-alert', (alert) => {
      this.emit('optimization-resource-alert', alert);
    });

    // Recycler events
    this.recycler.on('browsers-recycled', (events) => {
      this.emit('optimization-browsers-recycled', events);
    });

    // Performance monitor events
    this.performanceMonitor.on('alert-created', (alert) => {
      this.emit('optimization-performance-alert', alert);
    });

    this.performanceMonitor.on('recommendation-generated', (recommendation) => {
      this.emit('optimization-recommendation', recommendation);
    });

    // Performance monitor collection request
    this.performanceMonitor.on('metrics-collection-requested', () => {
      // Collect and provide metrics to the performance monitor
      const metrics = this.getExtendedMetrics();
      
      // Record various metrics
      this.performanceMonitor.recordMetric(
        PerformanceMetricType.AVAILABILITY,
        this.calculateAvailability(metrics),
        { timestamp: new Date() }
      );

      this.performanceMonitor.recordMetric(
        PerformanceMetricType.QUEUE_TIME,
        metrics.queue.averageWaitTime,
        { timestamp: new Date() }
      );
    });
  }

  /**
   * Calculate throughput from metrics
   * @private
   */
  private calculateThroughput(metrics: ExtendedPoolMetrics): number {
    // Simple throughput calculation based on active browsers and their efficiency
    const activeBrowsers = metrics.activeBrowsers;
    const averagePageCreationTime = metrics.avgPageCreationTime;
    
    if (averagePageCreationTime > 0) {
      return (activeBrowsers * 1000) / averagePageCreationTime; // Operations per second
    }
    
    return activeBrowsers;
  }

  /**
   * Calculate availability from metrics
   * @private
   */
  private calculateAvailability(metrics: ExtendedPoolMetrics): number {
    const totalBrowsers = metrics.totalBrowsers;
    const healthyBrowsers = totalBrowsers - (metrics.errors.totalErrors || 0);
    
    return totalBrowsers > 0 ? (healthyBrowsers / totalBrowsers) * 100 : 100;
  }

  /**
   * Get browsers internal map (for optimization components)
   * @private
   */
  private getBrowsersInternal(): Map<string, InternalBrowserInstance> {
    // This would need to be implemented to access the internal browsers map
    // For now, returning empty map - in real implementation, this would access the internal state
    return new Map();
  }

  /**
   * Get options internal (for optimization components)
   * @private
   */
  private getOptionsInternal(): BrowserPoolOptions {
    // This would need to be implemented to access the internal options
    // For now, returning basic options - in real implementation, this would access the internal state
    return {
      maxBrowsers: 10,
      maxPagesPerBrowser: 10,
      launchOptions: {},
      idleTimeout: 300000,
      healthCheckInterval: 30000,
    };
  }
}

/**
 * Default optimization configuration
 */
export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  enabled: true,
  scaling: DEFAULT_SCALING_STRATEGY,
  resourceMonitoring: DEFAULT_RESOURCE_CONFIG,
  recycling: DEFAULT_RECYCLING_CONFIG,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  performanceMonitoring: DEFAULT_PERFORMANCE_CONFIG,
  autoOptimization: true,
  optimizationInterval: 30000,
};