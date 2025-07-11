/**
 * Base failure detection strategy
 * @module puppeteer/pool/circuit-breaker/base-failure-strategy
 * @nist si-4 "Information system monitoring"
 */

import { CircuitBreakerConfig, CircuitBreakerState, IFailureDetectionStrategy } from './types.js';

/**
 * Base failure detection strategy
 */
export abstract class BaseFailureDetectionStrategy implements IFailureDetectionStrategy {
  constructor(protected name: string) {}

  abstract shouldOpen(failures: Date[], requests: Date[], config: CircuitBreakerConfig): boolean;
  abstract shouldTransitionToHalfOpen(
    state: CircuitBreakerState,
    lastStateChange: Date,
    config: CircuitBreakerConfig,
  ): boolean;
  abstract shouldClose(successes: Date[], config: CircuitBreakerConfig): boolean;

  /**
   * Filter dates within time window
   */
  protected filterWithinTimeWindow(dates: Date[], timeWindow: number): Date[] {
    const cutoff = new Date(Date.now() - timeWindow);
    return dates.filter((date) => date > cutoff);
  }

  /**
   * Calculate failure rate
   */
  protected calculateFailureRate(failures: number, total: number): number {
    return total > 0 ? (failures / total) * 100 : 0;
  }
}
