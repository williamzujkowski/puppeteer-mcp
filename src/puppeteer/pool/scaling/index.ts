/**
 * Browser pool scaling manager
 * @module puppeteer/pool/scaling
 * @nist cm-2 "Baseline configuration"
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 */

import { createLogger, logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';
import type { BrowserPoolOptions } from '../../interfaces/browser-pool.interface.js';
import type { BrowserPoolMetrics as IMetrics } from '../browser-pool-metrics.js';
import {
  BrowserPoolScalingStrategy,
  ScalingEvent,
  DEFAULT_STRATEGIES,
  ScalingMetrics,
  ScalingDecision,
} from './types.js';
import { ScalingMetricsCalculator } from './metrics-calculator.js';
import { ScalingDecisionMaker } from './decision-maker.js';
import { IdealSizeCalculator } from './ideal-size-calculator.js';

export type {
  BrowserPoolScalingStrategy,
  ScalingEvent,
  ScalingMetrics,
};
export {
  ScalingDecision,
  DEFAULT_STRATEGIES,
};

const logger = createLogger('browser-pool-scaling');

/**
 * Browser pool scaling manager
 * @nist cm-2 "Baseline configuration"
 * @nist si-4 "Information system monitoring"
 */
export class BrowserPoolScaling {
  private strategy: BrowserPoolScalingStrategy;
  private metricsCalculator: ScalingMetricsCalculator;
  private decisionMaker: ScalingDecisionMaker;
  private idealSizeCalculator: IdealSizeCalculator;
  private scalingHistory: ScalingEvent[] = [];
  private lastScalingTime = 0;

  constructor(strategy: 'conservative' | 'balanced' | 'aggressive' | BrowserPoolScalingStrategy) {
    this.strategy = typeof strategy === 'string' ? this.getDefaultStrategy(strategy) : strategy;

    this.metricsCalculator = new ScalingMetricsCalculator();
    this.decisionMaker = new ScalingDecisionMaker(this.strategy);
    this.idealSizeCalculator = new IdealSizeCalculator(this.strategy);

    logger.info({
      msg: 'Browser pool scaling initialized',
      strategy: typeof strategy === 'string' ? strategy : 'custom',
      config: this.strategy,
    });
  }

  /**
   * Evaluate scaling needs and make decision
   * @nist si-4 "Information system monitoring"
   */
  async evaluateScaling(
    poolMetrics: IMetrics,
    options: BrowserPoolOptions,
  ): Promise<ScalingEvent | null> {
    const metrics = this.metricsCalculator.calculateMetrics(poolMetrics, options);
    const inCooldown = this.isInCooldown();

    // Make scaling decision
    const decision = this.decisionMaker.makeDecision(metrics, inCooldown);

    // If no change needed, return null
    if (decision.decision === ScalingDecision.MAINTAIN) {
      logger.debug({
        msg: 'No scaling needed',
        metrics,
        reason: decision.reason,
      });
      return null;
    }

    // Create scaling event
    const scalingEvent: ScalingEvent = {
      timestamp: new Date(),
      decision: decision.decision,
      previousSize: metrics.currentSize,
      newSize: decision.targetSize,
      metrics,
      reason: decision.reason,
      confidence: decision.confidence,
    };

    // Record event
    this.recordScalingEvent(scalingEvent);

    // Log security event for scaling
    await logSecurityEvent(SecurityEventType.RESOURCE_ACCESS, {
      action: 'browser_pool_scaling',
      resource: 'browser_pool',
      reason: decision.reason,
      metadata: {
        decision: decision.decision,
        previousSize: metrics.currentSize,
        newSize: decision.targetSize,
      },
    });

    logger.info({
      msg: 'Scaling decision made',
      event: scalingEvent,
    });

    return scalingEvent;
  }

  /**
   * Calculate ideal pool size
   * @nist cm-2 "Baseline configuration"
   */
  calculateIdealSize(poolMetrics: IMetrics, options: BrowserPoolOptions): number {
    const metrics = this.metricsCalculator.calculateMetrics(poolMetrics, options);
    return this.idealSizeCalculator.calculateIdealSize(metrics);
  }

  /**
   * Get scaling history
   * @nist au-3 "Content of audit records"
   */
  getScalingHistory(): ReadonlyArray<ScalingEvent> {
    return [...this.scalingHistory];
  }

  /**
   * Clear scaling history
   */
  clearHistory(): void {
    this.scalingHistory = [];
    this.metricsCalculator.clearHistory();
  }

  /**
   * Update scaling strategy
   * @nist cm-2 "Baseline configuration"
   */
  updateStrategy(strategy: BrowserPoolScalingStrategy): void {
    this.strategy = strategy;
    this.decisionMaker.updateStrategy(strategy);
    this.idealSizeCalculator.updateStrategy(strategy);

    logger.info({
      msg: 'Scaling strategy updated',
      strategy,
    });
  }

  /**
   * Get default strategy by name
   * @private
   */
  private getDefaultStrategy(
    name: 'conservative' | 'balanced' | 'aggressive',
  ): BrowserPoolScalingStrategy {
    switch (name) {
      case 'conservative':
        return DEFAULT_STRATEGIES.conservative;
      case 'balanced':
        return DEFAULT_STRATEGIES.balanced;
      case 'aggressive':
        return DEFAULT_STRATEGIES.aggressive;
      default:
        return DEFAULT_STRATEGIES.balanced;
    }
  }

  /**
   * Check if in cooldown period
   * @private
   */
  private isInCooldown(): boolean {
    return Date.now() - this.lastScalingTime < this.strategy.cooldownPeriod;
  }

  /**
   * Record scaling event
   * @private
   */
  private recordScalingEvent(event: ScalingEvent): void {
    this.scalingHistory.push(event);
    this.lastScalingTime = Date.now();

    // Keep history limited
    if (this.scalingHistory.length > 100) {
      this.scalingHistory.shift();
    }
  }
}
