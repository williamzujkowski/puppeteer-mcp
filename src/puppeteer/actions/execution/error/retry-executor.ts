/**
 * Retry execution coordinator
 * @module puppeteer/actions/execution/error/retry-executor
 * @nist si-11 "Error handling"
 * @nist cp-10 "Information system recovery and reconstitution"
 */

import type { Page } from 'puppeteer';
import type { BrowserAction, ActionContext, ActionResult } from '../../../interfaces/action-executor.interface.js';
import type { ActionHandler, RetryConfig } from '../types.js';
import { RetryStrategy, RetryStrategyFactory } from './retry-strategy.js';
import { ErrorClassifier } from './error-classifier.js';
import { ErrorRecoveryChain, RecoveryChainFactory } from './error-recovery.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:retry-executor');

/**
 * Retry execution options
 */
export interface RetryExecutionOptions {
  strategy?: 'exponential' | 'linear' | 'fibonacci' | 'adaptive';
  enableRecovery?: boolean;
  onRetry?: (attempt: number, error?: Error) => void;
  onRecovery?: (errorType: string) => void;
}

/**
 * Execution parameters for retry executor
 */
export interface ExecuteParams {
  handler: ActionHandler;
  action: BrowserAction;
  page: Page;
  context: ActionContext;
  options?: RetryExecutionOptions;
}

/**
 * Retry executor for action handlers
 * @nist si-11 "Error handling"
 * @nist cp-10 "Information system recovery and reconstitution"
 */
export class RetryExecutor {
  private readonly retryStrategy: RetryStrategy;
  private readonly errorClassifier: ErrorClassifier;
  private readonly recoveryChain: ErrorRecoveryChain;
  private readonly enableRecovery: boolean;

  constructor(
    retryConfig?: Partial<RetryConfig>,
    options?: RetryExecutionOptions,
  ) {
    const strategyType = options?.strategy ?? 'exponential';
    this.retryStrategy = RetryStrategyFactory.create(strategyType, retryConfig);
    this.errorClassifier = new ErrorClassifier();
    this.recoveryChain = RecoveryChainFactory.createDefault();
    this.enableRecovery = options?.enableRecovery ?? true;
  }

  /**
   * Execute action handler with retry logic
   * @param params - Execution parameters
   * @returns Action result
   */
  async execute(params: ExecuteParams): Promise<ActionResult> {
    const { handler, action, page, context, options } = params;
    let lastError: Error | null = null;
    let attempt = 0;

    while (true) {
      attempt++;
      
      try {
        const result = await this.executeAttempt({ handler, action, page, context, attempt });
        
        if (result.success) {
          this.logSuccessfulExecution(context, action.type, attempt);
          return result;
        }

        // Handle non-exception failures
        if (!this.shouldRetryResult(result, attempt)) {
          return result;
        }

        // Convert result error to exception for retry handling
        lastError = new Error(result.error ?? 'Action failed');
        
      } catch (error) {
        lastError = this.normalizeError(error);
        this.logExecutionError(context, action.type, attempt, lastError);
      }

      // Check retry conditions
      const shouldContinue = await this.checkRetryConditions({
        attempt,
        lastError,
        action,
        page,
        context,
        options,
      });

      if (!shouldContinue) {
        break;
      }

      // Wait before retry
      await this.waitForRetry(attempt, lastError, options);
    }

    // All retries exhausted
    throw lastError ?? new Error('Action execution failed after retries');
  }

  /**
   * Execute a single attempt
   */
  private async executeAttempt(params: {
    handler: ActionHandler;
    action: BrowserAction;
    page: Page;
    context: ActionContext;
    attempt: number;
  }): Promise<ActionResult> {
    const { handler, action, page, context, attempt } = params;
    logger.debug('Executing action with retry support', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType: action.type,
      attempt,
    });

    return handler(action, page, context);
  }

  /**
   * Log successful execution
   */
  private logSuccessfulExecution(
    context: ActionContext,
    actionType: string,
    attempt: number,
  ): void {
    if (attempt > 1) {
      logger.info('Action succeeded after retries', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType,
        attempt,
      });
    }
  }

  /**
   * Log execution error
   */
  private logExecutionError(
    context: ActionContext,
    actionType: string,
    attempt: number,
    error: Error,
  ): void {
    logger.warn('Action threw error', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType,
      attempt,
      error: error.message,
    });
  }

  /**
   * Check if retry should continue
   */
  private async checkRetryConditions(params: {
    attempt: number;
    lastError: Error | null;
    action: BrowserAction;
    page: Page;
    context: ActionContext;
    options?: RetryExecutionOptions;
  }): Promise<boolean> {
    const { attempt, lastError, action, page, context, options } = params;
    if (!lastError) return false;

    // Check if we should retry
    if (!this.retryStrategy.shouldRetry(attempt, lastError)) {
      return false;
    }

    // Check if error is retryable
    if (!this.errorClassifier.isRetryable(lastError)) {
      logger.info('Error is not retryable', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        error: lastError.message,
      });
      return false;
    }

    // Attempt recovery if enabled
    if (this.enableRecovery) {
      const recovered = await this.attemptRecovery({
        error: lastError,
        action,
        page,
        context,
        options,
      });
      
      if (!recovered && attempt >= 2) {
        // Skip further retries if recovery failed after multiple attempts
        return false;
      }
    }

    return true;
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(params: {
    error: Error;
    action: BrowserAction;
    page: Page;
    context: ActionContext;
    options?: RetryExecutionOptions;
  }): Promise<boolean> {
    const { error, action, page, context, options } = params;
    const errorDetails = this.errorClassifier.classify(error, action);
    const recovered = await this.recoveryChain.attemptRecovery(
      page,
      action,
      context,
      errorDetails,
    );

    if (recovered) {
      options?.onRecovery?.(errorDetails.type);
    }

    return recovered;
  }

  /**
   * Wait before retry
   */
  private async waitForRetry(
    attempt: number,
    lastError: Error | null,
    options?: RetryExecutionOptions,
  ): Promise<void> {
    const delay = this.retryStrategy.getDelay(attempt);
    await this.wait(delay);

    // Notify retry callbacks
    this.retryStrategy.onRetryAttempt(attempt, lastError ?? undefined);
    options?.onRetry?.(attempt, lastError ?? undefined);
  }

  /**
   * Check if result should be retried
   */
  private shouldRetryResult(result: ActionResult, attempt: number): boolean {
    if (result.success) return false;
    
    const config = this.retryStrategy.getConfig();
    return attempt < config.maxRetries;
  }

  /**
   * Normalize error to Error instance
   */
  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Wait for specified duration
   */
  private async wait(ms: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset retry executor state
   */
  reset(): void {
    this.recoveryChain.reset();
    if ('reset' in this.retryStrategy && typeof this.retryStrategy.reset === 'function') {
      this.retryStrategy.reset();
    }
  }
}