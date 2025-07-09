/**
 * Ideal pool size calculator
 * @module puppeteer/pool/scaling/ideal-size-calculator
 * @nist cm-2 "Baseline configuration"
 */

import type { ScalingMetrics, BrowserPoolScalingStrategy } from './types.js';

/**
 * Calculates ideal pool size based on various factors
 */
export class IdealSizeCalculator {
  constructor(private strategy: BrowserPoolScalingStrategy) {}

  /**
   * Calculate ideal pool size based on metrics
   */
  calculateIdealSize(metrics: ScalingMetrics): number {
    const {
      currentSize,
      utilization,
      queueLength,
      responseTime,
      memoryPressure,
      cpuPressure,
      trend,
    } = metrics;

    // Start with current size
    let idealSize = currentSize;

    // Factor 1: Utilization-based sizing
    const utilizationFactor = this.calculateUtilizationFactor(utilization);
    idealSize = Math.ceil(currentSize * utilizationFactor);

    // Factor 2: Queue pressure
    if (queueLength > 0) {
      const queueFactor = Math.min(queueLength / 2, this.strategy.maxScaleStep);
      idealSize += Math.ceil(queueFactor);
    }

    // Factor 3: Response time pressure
    if (responseTime > 5000) {
      // 5 seconds
      const responseFactor = Math.min((responseTime - 5000) / 5000, 1);
      idealSize += Math.ceil(responseFactor * 2);
    }

    // Factor 4: Trend adjustment
    idealSize = this.adjustForTrend(idealSize, currentSize, trend);

    // Factor 5: Resource constraints
    idealSize = this.applyResourceConstraints(idealSize, memoryPressure, cpuPressure);

    // Apply bounds
    return Math.max(this.strategy.minSize, Math.min(this.strategy.maxSize, idealSize));
  }

  /**
   * Calculate utilization factor for sizing
   */
  private calculateUtilizationFactor(utilization: number): number {
    const target = this.strategy.targetUtilization;

    if (utilization < 1) {
      return 1; // Avoid division by zero
    }

    // Calculate factor to reach target utilization
    return utilization / target;
  }

  /**
   * Adjust size based on trend
   */
  private adjustForTrend(
    idealSize: number,
    currentSize: number,
    trend: 'stable' | 'increasing' | 'decreasing' | 'volatile',
  ): number {
    switch (trend) {
      case 'increasing':
        // Add buffer for increasing load
        return idealSize + Math.min(2, this.strategy.maxScaleStep);

      case 'decreasing':
        // Be conservative when decreasing
        return Math.max(idealSize - 1, currentSize - 1);

      case 'volatile':
        // Keep some buffer for volatile loads
        return Math.max(idealSize, currentSize);

      default:
        return idealSize;
    }
  }

  /**
   * Apply resource constraints to ideal size
   */
  private applyResourceConstraints(
    idealSize: number,
    memoryPressure: number,
    cpuPressure: number,
  ): number {
    // If memory pressure is high, limit growth
    if (memoryPressure > this.strategy.memoryThreshold) {
      const memoryFactor = (100 - memoryPressure) / 100;
      idealSize = Math.floor(idealSize * memoryFactor);
    }

    // If CPU pressure is high, limit growth
    if (cpuPressure > this.strategy.cpuThreshold) {
      const cpuFactor = (100 - cpuPressure) / 100;
      idealSize = Math.floor(idealSize * cpuFactor);
    }

    return idealSize;
  }

  /**
   * Update strategy
   */
  updateStrategy(strategy: BrowserPoolScalingStrategy): void {
    this.strategy = strategy;
  }
}
