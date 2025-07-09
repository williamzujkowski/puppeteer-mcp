/**
 * Error recovery mechanisms and retry logic
 * @module core/errors/error-recovery
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { EnhancedAppError } from './enhanced-app-error.js';
import { RecoveryAction, RetryConfig } from './error-context.js';
import { ErrorTracker } from './error-tracking.js';

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  canHandle(error: EnhancedAppError): boolean;
  execute(error: EnhancedAppError, context: RecoveryContext): Promise<RecoveryResult>;
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
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean;
  result?: unknown;
  error?: Error;
  strategy: string;
  attempts: number;
  duration: number;
  nextAction?: RecoveryAction;
}

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
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  resetTimeout: number; // in milliseconds
  monitoringWindow: number; // in milliseconds
  halfOpenMaxAttempts: number;
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenAttempts: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Check if circuit allows execution
   */
  canExecute(): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        if (now - this.lastFailureTime >= this.config.resetTimeout) {
          this.state = CircuitState.HALF_OPEN;
          this.halfOpenAttempts = 0;
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;

      default:
        return false;
    }
  }

  /**
   * Record successful execution
   */
  recordSuccess(): void {
    if (!this.config.enabled) {
      return;
    }

    this.failures = 0;
    this.state = CircuitState.CLOSED;
    this.halfOpenAttempts = 0;
  }

  /**
   * Record failed execution
   */
  recordFailure(): void {
    if (!this.config.enabled) {
      return;
    }

    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        this.state = CircuitState.OPEN;
      }
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
  }
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
    circuitBreakerKey?: string
  ): Promise<T> {
    const state: RetryState = {
      attempt: 0,
      startTime: Date.now(),
      lastAttemptTime: Date.now(),
      errors: [],
      totalDelay: 0,
      config,
    };

    // Get or create circuit breaker
    let circuitBreaker: CircuitBreaker | undefined;
    if (circuitBreakerKey) {
      circuitBreaker = this.getCircuitBreaker(circuitBreakerKey);
    }

    while (state.attempt < config.maxAttempts) {
      // Check circuit breaker
      if (circuitBreaker && !circuitBreaker.canExecute()) {
        throw new Error(`Circuit breaker is open for ${circuitBreakerKey}`);
      }

      state.attempt++;
      state.lastAttemptTime = Date.now();

      try {
        this.logger.debug({
          attempt: state.attempt,
          maxAttempts: config.maxAttempts,
          requestId: context.requestId,
          operation: context.operation,
        }, 'Executing retry attempt');

        const result = await operation();

        // Success - record with circuit breaker
        if (circuitBreaker) {
          circuitBreaker.recordSuccess();
        }

        this.logger.info({
          attempt: state.attempt,
          duration: Date.now() - state.startTime,
          requestId: context.requestId,
          operation: context.operation,
        }, 'Retry operation succeeded');

        return result;
      } catch (error) {
        state.errors.push(error as Error);

        // Record failure with circuit breaker
        if (circuitBreaker) {
          circuitBreaker.recordFailure();
        }

        this.logger.warn({
          attempt: state.attempt,
          maxAttempts: config.maxAttempts,
          error: (error as Error).message,
          requestId: context.requestId,
          operation: context.operation,
        }, 'Retry attempt failed');

        // If this is the last attempt, throw the error
        if (state.attempt >= config.maxAttempts) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(state.attempt, config);
        state.totalDelay += delay;

        this.logger.debug({
          delay,
          nextAttempt: state.attempt + 1,
          requestId: context.requestId,
        }, 'Waiting before next retry attempt');

        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Retry attempts exhausted');
  }

  /**
   * Get or create circuit breaker for a key
   */
  private getCircuitBreaker(key: string): CircuitBreaker {
    let circuitBreaker = this.circuitBreakers.get(key);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker({
        enabled: true,
        failureThreshold: 5,
        resetTimeout: 30000, // 30 seconds
        monitoringWindow: 60000, // 1 minute
        halfOpenMaxAttempts: 3,
      });
      this.circuitBreakers.set(key, circuitBreaker);
    }
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(key: string): void {
    const circuitBreaker = this.circuitBreakers.get(key);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(key: string): CircuitState | null {
    const circuitBreaker = this.circuitBreakers.get(key);
    return circuitBreaker ? circuitBreaker.getState() : null;
  }
}

/**
 * Token refresh recovery strategy
 */
export class TokenRefreshRecoveryStrategy implements RecoveryStrategy {
  private tokenRefreshFn: () => Promise<string>;

  constructor(tokenRefreshFn: () => Promise<string>) {
    this.tokenRefreshFn = tokenRefreshFn;
  }

  canHandle(error: EnhancedAppError): boolean {
    return error.getRecoverySuggestions().includes(RecoveryAction.REFRESH_TOKEN);
  }

  async execute(_error: EnhancedAppError, _context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      const newToken = await this.tokenRefreshFn();
      
      return {
        success: true,
        result: newToken,
        strategy: 'token_refresh',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.RETRY,
      };
    } catch (refreshError) {
      return {
        success: false,
        error: refreshError as Error,
        strategy: 'token_refresh',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.CONTACT_SUPPORT,
      };
    }
  }
}

/**
 * Session restart recovery strategy
 */
export class SessionRestartRecoveryStrategy implements RecoveryStrategy {
  private sessionRestartFn: (sessionId: string) => Promise<void>;

  constructor(sessionRestartFn: (sessionId: string) => Promise<void>) {
    this.sessionRestartFn = sessionRestartFn;
  }

  canHandle(error: EnhancedAppError): boolean {
    return error.getRecoverySuggestions().includes(RecoveryAction.RESTART_SESSION);
  }

  async execute(_error: EnhancedAppError, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    if (!context.sessionId) {
      return {
        success: false,
        error: new Error('Session ID required for session restart'),
        strategy: 'session_restart',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.CONTACT_SUPPORT,
      };
    }

    try {
      await this.sessionRestartFn(context.sessionId);
      
      return {
        success: true,
        strategy: 'session_restart',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.RETRY,
      };
    } catch (restartError) {
      return {
        success: false,
        error: restartError as Error,
        strategy: 'session_restart',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.CONTACT_SUPPORT,
      };
    }
  }
}

/**
 * Cache clear recovery strategy
 */
export class CacheClearRecoveryStrategy implements RecoveryStrategy {
  private cacheClearFn: (key?: string) => Promise<void>;

  constructor(cacheClearFn: (key?: string) => Promise<void>) {
    this.cacheClearFn = cacheClearFn;
  }

  canHandle(error: EnhancedAppError): boolean {
    return error.getRecoverySuggestions().includes(RecoveryAction.CLEAR_CACHE);
  }

  async execute(_error: EnhancedAppError, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      const cacheKey = context.resource || context.operation;
      await this.cacheClearFn(cacheKey);
      
      return {
        success: true,
        strategy: 'cache_clear',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.RETRY,
      };
    } catch (clearError) {
      return {
        success: false,
        error: clearError as Error,
        strategy: 'cache_clear',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.CONTACT_SUPPORT,
      };
    }
  }
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
  async recover(
    error: EnhancedAppError,
    context: RecoveryContext = {}
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    this.logger.info({
      errorCode: error.errorContext.errorCode,
      category: error.errorContext.category,
      recoverySuggestions: error.getRecoverySuggestions(),
      requestId: context.requestId,
    }, 'Starting error recovery');

    this.emit(RecoveryEvent.RECOVERY_STARTED, { error, context });

    // Find applicable strategies
    const applicableStrategies = this.strategies.filter(strategy => 
      strategy.canHandle(error)
    );

    if (applicableStrategies.length === 0) {
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

    // Try each strategy
    for (const strategy of applicableStrategies) {
      try {
        this.emit(RecoveryEvent.RECOVERY_ATTEMPT, { error, strategy, context });

        const result = await strategy.execute(error, context);
        
        if (result.success) {
          this.logger.info({
            strategy: result.strategy,
            duration: result.duration,
            requestId: context.requestId,
          }, 'Error recovery succeeded');

          this.emit(RecoveryEvent.RECOVERY_SUCCESS, result);
          return result;
        } else {
          this.logger.warn({
            strategy: result.strategy,
            error: result.error?.message,
            requestId: context.requestId,
          }, 'Recovery strategy failed');
        }
      } catch (strategyError) {
        this.logger.error({
          strategy: strategy.constructor.name,
          error: (strategyError as Error).message,
          requestId: context.requestId,
        }, 'Recovery strategy threw error');
      }
    }

    // All strategies failed
    const result: RecoveryResult = {
      success: false,
      error: new Error('All recovery strategies failed'),
      strategy: 'all_failed',
      attempts: applicableStrategies.length,
      duration: Date.now() - startTime,
      nextAction: RecoveryAction.CONTACT_SUPPORT,
    };

    this.emit(RecoveryEvent.RECOVERY_FAILED, result);
    return result;
  }

  /**
   * Execute operation with automatic retry and recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: RecoveryContext = {}
  ): Promise<T> {
    const maxRecoveryAttempts = 3;
    let recoveryAttempts = 0;

    while (recoveryAttempts < maxRecoveryAttempts) {
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof EnhancedAppError)) {
          throw error;
        }

        // Track the error
        if (this.errorTracker) {
          await this.errorTracker.trackError(error, context);
        }

        // Check if error is retryable
        if (error.isRetryable()) {
          const retryConfig = error.getRetryConfig();
          if (retryConfig) {
            try {
              this.emit(RecoveryEvent.RETRY_STARTED, { error, context });
              
              const result = await this.retryManager.executeWithRetry(
                operation,
                retryConfig,
                context,
                `${error.errorContext.errorCode}_${context.operation || 'unknown'}`
              );
              
              this.emit(RecoveryEvent.RETRY_SUCCESS, { error, context });
              return result;
            } catch (retryError) {
              this.emit(RecoveryEvent.RETRY_FAILED, { error: retryError, context });
              
              // If retry failed, try recovery
              if (retryError instanceof EnhancedAppError) {
                error = retryError;
              }
            }
          }
        }

        // Attempt recovery
        const recoveryResult = await this.recover(error as EnhancedAppError, context);
        
        if (recoveryResult.success) {
          recoveryAttempts++;
          
          // If recovery suggests retry, continue the loop
          if (recoveryResult.nextAction === RecoveryAction.RETRY) {
            continue;
          }
        }

        // Recovery failed or doesn't suggest retry
        throw error;
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
  getCircuitBreakerState(key: string) {
    return this.retryManager.getCircuitBreakerState(key);
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
  errorTracker?: ErrorTracker
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