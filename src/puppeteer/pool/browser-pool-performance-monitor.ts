/**
 * Performance monitoring and metrics collection for browser pool
 * @module puppeteer/pool/browser-pool-performance-monitor
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import type { ExtendedPoolMetrics } from './browser-pool-metrics.js';

const logger = createLogger('browser-pool-performance-monitor');

/**
 * Performance metric types
 */
export enum PerformanceMetricType {
  LATENCY = 'latency',
  THROUGHPUT = 'throughput',
  ERROR_RATE = 'error_rate',
  RESOURCE_UTILIZATION = 'resource_utilization',
  AVAILABILITY = 'availability',
  RESPONSE_TIME = 'response_time',
  QUEUE_TIME = 'queue_time',
  PROCESSING_TIME = 'processing_time',
}

/**
 * Performance alert levels
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitoringConfig {
  enabled: boolean;
  collectionInterval: number;
  retentionPeriod: number;
  alertingEnabled: boolean;
  alertThresholds: {
    [key in PerformanceMetricType]: {
      warning: number;
      critical: number;
      emergency: number;
    };
  };
  enableRealTimeAlerts: boolean;
  enableTrendAnalysis: boolean;
  enablePredictiveAnalysis: boolean;
  enableAnomalyDetection: boolean;
  anomalyDetectionSensitivity: number;
  trendAnalysisWindow: number;
  predictionWindow: number;
  enablePerformanceOptimization: boolean;
  autoOptimizationEnabled: boolean;
  optimizationThresholds: {
    maxLatency: number;
    maxErrorRate: number;
    minThroughput: number;
    maxResourceUtilization: number;
  };
}

/**
 * Performance data point
 */
export interface PerformanceDataPoint {
  timestamp: Date;
  type: PerformanceMetricType;
  value: number;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
  source?: string;
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  id: string;
  level: AlertLevel;
  type: PerformanceMetricType;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  source?: string;
  metadata?: Record<string, any>;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  duration?: number;
}

/**
 * Performance trend
 */
export interface PerformanceTrend {
  type: PerformanceMetricType;
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  confidence: number;
  dataPoints: number;
  timespan: number;
  forecast?: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  };
}

/**
 * Performance anomaly
 */
export interface PerformanceAnomaly {
  id: string;
  type: PerformanceMetricType;
  timestamp: Date;
  value: number;
  expected: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  description: string;
  impactEstimate: string;
  recommendation: string;
}

/**
 * Performance optimization recommendation
 */
export interface OptimizationRecommendation {
  id: string;
  type: 'scaling' | 'recycling' | 'configuration' | 'resource_management';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  expectedImprovement: number;
  confidence: number;
  timestamp: Date;
  applied: boolean;
  appliedAt?: Date;
  result?: {
    successful: boolean;
    actualImprovement: number;
    notes: string;
  };
}

/**
 * Performance summary
 */
export interface PerformanceSummary {
  period: {
    start: Date;
    end: Date;
    duration: number;
  };
  metrics: {
    [key in PerformanceMetricType]: {
      current: number;
      average: number;
      min: number;
      max: number;
      percentile95: number;
      percentile99: number;
      trend: 'improving' | 'degrading' | 'stable';
    };
  };
  alertsSummary: {
    total: number;
    byLevel: Record<AlertLevel, number>;
    active: number;
    resolved: number;
  };
  anomalies: {
    total: number;
    bySeverity: Record<'low' | 'medium' | 'high', number>;
  };
  recommendations: {
    total: number;
    byPriority: Record<'low' | 'medium' | 'high' | 'critical', number>;
    applied: number;
  };
  healthScore: number;
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Performance monitor for browser pool
 * @nist si-4 "Information system monitoring"
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class BrowserPoolPerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitoringConfig;
  private dataPoints: Map<PerformanceMetricType, PerformanceDataPoint[]> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private trends: Map<PerformanceMetricType, PerformanceTrend> = new Map();
  private anomalies: Map<string, PerformanceAnomaly> = new Map();
  private recommendations: Map<string, OptimizationRecommendation> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private analysisInterval?: NodeJS.Timeout;
  private readonly maxDataPoints = 10000;
  private readonly maxAnomalies = 1000;
  private readonly maxRecommendations = 100;
  private baselineMetrics: Map<PerformanceMetricType, number> = new Map();
  private lastOptimizationCheck = new Date(0);

  constructor(config: Partial<PerformanceMonitoringConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      collectionInterval: 5000, // 5 seconds
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      alertingEnabled: true,
      alertThresholds: {
        [PerformanceMetricType.LATENCY]: { warning: 1000, critical: 2000, emergency: 5000 },
        [PerformanceMetricType.THROUGHPUT]: { warning: 10, critical: 5, emergency: 1 },
        [PerformanceMetricType.ERROR_RATE]: { warning: 5, critical: 10, emergency: 20 },
        [PerformanceMetricType.RESOURCE_UTILIZATION]: { warning: 70, critical: 85, emergency: 95 },
        [PerformanceMetricType.AVAILABILITY]: { warning: 95, critical: 90, emergency: 85 },
        [PerformanceMetricType.RESPONSE_TIME]: { warning: 2000, critical: 5000, emergency: 10000 },
        [PerformanceMetricType.QUEUE_TIME]: { warning: 5000, critical: 10000, emergency: 30000 },
        [PerformanceMetricType.PROCESSING_TIME]: { warning: 1000, critical: 3000, emergency: 8000 },
      },
      enableRealTimeAlerts: true,
      enableTrendAnalysis: true,
      enablePredictiveAnalysis: true,
      enableAnomalyDetection: true,
      anomalyDetectionSensitivity: 0.7,
      trendAnalysisWindow: 60 * 60 * 1000, // 1 hour
      predictionWindow: 30 * 60 * 1000, // 30 minutes
      enablePerformanceOptimization: true,
      autoOptimizationEnabled: false,
      optimizationThresholds: {
        maxLatency: 2000,
        maxErrorRate: 10,
        minThroughput: 5,
        maxResourceUtilization: 80,
      },
      ...config,
    };

    this.initializeMetricMaps();
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
      {
        config: this.config,
      },
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
    metadata?: Record<string, any>,
    tags?: Record<string, string>,
    source?: string
  ): void {
    const dataPoint: PerformanceDataPoint = {
      timestamp: new Date(),
      type,
      value,
      metadata,
      tags,
      source,
    };

    this.addDataPoint(type, dataPoint);

    // Check for real-time alerts
    if (this.config.enableRealTimeAlerts && this.config.alertingEnabled) {
      this.checkRealTimeAlert(type, value);
    }

    // Check for anomalies
    if (this.config.enableAnomalyDetection) {
      this.checkAnomaly(type, value);
    }

    this.emit('metric-recorded', { type, value, metadata, tags, source });
  }

  /**
   * Get performance metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(
    type?: PerformanceMetricType,
    timeRange?: { start: Date; end: Date }
  ): Map<PerformanceMetricType, PerformanceDataPoint[]> {
    if (type) {
      const metrics = this.dataPoints.get(type) || [];
      const filtered = timeRange
        ? metrics.filter(dp => dp.timestamp >= timeRange.start && dp.timestamp <= timeRange.end)
        : metrics;
      return new Map([[type, filtered]]);
    }

    const result = new Map<PerformanceMetricType, PerformanceDataPoint[]>();
    for (const [metricType, metrics] of this.dataPoints) {
      const filtered = timeRange
        ? metrics.filter(dp => dp.timestamp >= timeRange.start && dp.timestamp <= timeRange.end)
        : metrics;
      result.set(metricType, filtered);
    }

    return result;
  }

  /**
   * Get active alerts
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get performance trends
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getTrends(): Map<PerformanceMetricType, PerformanceTrend> {
    return new Map(this.trends);
  }

  /**
   * Get anomalies
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getAnomalies(timeRange?: { start: Date; end: Date }): PerformanceAnomaly[] {
    const anomalies = Array.from(this.anomalies.values());
    return timeRange
      ? anomalies.filter(a => a.timestamp >= timeRange.start && a.timestamp <= timeRange.end)
      : anomalies;
  }

  /**
   * Get optimization recommendations
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getRecommendations(applied?: boolean): OptimizationRecommendation[] {
    const recommendations = Array.from(this.recommendations.values());
    return applied !== undefined
      ? recommendations.filter(r => r.applied === applied)
      : recommendations;
  }

  /**
   * Get performance summary
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getPerformanceSummary(timeRange?: { start: Date; end: Date }): PerformanceSummary {
    const end = timeRange?.end || new Date();
    const start = timeRange?.start || new Date(end.getTime() - 60 * 60 * 1000); // 1 hour default
    const duration = end.getTime() - start.getTime();

    const metrics = {} as PerformanceSummary['metrics'];
    
    for (const type of Object.values(PerformanceMetricType)) {
      const dataPoints = this.getMetrics(type, { start, end }).get(type) || [];
      const values = dataPoints.map(dp => dp.value);
      
      if (values.length > 0) {
        values.sort((a, b) => a - b);
        const percentile95 = values[Math.floor(values.length * 0.95)];
        const percentile99 = values[Math.floor(values.length * 0.99)];
        
        metrics[type] = {
          current: values[values.length - 1],
          average: values.reduce((sum, val) => sum + val, 0) / values.length,
          min: values[0],
          max: values[values.length - 1],
          percentile95,
          percentile99,
          trend: this.determineTrend(type),
        };
      }
    }

    const alerts = Array.from(this.alerts.values()).filter(
      alert => alert.timestamp >= start && alert.timestamp <= end
    );

    const alertsSummary = {
      total: alerts.length,
      byLevel: {
        [AlertLevel.INFO]: alerts.filter(a => a.level === AlertLevel.INFO).length,
        [AlertLevel.WARNING]: alerts.filter(a => a.level === AlertLevel.WARNING).length,
        [AlertLevel.CRITICAL]: alerts.filter(a => a.level === AlertLevel.CRITICAL).length,
        [AlertLevel.EMERGENCY]: alerts.filter(a => a.level === AlertLevel.EMERGENCY).length,
      },
      active: alerts.filter(a => !a.resolved).length,
      resolved: alerts.filter(a => a.resolved).length,
    };

    const anomalies = this.getAnomalies({ start, end });
    const anomaliesSummary = {
      total: anomalies.length,
      bySeverity: {
        low: anomalies.filter(a => a.severity === 'low').length,
        medium: anomalies.filter(a => a.severity === 'medium').length,
        high: anomalies.filter(a => a.severity === 'high').length,
      },
    };

    const recommendations = Array.from(this.recommendations.values()).filter(
      r => r.timestamp >= start && r.timestamp <= end
    );

    const recommendationsSummary = {
      total: recommendations.length,
      byPriority: {
        low: recommendations.filter(r => r.priority === 'low').length,
        medium: recommendations.filter(r => r.priority === 'medium').length,
        high: recommendations.filter(r => r.priority === 'high').length,
        critical: recommendations.filter(r => r.priority === 'critical').length,
      },
      applied: recommendations.filter(r => r.applied).length,
    };

    const healthScore = this.calculateHealthScore(metrics, alertsSummary, anomaliesSummary);
    const performanceGrade = this.calculatePerformanceGrade(healthScore);

    return {
      period: { start, end, duration },
      metrics,
      alertsSummary,
      anomalies: anomaliesSummary,
      recommendations: recommendationsSummary,
      healthScore,
      performanceGrade,
    };
  }

  /**
   * Acknowledge alert
   * @nist au-5 "Response to audit processing failures"
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Resolve alert
   * @nist au-5 "Response to audit processing failures"
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      alert.duration = alert.resolvedAt.getTime() - alert.timestamp.getTime();
      this.emit('alert-resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Apply optimization recommendation
   * @nist au-5 "Response to audit processing failures"
   */
  applyRecommendation(
    recommendationId: string,
    result: { successful: boolean; actualImprovement: number; notes: string }
  ): boolean {
    const recommendation = this.recommendations.get(recommendationId);
    if (recommendation && !recommendation.applied) {
      recommendation.applied = true;
      recommendation.appliedAt = new Date();
      recommendation.result = result;
      this.emit('recommendation-applied', recommendation);
      return true;
    }
    return false;
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
   * Initialize metric maps
   * @private
   */
  private initializeMetricMaps(): void {
    for (const type of Object.values(PerformanceMetricType)) {
      this.dataPoints.set(type, []);
    }
  }

  /**
   * Add data point
   * @private
   */
  private addDataPoint(type: PerformanceMetricType, dataPoint: PerformanceDataPoint): void {
    const points = this.dataPoints.get(type) || [];
    points.push(dataPoint);

    // Maintain max data points
    if (points.length > this.maxDataPoints) {
      points.shift();
    }

    this.dataPoints.set(type, points);
  }

  /**
   * Collect metrics
   * @private
   */
  private collectMetrics(): void {
    // This would be called by the main browser pool to provide metrics
    this.emit('metrics-collection-requested');
  }

  /**
   * Perform analysis
   * @private
   */
  private performAnalysis(): void {
    if (this.config.enableTrendAnalysis) {
      this.analyzeTrends();
    }

    if (this.config.enablePerformanceOptimization) {
      this.generateOptimizationRecommendations();
    }

    this.cleanupOldData();
  }

  /**
   * Check real-time alert
   * @private
   */
  private checkRealTimeAlert(type: PerformanceMetricType, value: number): void {
    const thresholds = this.config.alertThresholds[type];
    let level: AlertLevel | null = null;

    if (value >= thresholds.emergency) {
      level = AlertLevel.EMERGENCY;
    } else if (value >= thresholds.critical) {
      level = AlertLevel.CRITICAL;
    } else if (value >= thresholds.warning) {
      level = AlertLevel.WARNING;
    }

    if (level) {
      this.createAlert(type, level, value, thresholds[level]);
    }
  }

  /**
   * Check anomaly
   * @private
   */
  private checkAnomaly(type: PerformanceMetricType, value: number): void {
    const baseline = this.baselineMetrics.get(type);
    if (!baseline) {
      this.baselineMetrics.set(type, value);
      return;
    }

    const deviation = Math.abs(value - baseline) / baseline;
    if (deviation > this.config.anomalyDetectionSensitivity) {
      this.createAnomaly(type, value, baseline, deviation);
    }
  }

  /**
   * Create alert
   * @private
   */
  private createAlert(
    type: PerformanceMetricType,
    level: AlertLevel,
    value: number,
    threshold: number
  ): void {
    const alertId = `${type}-${level}-${Date.now()}`;
    const alert: PerformanceAlert = {
      id: alertId,
      level,
      type,
      message: `${type} ${level}: ${value} exceeds threshold ${threshold}`,
      value,
      threshold,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
    };

    this.alerts.set(alertId, alert);
    this.emit('alert-created', alert);

    logger.warn(
      {
        alert,
      },
      'Performance alert created'
    );
  }

  /**
   * Create anomaly
   * @private
   */
  private createAnomaly(
    type: PerformanceMetricType,
    value: number,
    expected: number,
    deviation: number
  ): void {
    const anomalyId = `${type}-${Date.now()}`;
    const severity = deviation > 2 ? 'high' : deviation > 1 ? 'medium' : 'low';
    
    const anomaly: PerformanceAnomaly = {
      id: anomalyId,
      type,
      timestamp: new Date(),
      value,
      expected,
      deviation,
      severity,
      confidence: Math.min(deviation * 0.5, 1),
      description: `${type} value ${value} deviates ${(deviation * 100).toFixed(1)}% from expected ${expected}`,
      impactEstimate: severity === 'high' ? 'Significant performance impact' : 'Minor performance impact',
      recommendation: this.getAnomalyRecommendation(type, severity),
    };

    this.anomalies.set(anomalyId, anomaly);
    this.emit('anomaly-detected', anomaly);

    // Maintain max anomalies
    if (this.anomalies.size > this.maxAnomalies) {
      const oldestId = this.anomalies.keys().next().value;
      this.anomalies.delete(oldestId);
    }
  }

  /**
   * Get anomaly recommendation
   * @private
   */
  private getAnomalyRecommendation(type: PerformanceMetricType, severity: string): string {
    const recommendations = {
      [PerformanceMetricType.LATENCY]: 'Check network connectivity and optimize request processing',
      [PerformanceMetricType.THROUGHPUT]: 'Scale up resources or optimize workload distribution',
      [PerformanceMetricType.ERROR_RATE]: 'Investigate error causes and implement error handling',
      [PerformanceMetricType.RESOURCE_UTILIZATION]: 'Monitor resource usage and consider scaling',
      [PerformanceMetricType.AVAILABILITY]: 'Check system health and implement redundancy',
      [PerformanceMetricType.RESPONSE_TIME]: 'Optimize processing logic and check resource constraints',
      [PerformanceMetricType.QUEUE_TIME]: 'Increase processing capacity or optimize queue management',
      [PerformanceMetricType.PROCESSING_TIME]: 'Profile and optimize processing algorithms',
    };

    return recommendations[type] || 'Monitor closely and investigate root cause';
  }

  /**
   * Analyze trends
   * @private
   */
  private analyzeTrends(): void {
    const window = this.config.trendAnalysisWindow;
    const cutoff = new Date(Date.now() - window);

    for (const [type, dataPoints] of this.dataPoints) {
      const recentPoints = dataPoints.filter(dp => dp.timestamp >= cutoff);
      if (recentPoints.length < 10) continue; // Need minimum data points

      const trend = this.calculateTrend(recentPoints);
      this.trends.set(type, trend);
    }
  }

  /**
   * Calculate trend
   * @private
   */
  private calculateTrend(dataPoints: PerformanceDataPoint[]): PerformanceTrend {
    const values = dataPoints.map(dp => dp.value);
    const n = values.length;
    
    // Linear regression for trend
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const direction = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
    
    // Calculate R-squared for confidence
    const avgY = sumY / n;
    const ssRes = values.reduce((sum, val, i) => {
      const pred = avgY + slope * (i - (n - 1) / 2);
      return sum + Math.pow(val - pred, 2);
    }, 0);
    const ssTot = values.reduce((sum, val) => sum + Math.pow(val - avgY, 2), 0);
    const confidence = Math.max(0, 1 - ssRes / ssTot);

    return {
      type: dataPoints[0].type,
      direction,
      slope,
      confidence,
      dataPoints: n,
      timespan: dataPoints[n - 1].timestamp.getTime() - dataPoints[0].timestamp.getTime(),
    };
  }

  /**
   * Generate optimization recommendations
   * @private
   */
  private generateOptimizationRecommendations(): void {
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - this.lastOptimizationCheck.getTime();
    
    // Check every 5 minutes
    if (timeSinceLastCheck < 5 * 60 * 1000) {
      return;
    }

    this.lastOptimizationCheck = now;

    // Analyze current performance
    const summary = this.getPerformanceSummary();
    const recommendations: OptimizationRecommendation[] = [];

    // Check latency
    const latencyMetric = summary.metrics[PerformanceMetricType.LATENCY];
    if (latencyMetric && latencyMetric.current > this.config.optimizationThresholds.maxLatency) {
      recommendations.push({
        id: `latency-opt-${Date.now()}`,
        type: 'configuration',
        priority: 'high',
        title: 'Optimize Latency',
        description: `Current latency ${latencyMetric.current}ms exceeds threshold ${this.config.optimizationThresholds.maxLatency}ms`,
        impact: 'Improve response times by 20-30%',
        implementation: 'Enable connection pooling and optimize request processing',
        expectedImprovement: 25,
        confidence: 0.8,
        timestamp: now,
        applied: false,
      });
    }

    // Check error rate
    const errorRateMetric = summary.metrics[PerformanceMetricType.ERROR_RATE];
    if (errorRateMetric && errorRateMetric.current > this.config.optimizationThresholds.maxErrorRate) {
      recommendations.push({
        id: `error-rate-opt-${Date.now()}`,
        type: 'recycling',
        priority: 'critical',
        title: 'Reduce Error Rate',
        description: `Current error rate ${errorRateMetric.current}% exceeds threshold ${this.config.optimizationThresholds.maxErrorRate}%`,
        impact: 'Reduce errors by 50-70%',
        implementation: 'Implement aggressive browser recycling and health checks',
        expectedImprovement: 60,
        confidence: 0.9,
        timestamp: now,
        applied: false,
      });
    }

    // Add recommendations
    for (const recommendation of recommendations) {
      this.recommendations.set(recommendation.id, recommendation);
      this.emit('recommendation-generated', recommendation);
    }

    // Maintain max recommendations
    if (this.recommendations.size > this.maxRecommendations) {
      const oldestId = this.recommendations.keys().next().value;
      this.recommendations.delete(oldestId);
    }
  }

  /**
   * Determine trend
   * @private
   */
  private determineTrend(type: PerformanceMetricType): 'improving' | 'degrading' | 'stable' {
    const trend = this.trends.get(type);
    if (!trend) return 'stable';

    if (trend.direction === 'increasing') {
      return type === PerformanceMetricType.THROUGHPUT || type === PerformanceMetricType.AVAILABILITY
        ? 'improving'
        : 'degrading';
    } else if (trend.direction === 'decreasing') {
      return type === PerformanceMetricType.THROUGHPUT || type === PerformanceMetricType.AVAILABILITY
        ? 'degrading'
        : 'improving';
    }

    return 'stable';
  }

  /**
   * Calculate health score
   * @private
   */
  private calculateHealthScore(
    metrics: any,
    alertsSummary: any,
    anomaliesSummary: any
  ): number {
    let score = 100;

    // Penalty for critical alerts
    score -= alertsSummary.byLevel[AlertLevel.CRITICAL] * 10;
    score -= alertsSummary.byLevel[AlertLevel.EMERGENCY] * 20;

    // Penalty for high-severity anomalies
    score -= anomaliesSummary.bySeverity.high * 5;
    score -= anomaliesSummary.bySeverity.medium * 2;

    // Bonus for good performance
    const latencyMetric = metrics[PerformanceMetricType.LATENCY];
    if (latencyMetric && latencyMetric.current < 500) {
      score += 5;
    }

    const errorRateMetric = metrics[PerformanceMetricType.ERROR_RATE];
    if (errorRateMetric && errorRateMetric.current < 1) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate performance grade
   * @private
   */
  private calculatePerformanceGrade(healthScore: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (healthScore >= 90) return 'A';
    if (healthScore >= 80) return 'B';
    if (healthScore >= 70) return 'C';
    if (healthScore >= 60) return 'D';
    return 'F';
  }

  /**
   * Clean up old data
   * @private
   */
  private cleanupOldData(): void {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod);

    // Clean up data points
    for (const [type, points] of this.dataPoints) {
      const filtered = points.filter(dp => dp.timestamp >= cutoff);
      this.dataPoints.set(type, filtered);
    }

    // Clean up resolved alerts
    for (const [id, alert] of this.alerts) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(id);
      }
    }

    // Clean up old anomalies
    for (const [id, anomaly] of this.anomalies) {
      if (anomaly.timestamp < cutoff) {
        this.anomalies.delete(id);
      }
    }
  }
}

/**
 * Default performance monitoring configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceMonitoringConfig = {
  enabled: true,
  collectionInterval: 5000,
  retentionPeriod: 24 * 60 * 60 * 1000,
  alertingEnabled: true,
  alertThresholds: {
    [PerformanceMetricType.LATENCY]: { warning: 1000, critical: 2000, emergency: 5000 },
    [PerformanceMetricType.THROUGHPUT]: { warning: 10, critical: 5, emergency: 1 },
    [PerformanceMetricType.ERROR_RATE]: { warning: 5, critical: 10, emergency: 20 },
    [PerformanceMetricType.RESOURCE_UTILIZATION]: { warning: 70, critical: 85, emergency: 95 },
    [PerformanceMetricType.AVAILABILITY]: { warning: 95, critical: 90, emergency: 85 },
    [PerformanceMetricType.RESPONSE_TIME]: { warning: 2000, critical: 5000, emergency: 10000 },
    [PerformanceMetricType.QUEUE_TIME]: { warning: 5000, critical: 10000, emergency: 30000 },
    [PerformanceMetricType.PROCESSING_TIME]: { warning: 1000, critical: 3000, emergency: 8000 },
  },
  enableRealTimeAlerts: true,
  enableTrendAnalysis: true,
  enablePredictiveAnalysis: true,
  enableAnomalyDetection: true,
  anomalyDetectionSensitivity: 0.7,
  trendAnalysisWindow: 60 * 60 * 1000,
  predictionWindow: 30 * 60 * 1000,
  enablePerformanceOptimization: true,
  autoOptimizationEnabled: false,
  optimizationThresholds: {
    maxLatency: 2000,
    maxErrorRate: 10,
    minThroughput: 5,
    maxResourceUtilization: 80,
  },
};