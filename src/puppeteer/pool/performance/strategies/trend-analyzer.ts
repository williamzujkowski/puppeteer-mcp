/**
 * Trend analysis strategy for performance monitoring
 * @module puppeteer/pool/performance/strategies/trend-analyzer
 * @nist si-4 "Information system monitoring"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { EventEmitter } from 'events';
import type {
  PerformanceMetricType,
  PerformanceDataPoint,
  PerformanceTrend,
  PerformanceMonitoringConfig,
} from '../types/performance-monitor.types.js';
import type { ITrendAnalyzer } from '../types/strategy.interfaces.js';

/**
 * Trend analysis strategy implementation
 */
export class TrendAnalyzer implements ITrendAnalyzer {
  readonly monitor: EventEmitter;
  readonly config: PerformanceMonitoringConfig;
  
  private trends: Map<PerformanceMetricType, PerformanceTrend> = new Map();

  constructor(monitor: EventEmitter, config: PerformanceMonitoringConfig) {
    this.monitor = monitor;
    this.config = config;
  }

  /**
   * Analyze trends for all metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  analyzeTrends(dataPoints: Map<PerformanceMetricType, PerformanceDataPoint[]>): void {
    if (!this.config.enableTrendAnalysis) {
      return;
    }

    const window = this.config.trendAnalysisWindow;
    const cutoff = new Date(Date.now() - window);

    for (const [type, allPoints] of dataPoints) {
      const recentPoints = allPoints.filter(dp => dp.timestamp >= cutoff);
      
      // Need minimum data points for reliable trend analysis
      if (recentPoints.length < 10) {
        continue;
      }

      const trend = this.calculateTrend(recentPoints);
      this.trends.set(type, trend);
      
      this.monitor.emit('trend-analyzed', { type, trend });
    }
  }

  /**
   * Get all calculated trends
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getTrends(): Map<PerformanceMetricType, PerformanceTrend> {
    return new Map(this.trends);
  }

  /**
   * Determine if a trend is improving, degrading, or stable
   */
  determineTrend(type: PerformanceMetricType): 'improving' | 'degrading' | 'stable' {
    const trend = this.trends.get(type);
    if (!trend) {
      return 'stable';
    }

    if (trend.direction === 'increasing') {
      // For throughput and availability, increasing is good
      return type === PerformanceMetricType.THROUGHPUT || type === PerformanceMetricType.AVAILABILITY
        ? 'improving'
        : 'degrading';
    } else if (trend.direction === 'decreasing') {
      // For throughput and availability, decreasing is bad
      return type === PerformanceMetricType.THROUGHPUT || type === PerformanceMetricType.AVAILABILITY
        ? 'degrading'
        : 'improving';
    }

    return 'stable';
  }

  /**
   * Calculate trend using linear regression
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  calculateTrend(dataPoints: PerformanceDataPoint[]): PerformanceTrend {
    const values = dataPoints.map(dp => dp.value);
    const n = values.length;
    
    if (n < 2) {
      return this.createDefaultTrend(dataPoints[0]);
    }
    
    // Linear regression for trend calculation
    const sumX = (n * (n - 1)) / 2; // Sum of indices 0, 1, 2, ..., n-1
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares of indices

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const direction = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
    
    // Calculate R-squared for confidence measure
    const avgY = sumY / n;
    const ssRes = values.reduce((sum, val, i) => {
      const pred = avgY + slope * (i - (n - 1) / 2);
      return sum + Math.pow(val - pred, 2);
    }, 0);
    
    const ssTot = values.reduce((sum, val) => sum + Math.pow(val - avgY, 2), 0);
    const confidence = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

    const timespan = dataPoints[n - 1].timestamp.getTime() - dataPoints[0].timestamp.getTime();

    const trend: PerformanceTrend = {
      type: dataPoints[0].type,
      direction,
      slope,
      confidence,
      dataPoints: n,
      timespan,
    };

    // Add forecasting if enabled
    if (this.config.enablePredictiveAnalysis && confidence > 0.5) {
      trend.forecast = this.generateForecast(values, slope, avgY);
    }

    return trend;
  }

  /**
   * Get trend for a specific metric type
   */
  getTrendForMetric(type: PerformanceMetricType): PerformanceTrend | undefined {
    return this.trends.get(type);
  }

  /**
   * Check if a metric has a significant trend
   */
  hasSignificantTrend(type: PerformanceMetricType, minimumConfidence = 0.7): boolean {
    const trend = this.trends.get(type);
    return trend ? trend.confidence >= minimumConfidence && trend.direction !== 'stable' : false;
  }

  /**
   * Get metrics with deteriorating trends
   */
  getDeterioratingMetrics(): PerformanceMetricType[] {
    const deteriorating: PerformanceMetricType[] = [];
    
    for (const [type, trend] of this.trends) {
      if (this.determineTrend(type) === 'degrading' && trend.confidence > 0.6) {
        deteriorating.push(type);
      }
    }
    
    return deteriorating;
  }

  /**
   * Get trend summary for reporting
   */
  getTrendSummary(): {
    totalMetrics: number;
    improving: number;
    degrading: number;
    stable: number;
    highConfidence: number;
  } {
    const totalMetrics = this.trends.size;
    let improving = 0;
    let degrading = 0;
    let stable = 0;
    let highConfidence = 0;

    for (const [type, trend] of this.trends) {
      const trendDirection = this.determineTrend(type);
      
      switch (trendDirection) {
        case 'improving':
          improving++;
          break;
        case 'degrading':
          degrading++;
          break;
        case 'stable':
          stable++;
          break;
      }

      if (trend.confidence > 0.8) {
        highConfidence++;
      }
    }

    return {
      totalMetrics,
      improving,
      degrading,
      stable,
      highConfidence,
    };
  }

  /**
   * Generate forecast based on trend
   * @private
   */
  private generateForecast(values: number[], slope: number, avgY: number): {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  } {
    const n = values.length;
    const currentPoint = values[n - 1];
    
    // Project forward based on slope and current trend
    const shortTermSteps = 5; // ~5 data points ahead
    const mediumTermSteps = 20; // ~20 data points ahead  
    const longTermSteps = 50; // ~50 data points ahead
    
    return {
      shortTerm: Math.max(0, currentPoint + slope * shortTermSteps),
      mediumTerm: Math.max(0, currentPoint + slope * mediumTermSteps),
      longTerm: Math.max(0, currentPoint + slope * longTermSteps),
    };
  }

  /**
   * Create default trend for insufficient data
   * @private
   */
  private createDefaultTrend(dataPoint: PerformanceDataPoint): PerformanceTrend {
    return {
      type: dataPoint.type,
      direction: 'stable',
      slope: 0,
      confidence: 0,
      dataPoints: 1,
      timespan: 0,
    };
  }

  /**
   * Clear old trends
   */
  clearTrends(): void {
    this.trends.clear();
  }

  /**
   * Check if trends indicate system stress
   */
  indicatesSystemStress(): boolean {
    const deterioratingMetrics = this.getDeterioratingMetrics();
    const criticalMetrics = [
      PerformanceMetricType.ERROR_RATE,
      PerformanceMetricType.LATENCY,
      PerformanceMetricType.RESPONSE_TIME,
    ];

    // System stress if multiple critical metrics are deteriorating
    return deterioratingMetrics.filter(metric => criticalMetrics.includes(metric)).length >= 2;
  }
}