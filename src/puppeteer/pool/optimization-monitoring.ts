/**
 * Optimization monitoring and metrics collection
 * @module puppeteer/pool/optimization-monitoring
 * @nist si-4 "Information system monitoring"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

// import { createLogger } from '../../utils/logger.js'; // Not used consistently
import type { BrowserPoolScaling } from './browser-pool-scaling.js';
import type { BrowserPoolResourceManager } from './browser-pool-resource-manager.js';
import type { BrowserPoolRecycler } from './browser-pool-recycler.js';
import type { CircuitBreakerRegistry } from './browser-pool-circuit-breaker.js';
import type { BrowserPoolPerformanceMonitor } from './browser-pool-performance-monitor.js';
import type { ExtendedPoolMetrics } from './browser-pool-metrics.js';
import type { OptimizationConfig, OptimizationStatus } from './optimization-config.js';
import { PerformanceMetricType as PerfMetricType } from './performance/types/performance-monitor.types.js';

// logger is not used consistently, commenting out to avoid unused variable warning
// const logger = createLogger('optimization-monitoring');

/**
 * Optimization monitoring and metrics collection
 */
export class OptimizationMonitoring {
  constructor(
    private optimizationConfig: OptimizationConfig,
    private scaler: BrowserPoolScaling,
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
          PerfMetricType.PROCESSING_TIME,
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
          PerfMetricType.ERROR_RATE,
          1,
          { operation: 'health_check', error: (error as Error).message || 'Unknown error' }
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
    const scalingHistory = this.scaler.getScalingHistory();
    const resourceMetrics = this.resourceManager.getSystemResources();
    const recyclingStats = this.recycler.getRecyclingStats();
    const circuitBreakerStatus = this.circuitBreakers.getStatus();
    const performanceSummary = this.performanceMonitor.getPerformanceSummary();

    // Return base metrics with additional optimization data embedded in existing structure
    const extendedMetrics = {
      ...baseMetrics,
      // Add optimization data as part of the time series or metadata
      timeSeries: {
        ...baseMetrics.timeSeries,
        scalingHistory: scalingHistory.slice(-20), // Last 20 data points
      },
    };
    
    // Store additional optimization data in a way that doesn't break the interface
    (extendedMetrics as any)._optimizationData = {
      resourceMetrics,
      recyclingStats,
      circuitBreakerStatus,
      performanceSummary
    };
    
    return extendedMetrics;
  }

  /**
   * Get optimization status
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getOptimizationStatus(): OptimizationStatus {
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
      PerfMetricType.AVAILABILITY,
      this.calculateAvailability(metrics),
      { timestamp: new Date() }
    );

    this.performanceMonitor.recordMetric(
      PerfMetricType.QUEUE_TIME,
      metrics.queue.averageWaitTime,
      { timestamp: new Date() }
    );
  }
}