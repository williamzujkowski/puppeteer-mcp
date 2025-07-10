/**
 * Retry strategy implementation
 * @module puppeteer/actions/execution/error/retry-strategy
 * @nist si-11 "Error handling"
 * @nist cp-10 "Information system recovery and reconstitution"
 */

import type { RetryConfig } from '../types.js';
import { DEFAULT_CONFIG } from '../types.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:retry-strategy');

/**
 * Retry strategy interface
 */
export interface RetryStrategy {
  shouldRetry(attempt: number, error?: Error): boolean;
  getDelay(attempt: number): number;
  onRetryAttempt(attempt: number, error?: Error): void;
}

/**
 * Base retry strategy implementation
 * @nist cp-10 "Information system recovery and reconstitution"
 */
export abstract class BaseRetryStrategy implements RetryStrategy {
  protected readonly config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_CONFIG.RETRY, ...config };
  }

  abstract shouldRetry(attempt: number, error?: Error): boolean;
  abstract getDelay(attempt: number): number;

  onRetryAttempt(attempt: number, error?: Error): void {
    logger.debug('Retry attempt', {
      attempt,
      maxRetries: this.config.maxRetries,
      error: error?.message,
    });
  }

  /**
   * Get retry configuration
   */
  getConfig(): Readonly<RetryConfig> {
    return { ...this.config };
  }
}

/**
 * Exponential backoff retry strategy
 */
export class ExponentialBackoffStrategy extends BaseRetryStrategy {
  shouldRetry(attempt: number, _error?: Error): boolean {
    return attempt < this.config.maxRetries;
  }

  getDelay(attempt: number): number {
    const delay = Math.min(
      this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
      this.config.maxDelay,
    );

    logger.debug('Calculated retry delay', { attempt, delay });
    return delay;
  }
}

/**
 * Linear retry strategy
 */
export class LinearRetryStrategy extends BaseRetryStrategy {
  shouldRetry(attempt: number, _error?: Error): boolean {
    return attempt < this.config.maxRetries;
  }

  getDelay(_attempt: number): number {
    return this.config.baseDelay;
  }
}

/**
 * Fibonacci retry strategy
 */
export class FibonacciRetryStrategy extends BaseRetryStrategy {
  private readonly fibCache = new Map<number, number>();

  shouldRetry(attempt: number, _error?: Error): boolean {
    return attempt < this.config.maxRetries;
  }

  getDelay(attempt: number): number {
    const multiplier = this.fibonacci(attempt);
    const delay = Math.min(
      this.config.baseDelay * multiplier,
      this.config.maxDelay,
    );

    logger.debug('Calculated Fibonacci retry delay', { attempt, multiplier, delay });
    return delay;
  }

  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    
    const cached = this.fibCache.get(n);
    if (cached !== undefined) {
      return cached;
    }

    const result = this.fibonacci(n - 1) + this.fibonacci(n - 2);
    this.fibCache.set(n, result);
    return result;
  }
}

/**
 * Custom retry strategy with error-based decisions
 */
export class AdaptiveRetryStrategy extends BaseRetryStrategy {
  private readonly errorCounts = new Map<string, number>();

  shouldRetry(attempt: number, error?: Error): boolean {
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    if (!error) {
      return true;
    }

    // Track error frequency
    const errorType = this.getErrorType(error);
    const errorCount = (this.errorCounts.get(errorType) ?? 0) + 1;
    this.errorCounts.set(errorType, errorCount);

    // Stop retrying if same error occurs too frequently
    if (errorCount > Math.ceil(this.config.maxRetries / 2)) {
      logger.info('Stopping retries due to repeated error', {
        errorType,
        errorCount,
        maxRetries: this.config.maxRetries,
      });
      return false;
    }

    return true;
  }

  getDelay(attempt: number): number {
    // Use exponential backoff with jitter
    const baseDelay = Math.min(
      this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
      this.config.maxDelay,
    );

    // Add jitter (±25%)
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.max(0, baseDelay + jitter);

    logger.debug('Calculated adaptive retry delay with jitter', { 
      attempt, 
      baseDelay, 
      jitter, 
      delay,
    });
    
    return Math.round(delay);
  }

  private getErrorType(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network')) return 'network';
    if (message.includes('element')) return 'element';
    if (message.includes('navigation')) return 'navigation';
    
    return 'general';
  }

  /**
   * Reset error counts
   */
  reset(): void {
    this.errorCounts.clear();
  }
}

/**
 * Factory for creating retry strategies
 */
export class RetryStrategyFactory {
  static create(type: 'exponential' | 'linear' | 'fibonacci' | 'adaptive', config?: Partial<RetryConfig>): RetryStrategy {
    switch (type) {
      case 'exponential':
        return new ExponentialBackoffStrategy(config);
      case 'linear':
        return new LinearRetryStrategy(config);
      case 'fibonacci':
        return new FibonacciRetryStrategy(config);
      case 'adaptive':
        return new AdaptiveRetryStrategy(config);
      default:
        logger.warn('Unknown retry strategy type, using exponential', { type });
        return new ExponentialBackoffStrategy(config);
    }
  }
}