/**
 * Concrete failure detection strategies
 * @module puppeteer/pool/circuit-breaker/failure-strategies
 * @nist si-4 "Information system monitoring"
 */

import { CircuitBreakerConfig, CircuitBreakerState } from './types.js';
import { BaseFailureDetectionStrategy } from './failure-detection.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('circuit-breaker-strategies');

/**
 * Percentage-based failure detection strategy
 */
export class PercentageFailureDetectionStrategy extends BaseFailureDetectionStrategy {
  constructor(private failureRateThreshold = 50) {
    super('percentage');
  }

  shouldOpen(failures: Date[], requests: Date[], config: CircuitBreakerConfig): boolean {
    const recentFailures = this.filterWithinTimeWindow(failures, config.timeWindow);
    const recentRequests = this.filterWithinTimeWindow(requests, config.timeWindow);

    if (recentRequests.length < config.minimumThroughput) {
      return false;
    }

    const failureRate = this.calculateFailureRate(recentFailures.length, recentRequests.length);
    
    if (failureRate >= this.failureRateThreshold) {
      logger.debug({
        strategy: this.name,
        failureRate,
        threshold: this.failureRateThreshold,
        recentFailures: recentFailures.length,
        recentRequests: recentRequests.length,
      }, 'Circuit should open based on failure rate');
      return true;
    }

    return false;
  }

  shouldTransitionToHalfOpen(state: CircuitBreakerState, lastStateChange: Date, config: CircuitBreakerConfig): boolean {
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
 * Consecutive failures detection strategy
 */
export class ConsecutiveFailuresDetectionStrategy extends BaseFailureDetectionStrategy {
  private consecutiveFailures = 0;

  constructor(private maxConsecutiveFailures = 5) {
    super('consecutive');
  }

  shouldOpen(_failures: Date[], _requests: Date[], _config: CircuitBreakerConfig): boolean {
    // This strategy needs to track consecutive failures differently
    // In a real implementation, this would need to be integrated with the circuit breaker
    return this.consecutiveFailures >= this.maxConsecutiveFailures;
  }

  shouldTransitionToHalfOpen(state: CircuitBreakerState, lastStateChange: Date, config: CircuitBreakerConfig): boolean {
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

  /**
   * Track consecutive failures
   */
  recordFailure(): void {
    this.consecutiveFailures++;
  }

  /**
   * Reset consecutive failures on success
   */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }
}

/**
 * Adaptive failure detection strategy
 * Adjusts thresholds based on historical performance
 */
export class AdaptiveFailureDetectionStrategy extends BaseFailureDetectionStrategy {
  private historicalFailureRates: number[] = [];
  private readonly maxHistory = 100;

  constructor() {
    super('adaptive');
  }

  shouldOpen(failures: Date[], requests: Date[], config: CircuitBreakerConfig): boolean {
    const recentFailures = this.filterWithinTimeWindow(failures, config.timeWindow);
    const recentRequests = this.filterWithinTimeWindow(requests, config.timeWindow);

    if (recentRequests.length < config.minimumThroughput) {
      return false;
    }

    const currentFailureRate = this.calculateFailureRate(recentFailures.length, recentRequests.length);
    this.recordFailureRate(currentFailureRate);

    // Calculate adaptive threshold based on historical data
    const adaptiveThreshold = this.calculateAdaptiveThreshold();
    
    if (currentFailureRate >= adaptiveThreshold) {
      logger.debug({
        strategy: this.name,
        currentFailureRate,
        adaptiveThreshold,
        recentFailures: recentFailures.length,
        recentRequests: recentRequests.length,
      }, 'Circuit should open based on adaptive threshold');
      return true;
    }

    return false;
  }

  shouldTransitionToHalfOpen(state: CircuitBreakerState, lastStateChange: Date, config: CircuitBreakerConfig): boolean {
    if (state !== CircuitBreakerState.OPEN) {
      return false;
    }

    // Adaptive timeout based on recovery patterns
    const adaptiveTimeout = this.calculateAdaptiveTimeout(config.timeout);
    const timeSinceOpen = Date.now() - lastStateChange.getTime();
    return timeSinceOpen >= adaptiveTimeout;
  }

  shouldClose(successes: Date[], config: CircuitBreakerConfig): boolean {
    const recentSuccesses = this.filterWithinTimeWindow(successes, config.timeWindow);
    // Adaptive success threshold
    const adaptiveSuccessThreshold = Math.max(
      config.successThreshold,
      Math.floor(this.historicalFailureRates.length * 0.1)
    );
    return recentSuccesses.length >= adaptiveSuccessThreshold;
  }

  /**
   * Record failure rate for historical analysis
   */
  private recordFailureRate(rate: number): void {
    this.historicalFailureRates.push(rate);
    if (this.historicalFailureRates.length > this.maxHistory) {
      this.historicalFailureRates.shift();
    }
  }

  /**
   * Calculate adaptive threshold based on historical performance
   */
  private calculateAdaptiveThreshold(): number {
    if (this.historicalFailureRates.length < 10) {
      return 50; // Default threshold
    }

    // Calculate mean and standard deviation
    const mean = this.historicalFailureRates.reduce((sum, rate) => sum + rate, 0) / this.historicalFailureRates.length;
    const variance = this.historicalFailureRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / this.historicalFailureRates.length;
    const stdDev = Math.sqrt(variance);

    // Set threshold to mean + 2 standard deviations
    return Math.min(mean + (2 * stdDev), 90); // Cap at 90%
  }

  /**
   * Calculate adaptive timeout based on recovery patterns
   */
  private calculateAdaptiveTimeout(baseTimeout: number): number {
    // In a real implementation, this would analyze recovery patterns
    // For now, return base timeout
    return baseTimeout;
  }
}