/**
 * Retry utility with exponential backoff and jitter
 * @module core/errors/retry-manager
 * @nist si-11 "Error handling"
 */

import { Logger } from 'pino';
import { RetryConfig } from './error-context.js';
import { CircuitBreaker, CircuitState } from './circuit-breaker.js';

/**
 * Retry state
 */
export interface RetryState {
  attempt: number;
  startTime: number;
  lastAttemptTime: number;
  errors: Error[];
  totalDelay: number;
  config: RetryConfig;
}

/**
 * Recovery context
 */
export interface RecoveryContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  resource?: string;
  originalArgs?: unknown[];
  metadata?: Record<string, unknown>;
}

/**
 * Retry utility with exponential backoff and jitter
 */
export class RetryManager {
  private logger: Logger;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute function with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    context: RecoveryContext = {},
    circuitBreakerKey?: string,
  ): Promise<T> {
    const state = this.initializeRetryState(config);
    const circuitBreaker =
      circuitBreakerKey !== undefined ? this.getCircuitBreaker(circuitBreakerKey) : undefined;

    while (state.attempt < config.maxAttempts) {
      this.checkCircuitBreaker(circuitBreaker, circuitBreakerKey);

      state.attempt++;
      state.lastAttemptTime = Date.now();

      try {
        const result = await this.executeOperation(operation, state, context);
        this.handleSuccess(circuitBreaker, state, context);
        return result;
      } catch (error) {
        await this.handleFailure(error as Error, state, context, circuitBreaker);
      }
    }

    throw new Error('Retry attempts exhausted');
  }

  /**
   * Initialize retry state
   */
  private initializeRetryState(config: RetryConfig): RetryState {
    return {
      attempt: 0,
      startTime: Date.now(),
      lastAttemptTime: Date.now(),
      errors: [],
      totalDelay: 0,
      config,
    };
  }

  /**
   * Check circuit breaker before execution
   */
  private checkCircuitBreaker(circuitBreaker: CircuitBreaker | undefined, key?: string): void {
    if (circuitBreaker?.canExecute() === false) {
      throw new Error(`Circuit breaker is open for ${key}`);
    }
  }

  /**
   * Execute the operation with logging
   */
  private async executeOperation<T>(
    operation: () => Promise<T>,
    state: RetryState,
    context: RecoveryContext,
  ): Promise<T> {
    this.logger.debug(
      {
        attempt: state.attempt,
        maxAttempts: state.config.maxAttempts,
        requestId: context.requestId,
        operation: context.operation,
      },
      'Executing retry attempt',
    );

    return operation();
  }

  /**
   * Handle successful operation
   */
  private handleSuccess(
    circuitBreaker: CircuitBreaker | undefined,
    state: RetryState,
    context: RecoveryContext,
  ): void {
    circuitBreaker?.recordSuccess();

    this.logger.info(
      {
        attempt: state.attempt,
        duration: Date.now() - state.startTime,
        requestId: context.requestId,
        operation: context.operation,
      },
      'Retry operation succeeded',
    );
  }

  /**
   * Handle failed operation
   */
  private async handleFailure(
    error: Error,
    state: RetryState,
    context: RecoveryContext,
    circuitBreaker: CircuitBreaker | undefined,
  ): Promise<void> {
    const config = state.config;
    state.errors.push(error);
    circuitBreaker?.recordFailure();

    this.logger.warn(
      {
        attempt: state.attempt,
        maxAttempts: config.maxAttempts,
        error: error.message,
        requestId: context.requestId,
        operation: context.operation,
      },
      'Retry attempt failed',
    );

    if (state.attempt >= config.maxAttempts) {
      throw error;
    }

    await this.delayBeforeRetry(state, context);
  }

  /**
   * Calculate and apply delay before retry
   */
  private async delayBeforeRetry(state: RetryState, context: RecoveryContext): Promise<void> {
    const delay = this.calculateDelay(state.attempt, state.config);
    state.totalDelay += delay;

    this.logger.debug(
      {
        delay,
        nextAttempt: state.attempt + 1,
        requestId: context.requestId,
      },
      'Waiting before next retry attempt',
    );

    await this.sleep(delay);
  }

  /**
   * Get or create circuit breaker for a key
   */
  private getCircuitBreaker(key: string): CircuitBreaker {
    const existing = this.circuitBreakers.get(key);
    if (existing) {
      return existing;
    }

    const circuitBreaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      monitoringWindow: 60000, // 1 minute
      halfOpenMaxAttempts: 3,
    });

    this.circuitBreakers.set(key, circuitBreaker);
    return circuitBreaker;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
    const jitterAmount = cappedDelay * config.jitter;
    const jitter = Math.random() * jitterAmount;
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(key: string): void {
    const circuitBreaker = this.circuitBreakers.get(key);
    circuitBreaker?.reset();
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(key: string): CircuitState | null {
    const circuitBreaker = this.circuitBreakers.get(key);
    return circuitBreaker?.getState() ?? null;
  }
}
