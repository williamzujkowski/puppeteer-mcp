/**
 * Action execution error handling and retry logic
 * @module puppeteer/actions/execution/error-handler
 * @nist au-3 "Content of audit records"
 * @nist si-11 "Error handling"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
} from '../../interfaces/action-executor.interface.js';
import type {
  RetryConfig,
  ActionExecutionError,
  ActionExecutionErrorDetails,
} from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:error-handler');

/**
 * Error handler for action execution
 * @nist si-11 "Error handling"
 */
export class ActionErrorHandler {
  private readonly retryConfig: RetryConfig;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = { ...DEFAULT_CONFIG.RETRY, ...retryConfig };
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
    const errorMessage = validationResult.errors.map(e => e.message).join('; ');
    
    logger.warn('Action validation failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType: action.type,
      errors: validationResult.errors,
      duration,
    });

    // Log security event for validation failure
    await logSecurityEvent(SecurityEventType.VALIDATION_FAILED, {
      userId: context.userId,
      resource: `page:${action.pageId}`,
      action: `${action.type}_validation`,
      result: 'failure',
      reason: errorMessage,
      metadata: {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        validationErrors: validationResult.errors,
        duration,
      },
    });

    return {
      success: false,
      actionType: action.type,
      error: `Validation failed: ${errorMessage}`,
      duration,
      timestamp: new Date(),
      metadata: {
        validationErrors: validationResult.errors,
        validationWarnings: validationResult.warnings,
      },
    };
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
    const errorDetails = this.analyzeError(error, action);
    
    logger.error('Action execution failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType: action.type,
      errorType: errorDetails.type,
      errorMessage: errorDetails.message,
      duration,
    });

    // Log security event for execution error
    await logSecurityEvent(SecurityEventType.COMMAND_EXECUTED, {
      userId: context.userId,
      resource: `page:${action.pageId}`,
      action: `${action.type}_error`,
      result: 'failure',
      reason: errorDetails.message,
      metadata: {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        errorType: errorDetails.type,
        errorContext: errorDetails.context,
        duration,
      },
    });

    return {
      success: false,
      actionType: action.type,
      error: errorDetails.message,
      duration,
      timestamp: new Date(),
      metadata: {
        errorType: errorDetails.type,
        errorDetails: errorDetails.context,
        cause: errorDetails.cause?.message,
      },
    };
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
    const errorMessage = `Page not found: ${action.pageId}`;
    
    logger.error('Page not found for action execution', {
      actionType: action.type,
      pageId: action.pageId,
      duration,
    });

    return {
      success: false,
      actionType: action.type,
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        errorType: 'PAGE_NOT_FOUND',
        pageId: action.pageId,
      },
    };
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
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.retryConfig.maxRetries) {
      attempt++;
      
      try {
        logger.debug('Executing action', {
          sessionId: context.sessionId,
          contextId: context.contextId,
          actionType: action.type,
          attempt,
          maxRetries: this.retryConfig.maxRetries,
        });

        const result = await handler(action, page, context);

        if (result.success || attempt === this.retryConfig.maxRetries) {
          if (attempt > 1) {
            logger.info('Action succeeded after retries', {
              sessionId: context.sessionId,
              contextId: context.contextId,
              actionType: action.type,
              attempt,
              success: result.success,
            });
          }
          return result;
        }

        // Log retry attempt for failed result
        logger.warn('Action failed, will retry', {
          sessionId: context.sessionId,
          contextId: context.contextId,
          actionType: action.type,
          attempt,
          error: result.error,
        });

        if (attempt < this.retryConfig.maxRetries) {
          await this.waitBeforeRetry(attempt);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        logger.warn('Action threw error, will retry', {
          sessionId: context.sessionId,
          contextId: context.contextId,
          actionType: action.type,
          attempt,
          error: lastError.message,
        });

        if (attempt < this.retryConfig.maxRetries) {
          // Check if error is retryable
          if (!this.isRetryableError(error)) {
            logger.info('Error is not retryable, stopping attempts', {
              sessionId: context.sessionId,
              contextId: context.contextId,
              actionType: action.type,
              error: lastError.message,
            });
            break;
          }

          await this.waitBeforeRetry(attempt);
        }
      }
    }

    // If we get here, all retries failed
    throw lastError ?? new Error('Action execution failed after retries');
  }

  /**
   * Check if error is retryable
   * @param error - Error to check
   * @returns True if error should be retried
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    
    // Non-retryable errors
    const nonRetryablePatterns = [
      'page closed',
      'browser closed',
      'session closed',
      'invalid selector',
      'invalid argument',
      'security error',
      'permission denied',
      'not supported',
    ];

    for (const pattern of nonRetryablePatterns) {
      if (message.includes(pattern)) {
        return false;
      }
    }

    // Retryable errors
    const retryablePatterns = [
      'timeout',
      'network error',
      'connection refused',
      'element not found',
      'element not visible',
      'element not interactable',
      'waiting for',
      'navigation failed',
    ];

    for (const pattern of retryablePatterns) {
      if (message.includes(pattern)) {
        return true;
      }
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Wait before retry with exponential backoff
   * @param attempt - Current attempt number
   */
  private async waitBeforeRetry(attempt: number): Promise<void> {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
      this.retryConfig.maxDelay,
    );

    logger.debug('Waiting before retry', { attempt, delay });
    
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  /**
   * Analyze error to determine type and details
   * @param error - Error to analyze
   * @param action - Action that caused the error
   * @returns Error details
   */
  private analyzeError(error: unknown, action?: BrowserAction): ActionExecutionErrorDetails {
    if (!(error instanceof Error)) {
      return {
        type: ActionExecutionError.EXECUTION_FAILED,
        message: 'Unknown error occurred',
        action,
        context: { originalError: String(error) },
      };
    }

    const message = error.message.toLowerCase();
    
    // Analyze common error patterns
    if (message.includes('timeout')) {
      return {
        type: ActionExecutionError.TIMEOUT,
        message: `Action timed out: ${error.message}`,
        cause: error,
        action,
        context: { timeoutType: this.getTimeoutType(message) },
      };
    }

    if (message.includes('element not found') || message.includes('no such element')) {
      return {
        type: ActionExecutionError.ELEMENT_NOT_FOUND,
        message: `Element not found: ${error.message}`,
        cause: error,
        action,
        context: { selector: this.extractSelector(message) },
      };
    }

    if (message.includes('navigation') && message.includes('failed')) {
      return {
        type: ActionExecutionError.NAVIGATION_FAILED,
        message: `Navigation failed: ${error.message}`,
        cause: error,
        action,
        context: { url: this.extractUrl(message) },
      };
    }

    if (message.includes('page') && (message.includes('closed') || message.includes('crashed'))) {
      return {
        type: ActionExecutionError.PAGE_NOT_FOUND,
        message: `Page is no longer available: ${error.message}`,
        cause: error,
        action,
      };
    }

    if (message.includes('evaluation') || message.includes('evaluate')) {
      return {
        type: ActionExecutionError.EVALUATION_FAILED,
        message: `JavaScript evaluation failed: ${error.message}`,
        cause: error,
        action,
      };
    }

    if (message.includes('upload') || message.includes('file')) {
      return {
        type: ActionExecutionError.FILE_UPLOAD_FAILED,
        message: `File operation failed: ${error.message}`,
        cause: error,
        action,
      };
    }

    if (message.includes('click') || message.includes('type') || message.includes('interact')) {
      return {
        type: ActionExecutionError.INTERACTION_FAILED,
        message: `Interaction failed: ${error.message}`,
        cause: error,
        action,
      };
    }

    // Default case
    return {
      type: ActionExecutionError.EXECUTION_FAILED,
      message: error.message,
      cause: error,
      action,
    };
  }

  /**
   * Extract timeout type from error message
   */
  private getTimeoutType(message: string): string {
    if (message.includes('navigation')) return 'navigation';
    if (message.includes('selector')) return 'selector';
    if (message.includes('element')) return 'element';
    if (message.includes('network')) return 'network';
    return 'general';
  }

  /**
   * Extract selector from error message
   */
  private extractSelector(message: string): string | undefined {
    const selectorMatch = message.match(/selector[:\s]*['"`]([^'"`]+)['"`]/i);
    return selectorMatch?.[1];
  }

  /**
   * Extract URL from error message
   */
  private extractUrl(message: string): string | undefined {
    const urlMatch = message.match(/url[:\s]*['"`]([^'"`]+)['"`]/i);
    if (urlMatch) return urlMatch[1];
    
    // Try to match HTTP(S) URLs
    const httpMatch = message.match(/(https?:\/\/[^\s]+)/i);
    return httpMatch?.[1];
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
  }
}