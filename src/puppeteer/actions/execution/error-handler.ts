/**
 * Action execution error handling and retry logic
 * @module puppeteer/actions/execution/error-handler
 * @nist au-3 "Content of audit records"
 * @nist si-11 "Error handling"
 * 
 * This file maintains backward compatibility while delegating to modular components
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
} from '../../interfaces/action-executor.interface.js';
import type { RetryConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { createLogger } from '../../../utils/logger.js';

// Import modularized components
import { ErrorClassifier } from './error/error-classifier.js';
import { ErrorResultFactory } from './error/error-result-factory.js';
import { SecurityEventHandler } from './error/security-event-handler.js';
import { RetryExecutor, type RetryExecutionOptions } from './error/retry-executor.js';

const logger = createLogger('puppeteer:error-handler');

/**
 * Error handler for action execution
 * @nist si-11 "Error handling"
 * 
 * This class maintains the original API while delegating to specialized modules
 */
export class ActionErrorHandler {
  private readonly retryConfig: RetryConfig;
  private readonly errorClassifier: ErrorClassifier;
  private readonly securityEventHandler: SecurityEventHandler;
  private retryExecutor: RetryExecutor;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = { ...DEFAULT_CONFIG.RETRY, ...retryConfig };
    
    // Initialize modular components
    this.errorClassifier = new ErrorClassifier();
    this.securityEventHandler = new SecurityEventHandler();
    this.retryExecutor = new RetryExecutor(this.retryConfig);
  }

  /**
   * Handle validation failure
   * @param action - Action that failed validation
   * @param context - Execution context
   * @param validationResult - Validation result
   * @param duration - Execution duration so far
   * @returns Action result with error details
   */
  async handleValidationFailure<T = unknown>(
    action: BrowserAction,
    context: ActionContext,
    validationResult: ValidationResult,
    duration: number,
  ): Promise<ActionResult<T>> {
    logger.warn('Action validation failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType: action.type,
      errors: validationResult.errors,
      duration,
    });

    // Log security event using dedicated handler
    await this.securityEventHandler.logValidationFailure(
      context,
      action.type,
      validationResult,
      { pageId: action.pageId, duration },
    );

    // Create standardized result using factory
    return ErrorResultFactory.createValidationFailure<T>(
      action,
      validationResult,
      duration,
    );
  }

  /**
   * Handle execution error
   * @param action - Action that failed
   * @param context - Execution context
   * @param error - Error that occurred
   * @param duration - Execution duration so far
   * @returns Action result with error details
   */
  async handleExecutionError<T = unknown>(
    action: BrowserAction,
    context: ActionContext,
    error: unknown,
    duration: number,
  ): Promise<ActionResult<T>> {
    // Classify error using dedicated classifier
    const errorDetails = this.errorClassifier.classify(error, action);
    
    logger.error('Action execution failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType: action.type,
      errorType: errorDetails.type,
      errorMessage: errorDetails.message,
      duration,
    });

    // Log security event
    await this.securityEventHandler.logExecutionError(
      context,
      action.type,
      errorDetails,
      { pageId: action.pageId, duration },
    );

    // Analyze for security implications
    if (error instanceof Error) {
      await this.securityEventHandler.analyzeSecurityImplications(
        context,
        action.type,
        error,
      );
    }

    // Create standardized result
    return ErrorResultFactory.createExecutionError<T>(
      action,
      errorDetails,
      duration,
    );
  }

  /**
   * Create page not found result
   * @param action - Action that couldn't find page
   * @param duration - Execution duration so far
   * @returns Action result with page not found error
   */
  createPageNotFoundResult<T = unknown>(
    action: BrowserAction,
    duration: number,
  ): ActionResult<T> {
    logger.error('Page not found for action execution', {
      actionType: action.type,
      pageId: action.pageId,
      duration,
    });

    return ErrorResultFactory.createPageNotFound<T>(action, duration);
  }

  /**
   * Execute action with retry logic
   * @param handler - Action handler function
   * @param action - Action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeWithRetry(
    handler: (action: BrowserAction, page: Page, context: ActionContext) => Promise<ActionResult>,
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const options: RetryExecutionOptions = {
      strategy: 'exponential',
      enableRecovery: true,
      onRetry: (attempt, error) => {
        logger.warn('Action retry attempt', {
          sessionId: context.sessionId,
          contextId: context.contextId,
          actionType: action.type,
          attempt,
          error: error?.message,
        });
      },
      onRecovery: (errorType) => {
        logger.info('Recovery attempted', {
          sessionId: context.sessionId,
          contextId: context.contextId,
          actionType: action.type,
          errorType,
        });
      },
    };

    try {
      const result = await this.retryExecutor.execute({
        handler,
        action,
        page,
        context,
        options,
      });

      // Log successful retry if applicable
      const metadata = result.metadata;
      const retryAttempts = metadata?.retryAttempts as number | undefined;
      
      if (result.success && retryAttempts !== undefined && retryAttempts > 1) {
        await this.securityEventHandler.logSuccessfulRetry(
          context,
          action.type,
          retryAttempts,
          { duration: result.duration },
        );
      }

      return result;
    } catch (error) {
      // Handle retry exhaustion
      const lastError = error instanceof Error ? error : new Error('Unknown error');
      const retryConfig = this.getRetryConfig();
      
      await this.securityEventHandler.logMaxRetriesExceeded(
        context,
        action.type,
        retryConfig.maxRetries,
        lastError.message,
      );

      throw lastError;
    }
  }


  /**
   * Get retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    Object.assign(this.retryConfig, config);
    // Recreate retry executor with new config
    this.retryExecutor = new RetryExecutor(this.retryConfig);
  }
}

// Re-export all error handling modules for convenience
export * from './error/index.js';