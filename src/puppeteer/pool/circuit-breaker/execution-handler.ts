/**
 * Execution handler for circuit breaker operations
 * @module puppeteer/pool/circuit-breaker/execution-handler
 * @nist au-5 "Response to audit processing failures"
 */

import { CircuitBreakerState, ExecutionResult, StateTransitionContext } from './types.js';
import { CircuitBreakerStateMachine } from './state-management.js';
import { MetricsCollector } from './metrics-monitor.js';
import { CacheManager } from './cache-manager.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('circuit-breaker-execution');

/**
 * Handles execution logic for circuit breaker operations
 * @nist au-5 "Response to audit processing failures"
 */
export class ExecutionHandler {
  constructor(
    private name: string,
    private stateMachine: CircuitBreakerStateMachine,
    private metricsCollector: MetricsCollector,
    private cacheManager: CacheManager,
    private emitEvent: (event: any) => void,
  ) {}

  /**
   * Handle successful execution
   */
  async handleSuccess<T>(
    result: T,
    startTime: number,
    cacheKey?: string,
    failureDetectionStrategy?: any,
    config?: any,
  ): Promise<ExecutionResult<T>> {
    const executionTime = Date.now() - startTime;

    // Record metrics
    this.metricsCollector.recordSuccess(executionTime);

    // Cache result if key provided
    if (cacheKey) {
      this.cacheManager.set(cacheKey, result);
    }

    // Check for state transition
    const context: StateTransitionContext = {
      trigger: 'success',
    };

    // Check if we should close circuit from half-open
    if (this.stateMachine.getState() === CircuitBreakerState.HALF_OPEN) {
      const shouldClose = failureDetectionStrategy?.shouldClose(
        this.metricsCollector.getRecentSuccesses(),
        config,
      );

      if (shouldClose) {
        context.trigger = 'success_threshold_reached';
        context.successCount = this.metricsCollector.getRecentSuccesses().length;
      }
    }

    const newState = this.stateMachine.handleSuccess(context);

    this.emitEvent({
      type: 'success',
      state: this.stateMachine.getState(),
      timestamp: new Date(),
      context: { executionTime, cacheKey },
    });

    return {
      success: true,
      result,
      executionTime,
      fromCache: false,
      circuitState: this.stateMachine.getState(),
      newState,
      context,
    } as any;
  }

  /**
   * Handle failed execution
   */
  async handleFailure<T>(
    error: Error,
    fallback?: () => Promise<T>,
    cacheKey?: string,
    startTime?: number,
    failureDetectionStrategy?: any,
    config?: any,
  ): Promise<ExecutionResult<T>> {
    const executionTime = startTime ? Date.now() - startTime : 0;

    // Record metrics
    this.metricsCollector.recordFailure(error);

    // Check for state transition
    const context: StateTransitionContext = {
      trigger: 'failure',
      error,
    };

    // Check if we should open circuit
    if (this.stateMachine.getState() === CircuitBreakerState.CLOSED) {
      const shouldOpen = failureDetectionStrategy?.shouldOpen(
        this.metricsCollector.getRecentFailures(),
        this.metricsCollector.getRecentRequests(),
        config,
      );

      if (shouldOpen) {
        context.trigger = 'failure_threshold_reached';
      }
    } else if (this.stateMachine.getState() === CircuitBreakerState.HALF_OPEN) {
      context.trigger = 'failure_in_half_open';
    }

    const newState = this.stateMachine.handleFailure(context);

    this.emitEvent({
      type: 'failure',
      state: this.stateMachine.getState(),
      timestamp: new Date(),
      error,
      context: { executionTime, cacheKey },
    });

    // Try fallback
    const fallbackResult = await this.tryFallback(fallback, cacheKey);
    if (fallbackResult) {
      return {
        success: true,
        result: fallbackResult.result,
        executionTime,
        fromCache: fallbackResult.fromCache,
        circuitState: this.stateMachine.getState(),
        newState,
        context,
      } as any;
    }

    return {
      success: false,
      error,
      executionTime,
      fromCache: false,
      circuitState: this.stateMachine.getState(),
      newState,
      context,
    } as any;
  }

  /**
   * Handle open circuit
   */
  async handleOpenCircuit<T>(
    fallback?: () => Promise<T>,
    cacheKey?: string,
    startTime?: number,
  ): Promise<ExecutionResult<T>> {
    const executionTime = startTime ? Date.now() - startTime : 0;

    this.emitEvent({
      type: 'rejection',
      state: this.stateMachine.getState(),
      timestamp: new Date(),
      context: { reason: 'circuit_open', cacheKey },
    });

    // Try fallback
    const fallbackResult = await this.tryFallback(fallback, cacheKey);
    if (fallbackResult) {
      return {
        success: true,
        result: fallbackResult.result,
        executionTime,
        fromCache: fallbackResult.fromCache,
        circuitState: this.stateMachine.getState(),
      };
    }

    return {
      success: false,
      error: new Error('Circuit breaker is open'),
      executionTime,
      fromCache: false,
      circuitState: this.stateMachine.getState(),
    };
  }

  /**
   * Try fallback or cache
   */
  private async tryFallback<T>(
    fallback?: () => Promise<T>,
    cacheKey?: string,
  ): Promise<{ result: T; fromCache: boolean } | null> {
    // Try fallback function first
    if (fallback) {
      try {
        const result = await fallback();
        return { result, fromCache: false };
      } catch (fallbackError) {
        logger.debug(
          {
            circuitBreaker: this.name,
            error: fallbackError,
          },
          'Fallback execution failed',
        );
      }
    }

    // Try cache
    if (cacheKey) {
      const cachedResult = this.cacheManager.get(cacheKey);
      if (cachedResult !== null) {
        return { result: cachedResult, fromCache: true };
      }
    }

    return null;
  }
}
