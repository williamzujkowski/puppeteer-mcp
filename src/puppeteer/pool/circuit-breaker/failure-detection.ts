/**
 * Failure detection strategies for circuit breaker
 * @module puppeteer/pool/circuit-breaker/failure-detection
 * @nist si-4 "Information system monitoring"
 * @nist au-5 "Response to audit processing failures"
 */

import { CircuitBreakerConfig, CircuitBreakerState, IFailureDetectionStrategy } from './types.js';
import { createLogger } from '../../../utils/logger.js';
import { BaseFailureDetectionStrategy } from './base-failure-strategy.js';
import {
  PercentageFailureDetectionStrategy,
  ConsecutiveFailuresDetectionStrategy,
  AdaptiveFailureDetectionStrategy,
} from './failure-strategies.js';

const logger = createLogger('circuit-breaker-failure-detection');

// Re-export base class for backward compatibility
export { BaseFailureDetectionStrategy };

/**
 * Threshold-based failure detection strategy
 */
export class ThresholdFailureDetectionStrategy extends BaseFailureDetectionStrategy {
  constructor() {
    super('threshold');
  }

  shouldOpen(failures: Date[], requests: Date[], config: CircuitBreakerConfig): boolean {
    const recentFailures = this.filterWithinTimeWindow(failures, config.timeWindow);
    const recentRequests = this.filterWithinTimeWindow(requests, config.timeWindow);

    const meetsMinimumThroughput = recentRequests.length >= config.minimumThroughput;
    const exceedsFailureThreshold = recentFailures.length >= config.failureThreshold;

    if (meetsMinimumThroughput && exceedsFailureThreshold) {
      logger.debug(
        {
          strategy: this.name,
          recentFailures: recentFailures.length,
          recentRequests: recentRequests.length,
          failureThreshold: config.failureThreshold,
          minimumThroughput: config.minimumThroughput,
        },
        'Circuit should open based on threshold',
      );
      return true;
    }

    return false;
  }

  shouldTransitionToHalfOpen(
    state: CircuitBreakerState,
    lastStateChange: Date,
    config: CircuitBreakerConfig,
  ): boolean {
    if (state !== CircuitBreakerState.OPEN) {
      return false;
    }

    const timeSinceOpen = Date.now() - lastStateChange.getTime();
    return timeSinceOpen >= config.timeout;
  }

  shouldClose(successes: Date[], config: CircuitBreakerConfig): boolean {
    const recentSuccesses = this.filterWithinTimeWindow(successes, config.timeWindow);
    return recentSuccesses.length >= config.successThreshold;
  }
}

/**
 * Factory for creating failure detection strategies
 */
export class FailureDetectionStrategyFactory {
  private static strategies = new Map<string, IFailureDetectionStrategy>();

  static {
    // Register default strategies
    this.strategies.set('threshold', new ThresholdFailureDetectionStrategy());
    this.strategies.set('percentage', new PercentageFailureDetectionStrategy());
    this.strategies.set('consecutive', new ConsecutiveFailuresDetectionStrategy());
    this.strategies.set('adaptive', new AdaptiveFailureDetectionStrategy());
  }

  /**
   * Get failure detection strategy
   */
  static getStrategy(name: string): IFailureDetectionStrategy {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      logger.warn({ strategyName: name }, 'Unknown strategy requested, using default');
      return this.strategies.get('threshold')!;
    }
    return strategy;
  }

  /**
   * Register custom strategy
   */
  static registerStrategy(name: string, strategy: IFailureDetectionStrategy): void {
    this.strategies.set(name, strategy);
    logger.info({ strategyName: name }, 'Custom failure detection strategy registered');
  }
}
