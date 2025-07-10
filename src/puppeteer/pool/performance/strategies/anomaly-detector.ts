/**
 * Anomaly detection strategy for performance monitoring
 * @module puppeteer/pool/performance/strategies/anomaly-detector
 * @nist si-4 "Information system monitoring"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { EventEmitter } from 'events';
import type {
  PerformanceAnomaly,
  TimeRange,
  PerformanceMonitoringConfig,
} from '../types/performance-monitor.types.js';
import { PerformanceMetricType } from '../types/performance-monitor.types.js';
import type { IAnomalyDetector } from '../types/strategy.interfaces.js';

/**
 * Anomaly detection strategy implementation
 */
export class AnomalyDetector implements IAnomalyDetector {
  readonly monitor: EventEmitter;
  readonly config: PerformanceMonitoringConfig;
  
  private anomalies: Map<string, PerformanceAnomaly> = new Map();
  private baselineMetrics: Map<PerformanceMetricType, number> = new Map();
  private readonly maxAnomalies = 1000;

  constructor(monitor: EventEmitter, config: PerformanceMonitoringConfig) {
    this.monitor = monitor;
    this.config = config;
  }

  /**
   * Check for anomalies in metric values
   * @nist si-4 "Information system monitoring"
   */
  checkAnomaly(type: PerformanceMetricType, value: number): void {
    if (!this.config.enableAnomalyDetection) {
      return;
    }

    const baseline = this.baselineMetrics.get(type);
    if (!baseline) {
      this.updateBaseline(type, value);
      return;
    }

    const deviation = Math.abs(value - baseline) / baseline;
    if (deviation > this.config.anomalyDetectionSensitivity) {
      this.createAnomaly(type, value, baseline, deviation);
    }

    // Update baseline with exponential moving average
    this.updateBaselineWithEMA(type, value);
  }

  /**
   * Get anomalies within optional time range
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getAnomalies(timeRange?: TimeRange): PerformanceAnomaly[] {
    const anomalies = Array.from(this.anomalies.values());
    return timeRange
      ? anomalies.filter(a => a.timestamp >= timeRange.start && a.timestamp <= timeRange.end)
      : anomalies;
  }

  /**
   * Clean up old anomalies based on retention period
   */
  cleanupOldAnomalies(retentionPeriod: number): void {
    const cutoff = new Date(Date.now() - retentionPeriod);

    for (const [id, anomaly] of this.anomalies) {
      if (anomaly.timestamp < cutoff) {
        this.anomalies.delete(id);
      }
    }
  }

  /**
   * Update baseline for a metric type
   */
  updateBaseline(type: PerformanceMetricType, value: number): void {
    this.baselineMetrics.set(type, value);
  }

  /**
   * Get current baselines
   */
  getBaselines(): Map<PerformanceMetricType, number> {
    return new Map(this.baselineMetrics);
  }

  /**
   * Get anomalies for a specific metric type
   */
  getAnomaliesForMetric(type: PerformanceMetricType): PerformanceAnomaly[] {
    return Array.from(this.anomalies.values()).filter(anomaly => anomaly.type === type);
  }

  /**
   * Get recent anomalies (last hour)
   */
  getRecentAnomalies(): PerformanceAnomaly[] {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.getAnomalies({ start: oneHourAgo, end: new Date() });
  }

  /**
   * Get high-severity anomalies
   */
  getHighSeverityAnomalies(): PerformanceAnomaly[] {
    return Array.from(this.anomalies.values()).filter(anomaly => anomaly.severity === 'high');
  }

  /**
   * Get anomaly statistics
   */
  getAnomalyStatistics(): {
    total: number;
    bySeverity: Record<'low' | 'medium' | 'high', number>;
    byType: Record<string, number>;
    recent: number;
  } {
    const anomalies = Array.from(this.anomalies.values());
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const bySeverity = {
      low: 0,
      medium: 0,
      high: 0,
    };
    
    const byType: Record<string, number> = {};
    
    for (const anomaly of anomalies) {
      bySeverity[anomaly.severity]++;
      byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
    }

    return {
      total: anomalies.length,
      bySeverity,
      byType,
      recent: anomalies.filter(a => a.timestamp >= oneHourAgo).length,
    };
  }

  /**
   * Check if system has concerning anomaly patterns
   */
  hasAnomalyPattern(): boolean {
    const recentAnomalies = this.getRecentAnomalies();
    const highSeverityCount = recentAnomalies.filter(a => a.severity === 'high').length;
    
    // Concerning if multiple high-severity anomalies in recent period
    return highSeverityCount >= 3 || recentAnomalies.length >= 10;
  }

  /**
   * Reset baselines (useful for system restart or major changes)
   */
  resetBaselines(): void {
    this.baselineMetrics.clear();
    this.monitor.emit('baselines-reset');
  }

  /**
   * Get baseline for specific metric
   */
  getBaseline(type: PerformanceMetricType): number | undefined {
    return this.baselineMetrics.get(type);
  }

  /**
   * Create a new anomaly
   * @private
   */
  private createAnomaly(
    type: PerformanceMetricType,
    value: number,
    expected: number,
    deviation: number
  ): void {
    const anomalyId = `${type}-${Date.now()}`;
    const severity = this.calculateSeverity(deviation);
    
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
      impactEstimate: this.getImpactEstimate(severity),
      recommendation: this.getAnomalyRecommendation(type, severity),
    };

    this.anomalies.set(anomalyId, anomaly);
    this.monitor.emit('anomaly-detected', anomaly);

    // Maintain max anomalies to prevent memory issues
    if (this.anomalies.size > this.maxAnomalies) {
      const oldestId = this.anomalies.keys().next().value;
      if (oldestId !== undefined) {
        this.anomalies.delete(oldestId);
      }
    }
  }

  /**
   * Calculate severity based on deviation
   * @private
   */
  private calculateSeverity(deviation: number): 'low' | 'medium' | 'high' {
    if (deviation > 2) return 'high';
    if (deviation > 1) return 'medium';
    return 'low';
  }

  /**
   * Get impact estimate based on severity
   * @private
   */
  private getImpactEstimate(severity: 'low' | 'medium' | 'high'): string {
    switch (severity) {
      case 'high':
        return 'Significant performance impact expected';
      case 'medium':
        return 'Moderate performance impact possible';
      case 'low':
        return 'Minor performance impact';
      default:
        return 'Impact assessment needed';
    }
  }

  /**
   * Get recommendation for anomaly
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

    const baseRecommendation = recommendations[type] || 'Monitor closely and investigate root cause';
    
    if (severity === 'high') {
      return `URGENT: ${baseRecommendation}`;
    }
    
    return baseRecommendation;
  }

  /**
   * Update baseline using exponential moving average
   * @private
   */
  private updateBaselineWithEMA(type: PerformanceMetricType, value: number): void {
    const currentBaseline = this.baselineMetrics.get(type);
    if (currentBaseline !== undefined) {
      // Use EMA with alpha = 0.1 for smooth baseline updates
      const alpha = 0.1;
      const newBaseline = alpha * value + (1 - alpha) * currentBaseline;
      this.baselineMetrics.set(type, newBaseline);
    }
  }
}