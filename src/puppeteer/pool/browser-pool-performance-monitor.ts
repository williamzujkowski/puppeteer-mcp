/**
 * Performance monitoring and metrics collection for browser pool (Modular Implementation)
 * @module puppeteer/pool/browser-pool-performance-monitor
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger.js';

// Import performance monitoring components
import {
  MetricsCollector,
  AlertManager,
  TrendAnalyzer,
  AnomalyDetector,
  OptimizationEngine,
  PerformanceCalculations,
  DEFAULT_PERFORMANCE_CONFIG,
} from './performance/index.js';

// Type imports
import type {
  PerformanceMonitoringConfig,
  PerformanceMetricType,
  PerformanceDataPoint,
  PerformanceAlert,
  PerformanceTrend,
  PerformanceAnomaly,
  OptimizationRecommendation,
  PerformanceSummary,
  TimeRange,
} from './performance/index.js';

const logger = createLogger('browser-pool-performance-monitor');

/**
 * Performance monitor for browser pool using composition pattern
 * @nist si-4 "Information system monitoring"
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class BrowserPoolPerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitoringConfig;
  private monitoringInterval?: NodeJS.Timeout;
  private analysisInterval?: NodeJS.Timeout;

  // Strategy components using composition
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private trendAnalyzer: TrendAnalyzer;
  private anomalyDetector: AnomalyDetector;
  private optimizationEngine: OptimizationEngine;
  private performanceCalculations: PerformanceCalculations;

  constructor(config: Partial<PerformanceMonitoringConfig> = {}) {
    super();
    
    // Merge with default configuration
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };

    // Initialize strategy components
    this.metricsCollector = new MetricsCollector(this, this.config);
    this.alertManager = new AlertManager(this, this.config);
    this.trendAnalyzer = new TrendAnalyzer(this, this.config);
    this.anomalyDetector = new AnomalyDetector(this, this.config);
    this.optimizationEngine = new OptimizationEngine(this, this.config);
    this.performanceCalculations = new PerformanceCalculations();
  }

  /**
   * Start performance monitoring
   * @nist si-4 "Information system monitoring"
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Performance monitoring disabled');
      return;
    }

    logger.info(
      { config: this.config },
      'Starting performance monitoring'
    );

    // Start data collection
    this.monitoringInterval = setInterval(
      () => this.collectMetrics(),
      this.config.collectionInterval
    );

    // Start analysis
    this.analysisInterval = setInterval(
      () => this.performAnalysis(),
      this.config.collectionInterval * 2
    );

    this.emit('monitoring-started');
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }

    logger.info('Performance monitoring stopped');
    this.emit('monitoring-stopped');
  }

  /**
   * Record performance metric
   * @nist au-3 "Content of audit records"
   */
  recordMetric(
    type: PerformanceMetricType,
    value: number,
    metadata?: Record<string, unknown>,
    source?: string
  ): void {
    // Delegate to metrics collector
    this.metricsCollector.recordMetric(type, value, metadata, undefined, source);

    // Check for real-time alerts
    if (this.config.enableRealTimeAlerts && this.config.alertingEnabled) {
      this.alertManager.checkRealTimeAlert(type, value);
    }

    // Check for anomalies
    if (this.config.enableAnomalyDetection) {
      this.anomalyDetector.checkAnomaly(type, value);
    }
  }

  /**
   * Get performance metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(
    type?: PerformanceMetricType,
    timeRange?: TimeRange
  ): Map<PerformanceMetricType, PerformanceDataPoint[]> {
    return this.metricsCollector.getMetrics(type, timeRange);
  }

  /**
   * Get active alerts
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alertManager.getActiveAlerts();
  }

  /**
   * Get performance trends
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getTrends(): Map<PerformanceMetricType, PerformanceTrend> {
    return this.trendAnalyzer.getTrends();
  }

  /**
   * Get anomalies
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getAnomalies(timeRange?: TimeRange): PerformanceAnomaly[] {
    return this.anomalyDetector.getAnomalies(timeRange);
  }

  /**
   * Get optimization recommendations
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getRecommendations(applied?: boolean): OptimizationRecommendation[] {
    return this.optimizationEngine.getRecommendations(applied);
  }

  /**
   * Get performance summary
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getPerformanceSummary(timeRange?: TimeRange): PerformanceSummary {
    const end = timeRange?.end ?? new Date();
    const start = timeRange?.start ?? new Date(end.getTime() - 60 * 60 * 1000);
    const duration = end.getTime() - start.getTime();

    // Build metrics summary
    const metrics = this.buildMetricsSummary({ start, end });
    
    // Get component summaries
    const alertStats = this.alertManager.getAlertStatistics();
    const anomalyStats = this.anomalyDetector.getAnomalyStatistics();
    const recommendationStats = this.optimizationEngine.getRecommendationStatistics();

    const alertsSummary = { total: alertStats.total, byLevel: alertStats.byLevel, active: alertStats.active, resolved: alertStats.resolved };
    const anomaliesSummary = { total: anomalyStats.total, bySeverity: anomalyStats.bySeverity };
    const recommendationsSummary = { total: recommendationStats.total, byPriority: recommendationStats.byPriority, applied: recommendationStats.applied };

    // Calculate scores
    const healthScore = this.performanceCalculations.calculateHealthScore(metrics, alertsSummary, anomaliesSummary);
    const performanceGrade = this.performanceCalculations.calculatePerformanceGrade(healthScore);

    return { period: { start, end, duration }, metrics, alertsSummary, anomalies: anomaliesSummary, recommendations: recommendationsSummary, healthScore, performanceGrade };
  }

  /**
   * Build metrics summary for performance report
   * @private
   */
  private buildMetricsSummary(timeRange: TimeRange): PerformanceSummary['metrics'] {
    const metricsData = this.metricsCollector.getMetrics(undefined, timeRange);
    const metrics = {} as PerformanceSummary['metrics'];
    
    for (const [type, dataPoints] of metricsData) {
      if (dataPoints.length > 0) {
        const values = dataPoints.map(dp => dp.value);
        const stats = this.performanceCalculations.calculateStatistics(values);
        metrics[type] = { current: values[values.length - 1] || 0, ...stats, trend: this.trendAnalyzer.determineTrend(type) };
      }
    }
    return metrics;
  }

  /**
   * Alert and recommendation management
   * @nist au-5 "Response to audit processing failures"
   */
  acknowledgeAlert(alertId: string): boolean { return this.alertManager.acknowledgeAlert(alertId); }
  resolveAlert(alertId: string): boolean { return this.alertManager.resolveAlert(alertId); }
  applyRecommendation(recommendationId: string, result: { successful: boolean; actualImprovement: number; notes: string }): boolean {
    return this.optimizationEngine.applyRecommendation(recommendationId, result);
  }

  /**
   * Update monitoring configuration
   * @nist cm-7 "Least functionality"
   */
  updateConfig(newConfig: Partial<PerformanceMonitoringConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    logger.info(
      {
        oldConfig,
        newConfig: this.config,
        changes: Object.keys(newConfig),
      },
      'Performance monitoring configuration updated'
    );

    this.emit('config-updated', { oldConfig, newConfig: this.config });
  }

  /**
   * Internal monitoring operations
   * @private
   */
  private collectMetrics(): void { this.emit('metrics-collection-requested'); }

  private performAnalysis(): void {
    const allDataPoints = this.metricsCollector.getAllDataPoints();
    if (this.config.enableTrendAnalysis) this.trendAnalyzer.analyzeTrends(allDataPoints);
    if (this.config.enablePerformanceOptimization) this.optimizationEngine.generateRecommendations(this.getPerformanceSummary());
    if (this.config.autoOptimizationEnabled) this.optimizationEngine.autoApplyRecommendations();
    this.cleanupOldData();
  }

  private cleanupOldData(): void {
    const retention = this.config.retentionPeriod;
    this.metricsCollector.cleanupOldData(retention);
    this.alertManager.cleanupResolvedAlerts(retention);
    this.anomalyDetector.cleanupOldAnomalies(retention);
    this.optimizationEngine.clearOldRecommendations(7 * 24 * 60 * 60 * 1000);
  }
}

// Export types and configurations for backward compatibility
export type {
  PerformanceMonitoringConfig,
  PerformanceMetricType,
  PerformanceDataPoint,
  PerformanceAlert,
  PerformanceTrend,
  PerformanceAnomaly,
  OptimizationRecommendation,
  PerformanceSummary,
} from './performance/index.js';
export { DEFAULT_PERFORMANCE_CONFIG } from './performance/index.js';