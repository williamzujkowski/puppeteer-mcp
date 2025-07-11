/**
 * Performance calculation utilities
 * @module puppeteer/pool/performance/utils/performance-calculations
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { PerformanceMetricType, AlertLevel } from '../types/performance-monitor.types.js';
import type { IPerformanceCalculations } from '../types/strategy.interfaces.js';

/**
 * Performance calculations utility implementation
 */
export class PerformanceCalculations implements IPerformanceCalculations {
  /**
   * Calculate overall health score based on metrics and alerts
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  calculateHealthScore(metrics: any, alertsSummary: any, anomaliesSummary: any): number {
    let score = 100;

    // Apply penalties for alerts
    score -= this.calculateAlertPenalty(alertsSummary);

    // Apply penalties for anomalies
    score -= this.calculateAnomalyPenalty(anomaliesSummary);

    // Apply bonuses for good performance
    score += this.calculatePerformanceBonus(metrics);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate performance grade based on health score
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  calculatePerformanceGrade(healthScore: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (healthScore >= 90) return 'A';
    if (healthScore >= 80) return 'B';
    if (healthScore >= 70) return 'C';
    if (healthScore >= 60) return 'D';
    return 'F';
  }

  /**
   * Calculate statistical metrics for a set of values
   */
  calculateStatistics(values: number[]): {
    average: number;
    min: number;
    max: number;
    percentile95: number;
    percentile99: number;
  } {
    if (values.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        percentile95: 0,
        percentile99: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      average: sum / values.length,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      percentile95: this.calculatePercentile(sorted, 95),
      percentile99: this.calculatePercentile(sorted, 99),
    };
  }

  /**
   * Calculate percentage improvement between two values
   */
  calculateImprovement(oldValue: number, newValue: number): number {
    if (oldValue === 0) return 0;
    return ((oldValue - newValue) / oldValue) * 100;
  }

  /**
   * Calculate trend strength (0-1 scale)
   */
  calculateTrendStrength(dataPoints: number[]): number {
    if (dataPoints.length < 3) return 0;

    const n = dataPoints.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = dataPoints;

    // Calculate correlation coefficient
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * (y[i] ?? 0), 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : Math.abs(numerator / denominator);
  }

  /**
   * Calculate system stress level (0-1 scale)
   */
  calculateSystemStress(errorRate: number, latency: number, resourceUtilization: number): number {
    // Normalize each metric to 0-1 scale based on typical thresholds
    const normalizedError = Math.min(errorRate / 20, 1); // 20% error rate = max stress
    const normalizedLatency = Math.min(latency / 5000, 1); // 5000ms latency = max stress
    const normalizedResource = Math.min(resourceUtilization / 100, 1); // 100% utilization = max stress

    // Weighted average with error rate being most important
    return normalizedError * 0.5 + normalizedLatency * 0.3 + normalizedResource * 0.2;
  }

  /**
   * Calculate efficiency score based on throughput and resource usage
   */
  calculateEfficiencyScore(throughput: number, resourceUtilization: number): number {
    if (resourceUtilization === 0) return 0;

    // Efficiency = throughput per unit of resource utilization
    const efficiency = throughput / (resourceUtilization / 100);

    // Normalize to 0-100 scale (assuming good efficiency is around 50)
    return Math.min((efficiency / 50) * 100, 100);
  }

  /**
   * Calculate alert penalty for health score
   * @private
   */
  private calculateAlertPenalty(alertsSummary: any): number {
    let penalty = 0;

    if (alertsSummary?.byLevel) {
      penalty += (alertsSummary.byLevel[AlertLevel.WARNING] || 0) * 2;
      penalty += (alertsSummary.byLevel[AlertLevel.CRITICAL] || 0) * 10;
      penalty += (alertsSummary.byLevel[AlertLevel.EMERGENCY] || 0) * 20;
    }

    return Math.min(penalty, 50); // Cap penalty at 50 points
  }

  /**
   * Calculate anomaly penalty for health score
   * @private
   */
  private calculateAnomalyPenalty(anomaliesSummary: any): number {
    let penalty = 0;

    if (anomaliesSummary?.bySeverity) {
      penalty += (anomaliesSummary.bySeverity.low || 0) * 0.5;
      penalty += (anomaliesSummary.bySeverity.medium || 0) * 2;
      penalty += (anomaliesSummary.bySeverity.high || 0) * 5;
    }

    return Math.min(penalty, 30); // Cap penalty at 30 points
  }

  /**
   * Calculate performance bonus for health score
   * @private
   */
  private calculatePerformanceBonus(metrics: any): number {
    let bonus = 0;

    // Bonus for good latency (< 500ms)
    const latencyMetric = metrics[PerformanceMetricType.LATENCY];
    if (latencyMetric && latencyMetric.current < 500) {
      bonus += 5;
    }

    // Bonus for low error rate (< 1%)
    const errorRateMetric = metrics[PerformanceMetricType.ERROR_RATE];
    if (errorRateMetric && errorRateMetric.current < 1) {
      bonus += 5;
    }

    // Bonus for high availability (> 99%)
    const availabilityMetric = metrics[PerformanceMetricType.AVAILABILITY];
    if (availabilityMetric && availabilityMetric.current > 99) {
      bonus += 3;
    }

    // Bonus for good throughput (> 20)
    const throughputMetric = metrics[PerformanceMetricType.THROUGHPUT];
    if (throughputMetric && throughputMetric.current > 20) {
      bonus += 2;
    }

    return Math.min(bonus, 15); // Cap bonus at 15 points
  }

  /**
   * Calculate percentile value from sorted array
   * @private
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower] ?? 0;
    }

    const weight = index - lower;
    const lowerValue = sortedValues[lower] ?? 0;
    const upperValue = sortedValues[upper] ?? 0;
    return lowerValue * (1 - weight) + upperValue * weight;
  }
}
