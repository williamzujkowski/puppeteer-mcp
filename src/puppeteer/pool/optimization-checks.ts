/**
 * Optimization check algorithms and logic
 * @module puppeteer/pool/optimization-checks
 * @nist si-4 "Information system monitoring"
 */

import { createLogger } from '../../utils/logger.js';
import type { BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import type { BrowserPoolScaling } from './browser-pool-scaling.js';
import type { BrowserPoolResourceManager } from './browser-pool-resource-manager.js';
import type { BrowserPoolRecycler } from './browser-pool-recycler.js';
import type { BrowserPoolPerformanceMonitor } from './browser-pool-performance-monitor.js';
import type { ExtendedPoolMetrics } from './browser-pool-metrics.js';
import type { OptimizationConfig } from './optimization-config.js';
import { PerformanceMetricType } from './performance/types/performance-monitor.types.js';

const logger = createLogger('optimization-checks');

/**
 * Optimization check algorithms and logic
 */
export class OptimizationChecks {
  constructor(
    private optimizationConfig: OptimizationConfig,
    private scaler: BrowserPoolScaling,
    private resourceManager: BrowserPoolResourceManager,
    private recycler: BrowserPoolRecycler,
    private performanceMonitor: BrowserPoolPerformanceMonitor,
    private optimizationEnabled: boolean,
    _lastOptimizationCheck: Date,
    _optimizationActions: { value: number }
  ) {}

  /**
   * Perform optimization check
   */
  async performOptimizationCheck(
    getBrowsersInternal: () => Map<string, InternalBrowserInstance>,
    getExtendedMetrics: () => ExtendedPoolMetrics,
    recycleBrowser: (browserId: string) => Promise<void>
  ): Promise<void> {
    if (!this.optimizationEnabled) {
      return;
    }

    this.lastOptimizationCheck = new Date();
    
    try {
      const browsers = getBrowsersInternal();
      const metrics = getExtendedMetrics();
      const resourceUsage = this.resourceManager.getBrowserResources() || new Map();

      // Check for scaling opportunities
      if (this.optimizationConfig.scaling.enabled) {
        await this.checkScalingOpportunities(browsers, metrics);
      }

      // Check for recycling opportunities
      if (this.optimizationConfig.recycling.enabled) {
        await this.checkRecyclingOpportunities(browsers, resourceUsage, recycleBrowser);
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
        { operation: 'optimization_check', error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Check scaling opportunities
   */
  private async checkScalingOpportunities(
    browsers: Map<string, InternalBrowserInstance>,
    metrics: ExtendedPoolMetrics,
    getOptionsInternal?: () => BrowserPoolOptions
  ): Promise<{ decision: string; targetSize: number; reason: string; confidence: number } | null> {
    const options = getOptionsInternal?.() || {
      maxBrowsers: 10,
      maxPagesPerBrowser: 10,
      launchOptions: {},
      idleTimeout: 300000,
      healthCheckInterval: 30000,
    };

    const scalingDecision = this.scaler.evaluateScaling(
      metrics,
      browsers,
      options
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

      this.optimizationActions.value++;
      this.scaler.recordScalingAction(
        scalingDecision.decision,
        browsers.size,
        scalingDecision.targetSize
      );

      return scalingDecision;
    }

    return null;
  }

  /**
   * Check recycling opportunities
   */
  private async checkRecyclingOpportunities(
    browsers: Map<string, InternalBrowserInstance>,
    resourceUsage: Map<string, any>,
    recycleBrowser: (browserId: string) => Promise<void>
  ): Promise<any[]> {
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
        recycleBrowser
      );

      if (recyclingEvents.length > 0) {
        this.optimizationActions.value += recyclingEvents.length;
        return recyclingEvents;
      }
    }

    return [];
  }

  /**
   * Calculate throughput from metrics
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
}