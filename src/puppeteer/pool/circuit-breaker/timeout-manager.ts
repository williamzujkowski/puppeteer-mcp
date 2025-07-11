/**
 * Timeout management for circuit breaker with exponential backoff
 * @module puppeteer/pool/circuit-breaker/timeout-manager
 * @nist si-4 "Information system monitoring"
 * @nist au-5 "Response to audit processing failures"
 */

import { EventEmitter } from 'events';
import { CircuitBreakerConfig, CircuitBreakerState } from './types.js';
import { createLogger } from '../../../utils/logger.js';
import { FixedTimeoutStrategy, JitteredBackoffStrategy } from './timeout-strategies.js';

const logger = createLogger('circuit-breaker-timeout');

/**
 * Timeout strategy interface
 */
export interface ITimeoutStrategy {
  calculateTimeout(attempt: number, baseTimeout: number): number;
  reset(): void;
}

/**
 * Timeout manager for circuit breaker
 * @nist au-5 "Response to audit processing failures"
 */
export class TimeoutManager extends EventEmitter {
  private timeoutId?: NodeJS.Timeout;
  private currentTimeout: number;
  private attempt = 0;
  private strategy: ITimeoutStrategy;
  private lastScheduledTime?: Date;
  private nextTimeoutTime?: Date;

  constructor(
    private name: string,
    protected config: CircuitBreakerConfig,
    private onTimeout: () => void,
  ) {
    super();
    this.currentTimeout = config.timeout;
    this.strategy = this.createStrategy();
  }

  /**
   * Create timeout strategy based on configuration
   */
  protected createStrategy(): ITimeoutStrategy {
    if (!this.config.exponentialBackoff) {
      return new FixedTimeoutStrategy();
    }

    // Default to jittered exponential backoff for better distributed recovery
    return new JitteredBackoffStrategy(this.config.backoffMultiplier, this.config.maxTimeout);
  }

  /**
   * Schedule timeout for half-open transition
   */
  scheduleTimeout(state: CircuitBreakerState): void {
    if (state !== CircuitBreakerState.OPEN) {
      logger.warn(
        {
          circuitBreaker: this.name,
          state,
        },
        'Attempted to schedule timeout in non-open state',
      );
      return;
    }

    this.clearTimeout();
    this.attempt++;

    this.currentTimeout = this.strategy.calculateTimeout(this.attempt, this.config.timeout);
    this.lastScheduledTime = new Date();
    this.nextTimeoutTime = new Date(Date.now() + this.currentTimeout);

    this.timeoutId = setTimeout(() => {
      logger.info(
        {
          circuitBreaker: this.name,
          timeout: this.currentTimeout,
          attempt: this.attempt,
        },
        'Circuit breaker timeout triggered',
      );

      this.emit('timeout-triggered', {
        timeout: this.currentTimeout,
        attempt: this.attempt,
        scheduledAt: this.lastScheduledTime,
      });

      this.onTimeout();
    }, this.currentTimeout);

    logger.debug(
      {
        circuitBreaker: this.name,
        timeout: this.currentTimeout,
        attempt: this.attempt,
        nextTimeout: this.nextTimeoutTime,
      },
      'Timeout scheduled',
    );

    this.emit('timeout-scheduled', {
      timeout: this.currentTimeout,
      attempt: this.attempt,
      nextTimeout: this.nextTimeoutTime,
    });
  }

  /**
   * Clear scheduled timeout
   */
  clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
      this.nextTimeoutTime = undefined;

      logger.debug(
        {
          circuitBreaker: this.name,
        },
        'Timeout cleared',
      );

      this.emit('timeout-cleared');
    }
  }

  /**
   * Reset timeout manager
   */
  reset(): void {
    this.clearTimeout();
    this.attempt = 0;
    this.currentTimeout = this.config.timeout;
    this.strategy.reset();
    this.lastScheduledTime = undefined;

    logger.debug(
      {
        circuitBreaker: this.name,
      },
      'Timeout manager reset',
    );

    this.emit('timeout-reset');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: CircuitBreakerConfig): void {
    const configChanged =
      this.config.exponentialBackoff !== newConfig.exponentialBackoff ||
      this.config.backoffMultiplier !== newConfig.backoffMultiplier ||
      this.config.maxTimeout !== newConfig.maxTimeout ||
      this.config.timeout !== newConfig.timeout;

    this.config = newConfig;

    if (configChanged) {
      this.strategy = this.createStrategy();
      logger.info(
        {
          circuitBreaker: this.name,
          exponentialBackoff: newConfig.exponentialBackoff,
          multiplier: newConfig.backoffMultiplier,
          maxTimeout: newConfig.maxTimeout,
        },
        'Timeout strategy updated',
      );
    }
  }

  /**
   * Get timeout status
   */
  getStatus(): {
    hasActiveTimeout: boolean;
    currentTimeout: number;
    attempt: number;
    nextTimeoutTime?: Date;
    timeRemaining?: number;
  } {
    const status = {
      hasActiveTimeout: !!this.timeoutId,
      currentTimeout: this.currentTimeout,
      attempt: this.attempt,
      nextTimeoutTime: this.nextTimeoutTime,
      timeRemaining: undefined as number | undefined,
    };

    if (this.nextTimeoutTime) {
      status.timeRemaining = Math.max(0, this.nextTimeoutTime.getTime() - Date.now());
    }

    return status;
  }

  /**
   * Force trigger timeout (for testing)
   */
  forceTrigger(): void {
    if (this.timeoutId) {
      this.clearTimeout();
      this.onTimeout();

      logger.warn(
        {
          circuitBreaker: this.name,
        },
        'Timeout force triggered',
      );

      this.emit('timeout-forced');
    }
  }

  /**
   * Destroy timeout manager
   */
  destroy(): void {
    this.clearTimeout();
    this.removeAllListeners();

    logger.debug(
      {
        circuitBreaker: this.name,
      },
      'Timeout manager destroyed',
    );
  }
}

/**
 * Adaptive timeout manager that learns from recovery patterns
 */
export class AdaptiveTimeoutManager extends TimeoutManager {
  private recoveryTimes: number[] = [];
  private readonly maxRecoveryHistory = 20;

  /**
   * Record successful recovery time
   */
  recordRecovery(recoveryTime: number): void {
    this.recoveryTimes.push(recoveryTime);
    if (this.recoveryTimes.length > this.maxRecoveryHistory) {
      this.recoveryTimes.shift();
    }

    this.emit('recovery-recorded', {
      recoveryTime,
      averageRecovery: this.getAverageRecoveryTime(),
    });
  }

  /**
   * Get average recovery time
   */
  getAverageRecoveryTime(): number {
    if (this.recoveryTimes.length === 0) {
      return this.config.timeout;
    }

    const sum = this.recoveryTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.recoveryTimes.length;
  }

  /**
   * Create adaptive timeout strategy
   */
  protected override createStrategy(): ITimeoutStrategy {
    if (!this.config.exponentialBackoff) {
      return new FixedTimeoutStrategy();
    }

    // Use adaptive timeout based on recovery history
    const averageRecovery = this.getAverageRecoveryTime();
    const adaptiveMultiplier = Math.max(1.5, Math.min(3, this.config.backoffMultiplier));

    return new JitteredBackoffStrategy(
      adaptiveMultiplier,
      Math.max(this.config.maxTimeout, averageRecovery * 10),
      0.2, // Higher jitter for adaptive strategy
    );
  }
}
