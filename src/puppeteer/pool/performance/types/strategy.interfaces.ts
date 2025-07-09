/**
 * Strategy interfaces for performance monitoring components
 * @module puppeteer/pool/performance/types/strategy
 */

import type { EventEmitter } from 'events';
import type {
  PerformanceMetricType,
  PerformanceDataPoint,
  PerformanceAlert,
  PerformanceTrend,
  PerformanceAnomaly,
  OptimizationRecommendation,
  PerformanceSummary,
  TimeRange,
  PerformanceMonitoringConfig,
} from './performance-monitor.types.js';

/**
 * Base strategy interface with access to monitor context
 */
export interface IPerformanceStrategy {
  readonly monitor: EventEmitter;
  readonly config: PerformanceMonitoringConfig;
}

/**
 * Metrics collection strategy
 */
export interface IMetricsCollector extends IPerformanceStrategy {
  recordMetric(
    type: PerformanceMetricType,
    value: number,
    metadata?: Record<string, any>,
    tags?: Record<string, string>,
    source?: string
  ): void;
  
  getMetrics(
    type?: PerformanceMetricType,
    timeRange?: TimeRange
  ): Map<PerformanceMetricType, PerformanceDataPoint[]>;
  
  cleanupOldData(retentionPeriod: number): void;
  
  initializeMetricMaps(): void;
}

/**
 * Alert management strategy
 */
export interface IAlertManager extends IPerformanceStrategy {
  checkRealTimeAlert(type: PerformanceMetricType, value: number): void;
  
  getActiveAlerts(): PerformanceAlert[];
  
  acknowledgeAlert(alertId: string): boolean;
  
  resolveAlert(alertId: string): boolean;
  
  cleanupResolvedAlerts(retentionPeriod: number): void;
}

/**
 * Trend analysis strategy
 */
export interface ITrendAnalyzer extends IPerformanceStrategy {
  analyzeTrends(dataPoints: Map<PerformanceMetricType, PerformanceDataPoint[]>): void;
  
  getTrends(): Map<PerformanceMetricType, PerformanceTrend>;
  
  determineTrend(type: PerformanceMetricType): 'improving' | 'degrading' | 'stable';
  
  calculateTrend(dataPoints: PerformanceDataPoint[]): PerformanceTrend;
}

/**
 * Anomaly detection strategy
 */
export interface IAnomalyDetector extends IPerformanceStrategy {
  checkAnomaly(type: PerformanceMetricType, value: number): void;
  
  getAnomalies(timeRange?: TimeRange): PerformanceAnomaly[];
  
  cleanupOldAnomalies(retentionPeriod: number): void;
  
  updateBaseline(type: PerformanceMetricType, value: number): void;
}

/**
 * Optimization engine strategy
 */
export interface IOptimizationEngine extends IPerformanceStrategy {
  generateRecommendations(summary: PerformanceSummary): void;
  
  getRecommendations(applied?: boolean): OptimizationRecommendation[];
  
  applyRecommendation(
    recommendationId: string,
    result: { successful: boolean; actualImprovement: number; notes: string }
  ): boolean;
  
  shouldGenerateRecommendations(): boolean;
}

/**
 * Performance calculations utility interface
 */
export interface IPerformanceCalculations {
  calculateHealthScore(
    metrics: any,
    alertsSummary: any,
    anomaliesSummary: any
  ): number;
  
  calculatePerformanceGrade(healthScore: number): 'A' | 'B' | 'C' | 'D' | 'F';
  
  calculateStatistics(values: number[]): {
    average: number;
    min: number;
    max: number;
    percentile95: number;
    percentile99: number;
  };
}