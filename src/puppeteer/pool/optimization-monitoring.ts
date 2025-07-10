/**
 * Optimization monitoring and metrics collection
 * @module puppeteer/pool/optimization-monitoring
 * @nist si-4 "Information system monitoring"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { createLogger } from '../../utils/logger.js';
import type { BrowserPoolScaler } from './browser-pool-scaling.js';
import type { BrowserPoolResourceManager } from './browser-pool-resource-manager.js';
import type { BrowserPoolRecycler } from './browser-pool-recycler.js';
import type { CircuitBreakerRegistry } from './browser-pool-circuit-breaker.js';
import type { BrowserPoolPerformanceMonitor } from './browser-pool-performance-monitor.js';
import type { ExtendedPoolMetrics } from './browser-pool-metrics.js';
import type { OptimizationConfig, OptimizationStatus } from './optimization-config.js';
import { PerformanceMetricType } from './browser-pool-performance-monitor.js';

const logger = createLogger('optimization-monitoring');

/**
 * Optimization monitoring and metrics collection
 */
export class OptimizationMonitoring {
  constructor(
    private optimizationConfig: OptimizationConfig,
    private scaler: BrowserPoolScaler,
    private resourceManager: BrowserPoolResourceManager,
    private recycler: BrowserPoolRecycler,
    private circuitBreakers: CircuitBreakerRegistry,
    private performanceMonitor: BrowserPoolPerformanceMonitor,
    private optimizationEnabled: boolean,
    private lastOptimizationCheck: Date,
    private optimizationActions: number
  ) {}

  /**
   * Enhanced health check with optimization
   * @nist si-4 "Information system monitoring"
   */
  async healthCheck(
    baseHealthCheck: () => Promise<Map<string, boolean>>
  ): Promise<Map<string, boolean>> {
    const startTime = Date.now();
    
    try {
      const results = await baseHealthCheck();
      
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
  getExtendedMetrics(baseMetrics: ExtendedPoolMetrics): ExtendedPoolMetrics {
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
          browserResources: (() => {
            const resources = this.resourceManager.getBrowserResources();
            return resources instanceof Map ? Array.from(resources.values()) : [];
          })(),
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
   * Calculate throughput from metrics
   */
  calculateThroughput(metrics: ExtendedPoolMetrics): number {
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
   */
  calculateAvailability(metrics: ExtendedPoolMetrics): number {
    const totalBrowsers = metrics.totalBrowsers;
    const healthyBrowsers = totalBrowsers - (metrics.errors.totalErrors || 0);
    
    return totalBrowsers > 0 ? (healthyBrowsers / totalBrowsers) * 100 : 100;
  }

  /**
   * Handle metrics collection request
   */
  handleMetricsCollectionRequest(
    getExtendedMetrics: () => ExtendedPoolMetrics
  ): void {
    // Collect and provide metrics to the performance monitor
    const metrics = getExtendedMetrics();
    
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
  }
}