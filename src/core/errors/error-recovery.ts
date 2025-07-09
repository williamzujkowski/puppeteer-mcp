/**
 * Error recovery mechanisms and retry logic
 * @module core/errors/error-recovery
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { EnhancedAppError } from './enhanced-app-error.js';
import { RecoveryAction } from './error-context.js';
import { ErrorTracker } from './error-tracking.js';
import { RetryManager, RecoveryContext } from './retry-manager.js';
import { RecoveryStrategy, RecoveryResult } from './recovery-strategies.js';
import { CircuitState } from './circuit-breaker.js';

// Re-export types for backward compatibility
export type { RecoveryStrategy, RecoveryResult } from './recovery-strategies.js';
export type { RecoveryContext, RetryState } from './retry-manager.js';
export type { CircuitBreakerConfig } from './circuit-breaker.js';
export { CircuitBreaker, CircuitState } from './circuit-breaker.js';
export { RetryManager } from './retry-manager.js';
export * from './recovery-strategies.js';

/**
 * Recovery events
 */
export enum RecoveryEvent {
  RECOVERY_STARTED = 'recovery_started',
  RECOVERY_ATTEMPT = 'recovery_attempt',
  RECOVERY_SUCCESS = 'recovery_success',
  RECOVERY_FAILED = 'recovery_failed',
  RETRY_STARTED = 'retry_started',
  RETRY_ATTEMPT = 'retry_attempt',
  RETRY_SUCCESS = 'retry_success',
  RETRY_FAILED = 'retry_failed',
}

/**
 * Error recovery manager
 */
export class ErrorRecoveryManager extends EventEmitter {
  private strategies: RecoveryStrategy[] = [];
  private retryManager: RetryManager;
  private logger: Logger;
  private errorTracker?: ErrorTracker;

  constructor(logger: Logger, errorTracker?: ErrorTracker) {
    super();
    this.logger = logger;
    this.retryManager = new RetryManager(logger);
    this.errorTracker = errorTracker;
  }

  /**
   * Register a recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Attempt to recover from an error
   */
  async recover(error: EnhancedAppError, context: RecoveryContext = {}): Promise<RecoveryResult> {
    const startTime = Date.now();

    this.logRecoveryStart(error, context);
    this.emit(RecoveryEvent.RECOVERY_STARTED, { error, context });

    const applicableStrategies = this.findApplicableStrategies(error);

    if (applicableStrategies.length === 0) {
      return this.handleNoStrategiesAvailable(startTime);
    }

    return this.tryStrategies(applicableStrategies, error, context, startTime);
  }

  /**
   * Execute operation with automatic retry and recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: RecoveryContext = {},
  ): Promise<T> {
    const maxRecoveryAttempts = 3;
    let recoveryAttempts = 0;

    while (recoveryAttempts < maxRecoveryAttempts) {
      try {
        return await operation();
      } catch (error) {
        const result = await this.handleOperationError(error, operation, context);
        if (result) {
          return result;
        }

        recoveryAttempts++;
      }
    }

    throw new Error('Maximum recovery attempts exceeded');
  }

  /**
   * Get retry manager for direct access
   */
  getRetryManager(): RetryManager {
    return this.retryManager;
  }

  /**
   * Reset circuit breaker for a key
   */
  resetCircuitBreaker(key: string): void {
    this.retryManager.resetCircuitBreaker(key);
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(key: string): CircuitState | null {
    return this.retryManager.getCircuitBreakerState(key);
  }

  /**
   * Log recovery start
   */
  private logRecoveryStart(error: EnhancedAppError, context: RecoveryContext): void {
    this.logger.info(
      {
        errorCode: error.errorContext.errorCode,
        category: error.errorContext.category,
        recoverySuggestions: error.getRecoverySuggestions(),
        requestId: context.requestId,
      },
      'Starting error recovery',
    );
  }

  /**
   * Find applicable recovery strategies
   */
  private findApplicableStrategies(error: EnhancedAppError): RecoveryStrategy[] {
    return this.strategies.filter((strategy) => strategy.canHandle(error));
  }

  /**
   * Handle case when no strategies are available
   */
  private handleNoStrategiesAvailable(startTime: number): RecoveryResult {
    const result: RecoveryResult = {
      success: false,
      error: new Error('No recovery strategies available'),
      strategy: 'none',
      attempts: 0,
      duration: Date.now() - startTime,
      nextAction: RecoveryAction.CONTACT_SUPPORT,
    };

    this.emit(RecoveryEvent.RECOVERY_FAILED, result);
    return result;
  }

  /**
   * Try recovery strategies sequentially
   */
  private async tryStrategies(
    strategies: RecoveryStrategy[],
    error: EnhancedAppError,
    context: RecoveryContext,
    startTime: number,
  ): Promise<RecoveryResult> {
    for (const strategy of strategies) {
      const result = await this.tryStrategy(strategy, error, context);
      if (result?.success === true) {
        return result;
      }
    }

    return this.handleAllStrategiesFailed(strategies.length, startTime);
  }

  /**
   * Try a single recovery strategy
   */
  private async tryStrategy(
    strategy: RecoveryStrategy,
    error: EnhancedAppError,
    context: RecoveryContext,
  ): Promise<RecoveryResult | null> {
    try {
      this.emit(RecoveryEvent.RECOVERY_ATTEMPT, { error, strategy, context });

      const result = await strategy.execute(error, context);

      if (result.success) {
        this.logStrategySuccess(result, context);
        this.emit(RecoveryEvent.RECOVERY_SUCCESS, result);
        return result;
      }

      this.logStrategyFailure(result, context);
      return null;
    } catch (strategyError) {
      this.logStrategyError(strategy, strategyError as Error, context);
      return null;
    }
  }

  /**
   * Log strategy success
   */
  private logStrategySuccess(result: RecoveryResult, context: RecoveryContext): void {
    this.logger.info(
      {
        strategy: result.strategy,
        duration: result.duration,
        requestId: context.requestId,
      },
      'Error recovery succeeded',
    );
  }

  /**
   * Log strategy failure
   */
  private logStrategyFailure(result: RecoveryResult, context: RecoveryContext): void {
    this.logger.warn(
      {
        strategy: result.strategy,
        error: result.error?.message,
        requestId: context.requestId,
      },
      'Recovery strategy failed',
    );
  }

  /**
   * Log strategy error
   */
  private logStrategyError(
    strategy: RecoveryStrategy,
    error: Error,
    context: RecoveryContext,
  ): void {
    this.logger.error(
      {
        strategy: strategy.constructor.name,
        error: error.message,
        requestId: context.requestId,
      },
      'Recovery strategy threw error',
    );
  }

  /**
   * Handle case when all strategies failed
   */
  private handleAllStrategiesFailed(attemptCount: number, startTime: number): RecoveryResult {
    const result: RecoveryResult = {
      success: false,
      error: new Error('All recovery strategies failed'),
      strategy: 'all_failed',
      attempts: attemptCount,
      duration: Date.now() - startTime,
      nextAction: RecoveryAction.CONTACT_SUPPORT,
    };

    this.emit(RecoveryEvent.RECOVERY_FAILED, result);
    return result;
  }

  /**
   * Handle operation error with retry and recovery
   */
  private async handleOperationError<T>(
    error: unknown,
    operation: () => Promise<T>,
    context: RecoveryContext,
  ): Promise<T | null> {
    if (!(error instanceof EnhancedAppError)) {
      throw error;
    }

    // Track the error
    if (this.errorTracker) {
      await this.errorTracker.trackError(error, context);
    }

    // Try retry if applicable
    const retryResult = await this.tryRetry(error, operation, context);
    if (retryResult !== null) {
      return retryResult;
    }

    // Try recovery
    const recoveryResult = await this.recover(error, context);
    if (recoveryResult.success && recoveryResult.nextAction === RecoveryAction.RETRY) {
      return null; // Continue the recovery loop
    }

    throw error;
  }

  /**
   * Try retry mechanism
   */
  private async tryRetry<T>(
    error: EnhancedAppError,
    operation: () => Promise<T>,
    context: RecoveryContext,
  ): Promise<T | null> {
    if (!error.isRetryable()) {
      return null;
    }

    const retryConfig = error.getRetryConfig();
    if (retryConfig === undefined || retryConfig === null) {
      return null;
    }

    try {
      this.emit(RecoveryEvent.RETRY_STARTED, { error, context });

      const circuitBreakerKey = this.generateCircuitBreakerKey(error, context);
      const result = await this.retryManager.executeWithRetry(
        operation,
        retryConfig,
        context,
        circuitBreakerKey,
      );

      this.emit(RecoveryEvent.RETRY_SUCCESS, { error, context });
      return result;
    } catch (retryError) {
      this.emit(RecoveryEvent.RETRY_FAILED, { error: retryError, context });
      return null;
    }
  }

  /**
   * Generate circuit breaker key
   */
  private generateCircuitBreakerKey(error: EnhancedAppError, context: RecoveryContext): string {
    const errorCode = error.errorContext.errorCode;
    const operation = context.operation ?? 'unknown';
    return `${errorCode}_${operation}`;
  }
}

/**
 * Default recovery manager instance
 */
export let defaultRecoveryManager: ErrorRecoveryManager | null = null;

/**
 * Initialize default recovery manager
 */
export function initializeRecoveryManager(
  logger: Logger,
  errorTracker?: ErrorTracker,
): ErrorRecoveryManager {
  defaultRecoveryManager = new ErrorRecoveryManager(logger, errorTracker);
  return defaultRecoveryManager;
}

/**
 * Get default recovery manager
 */
export function getRecoveryManager(): ErrorRecoveryManager {
  if (!defaultRecoveryManager) {
    throw new Error('Recovery manager not initialized. Call initializeRecoveryManager first.');
  }
  return defaultRecoveryManager;
}
