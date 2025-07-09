/**
 * Scaling decision maker
 * @module puppeteer/pool/scaling/decision-maker
 * @nist si-4 "Information system monitoring"
 * @nist cm-2 "Baseline configuration"
 */

import type {
  BrowserPoolScalingStrategy,
  ScalingMetrics,
  ScalingDecisionResult,
  ScalingTrend,
} from './types.js';
import { ScalingDecision } from './types.js';

/**
 * Makes scaling decisions based on metrics
 */
export class ScalingDecisionMaker {
  constructor(private strategy: BrowserPoolScalingStrategy) {}

  /**
   * Make scaling decision based on metrics
   */
  makeDecision(metrics: ScalingMetrics, inCooldown: boolean): ScalingDecisionResult {
    // Check emergency conditions first
    const emergencyDecision = this.checkEmergencyConditions(metrics);
    if (emergencyDecision) {
      return emergencyDecision;
    }

    // Check resource pressure
    const resourceDecision = this.checkResourcePressure(metrics);
    if (resourceDecision) {
      return resourceDecision;
    }

    // Check cooldown
    if (inCooldown) {
      return this.createDecision(
        ScalingDecision.MAINTAIN,
        metrics.currentSize,
        'In cooldown period',
        100,
      );
    }

    // Check normal scaling conditions
    return this.checkNormalScalingConditions(metrics);
  }

  /**
   * Check for emergency scaling conditions
   */
  private checkEmergencyConditions(metrics: ScalingMetrics): ScalingDecisionResult | null {
    const { currentSize, utilization, queueLength, errorRate } = metrics;

    if (queueLength > 10 && utilization > 95) {
      return this.createDecision(
        ScalingDecision.EMERGENCY_SCALE_UP,
        Math.min(currentSize + this.strategy.maxScaleStep, this.strategy.maxSize),
        'Emergency scaling due to high queue length and utilization',
        95,
      );
    }

    if (errorRate > 20 && utilization > 90) {
      return this.createDecision(
        ScalingDecision.EMERGENCY_SCALE_UP,
        Math.min(currentSize + 2, this.strategy.maxSize),
        'Emergency scaling due to high error rate',
        90,
      );
    }

    return null;
  }

  /**
   * Check for resource pressure conditions
   */
  private checkResourcePressure(metrics: ScalingMetrics): ScalingDecisionResult | null {
    const { currentSize, memoryPressure, cpuPressure } = metrics;

    if (memoryPressure > 95 || cpuPressure > 95) {
      return this.createDecision(
        ScalingDecision.FORCE_SCALE_DOWN,
        Math.max(currentSize - 1, this.strategy.minSize),
        'Force scale down due to resource pressure',
        85,
      );
    }

    return null;
  }

  /**
   * Check normal scaling conditions
   */
  private checkNormalScalingConditions(metrics: ScalingMetrics): ScalingDecisionResult {
    const { currentSize, utilization, queueLength, trend } = metrics;

    // Scale up conditions
    if (this.shouldScaleUp(utilization, trend)) {
      const scaleStep = this.calculateScaleStep(utilization);
      return this.createDecision(
        ScalingDecision.SCALE_UP,
        Math.min(currentSize + scaleStep, this.strategy.maxSize),
        `High utilization (${utilization}%) or increasing trend`,
        80,
      );
    }

    // Scale down conditions
    if (this.shouldScaleDown(utilization, queueLength, trend, currentSize)) {
      return this.createDecision(
        ScalingDecision.SCALE_DOWN,
        Math.max(currentSize - 1, this.strategy.minSize),
        `Low utilization (${utilization}%) and no queue`,
        70,
      );
    }

    // Maintain current size
    return this.createDecision(
      ScalingDecision.MAINTAIN,
      currentSize,
      'Metrics within acceptable range',
      60,
    );
  }

  /**
   * Check if should scale up
   */
  private shouldScaleUp(utilization: number, trend: ScalingTrend): boolean {
    return (
      utilization > this.strategy.scaleUpThreshold ||
      (trend === 'increasing' && utilization > this.strategy.targetUtilization)
    );
  }

  /**
   * Check if should scale down
   */
  private shouldScaleDown(
    utilization: number,
    queueLength: number,
    trend: ScalingTrend,
    currentSize: number,
  ): boolean {
    return (
      utilization < this.strategy.scaleDownThreshold &&
      queueLength === 0 &&
      trend !== 'increasing' &&
      currentSize > this.strategy.minSize
    );
  }

  /**
   * Calculate scale step based on utilization
   */
  private calculateScaleStep(utilization: number): number {
    if (!this.strategy.aggressiveScaling) {
      return 1;
    }
    return Math.min(
      this.strategy.maxScaleStep,
      Math.ceil((utilization - this.strategy.targetUtilization) / 20),
    );
  }

  /**
   * Create scaling decision object
   */
  private createDecision(
    decision: ScalingDecision,
    targetSize: number,
    reason: string,
    confidence: number,
  ): ScalingDecisionResult {
    return { decision, targetSize, reason, confidence };
  }

  /**
   * Update strategy
   */
  updateStrategy(strategy: BrowserPoolScalingStrategy): void {
    this.strategy = strategy;
  }
}
