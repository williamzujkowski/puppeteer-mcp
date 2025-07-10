/**
 * Factory for creating error results
 * @module puppeteer/actions/execution/error/error-result-factory
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of audit records"
 */

import type { ActionResult, BrowserAction, ValidationResult } from '../../../interfaces/action-executor.interface.js';
import type { ActionExecutionErrorDetails } from '../types.js';
import { ActionExecutionError } from '../types.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:error-result-factory');

/**
 * Factory for creating standardized error results
 * @nist si-11 "Error handling"
 */
export class ErrorResultFactory {
  /**
   * Create validation failure result
   * @param action - Action that failed validation
   * @param validationResult - Validation result
   * @param duration - Execution duration
   * @returns Standardized error result
   */
  static createValidationFailure<T = unknown>(
    action: BrowserAction,
    validationResult: ValidationResult,
    duration: number,
  ): ActionResult<T> {
    const errorMessage = validationResult.errors.map(e => e.message).join('; ');
    
    logger.warn('Creating validation failure result', {
      actionType: action.type,
      errors: validationResult.errors.length,
      warnings: validationResult.warnings?.length ?? 0,
    });

    return {
      success: false,
      actionType: action.type,
      error: `Validation failed: ${errorMessage}`,
      duration,
      timestamp: new Date(),
      metadata: {
        errorType: ActionExecutionError.VALIDATION_FAILED,
        validationErrors: validationResult.errors,
        validationWarnings: validationResult.warnings,
      },
    };
  }

  /**
   * Create execution error result
   * @param action - Action that failed
   * @param errorDetails - Classified error details
   * @param duration - Execution duration
   * @returns Standardized error result
   */
  static createExecutionError<T = unknown>(
    action: BrowserAction,
    errorDetails: ActionExecutionErrorDetails,
    duration: number,
  ): ActionResult<T> {
    logger.error('Creating execution error result', {
      actionType: action.type,
      errorType: errorDetails.type,
      message: errorDetails.message,
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
        stack: errorDetails.cause?.stack,
      },
    };
  }

  /**
   * Create page not found result
   * @param action - Action that couldn't find page
   * @param duration - Execution duration
   * @returns Standardized error result
   */
  static createPageNotFound<T = unknown>(
    action: BrowserAction,
    duration: number,
  ): ActionResult<T> {
    const errorMessage = `Page not found: ${action.pageId}`;
    
    logger.error('Creating page not found result', {
      actionType: action.type,
      pageId: action.pageId,
    });

    return {
      success: false,
      actionType: action.type,
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        errorType: ActionExecutionError.PAGE_NOT_FOUND,
        pageId: action.pageId,
      },
    };
  }

  /**
   * Create timeout error result
   * @param action - Action that timed out
   * @param timeoutType - Type of timeout
   * @param duration - Execution duration
   * @returns Standardized error result
   */
  static createTimeout<T = unknown>(
    action: BrowserAction,
    timeoutType: string,
    duration: number,
  ): ActionResult<T> {
    const errorMessage = `Action timed out: ${timeoutType} timeout exceeded`;
    
    logger.error('Creating timeout result', {
      actionType: action.type,
      timeoutType,
      duration,
    });

    return {
      success: false,
      actionType: action.type,
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        errorType: ActionExecutionError.TIMEOUT,
        timeoutType,
      },
    };
  }

  /**
   * Create handler not found result
   * @param action - Action without handler
   * @param duration - Execution duration
   * @returns Standardized error result
   */
  static createHandlerNotFound<T = unknown>(
    action: BrowserAction,
    duration: number,
  ): ActionResult<T> {
    const errorMessage = `No handler found for action type: ${action.type}`;
    
    logger.error('Creating handler not found result', {
      actionType: action.type,
    });

    return {
      success: false,
      actionType: action.type,
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        errorType: ActionExecutionError.HANDLER_NOT_FOUND,
        availableHandlers: [], // Could be populated with available handlers
      },
    };
  }

  /**
   * Create unknown error result
   * @param actionType - Type of action
   * @param error - Unknown error
   * @param duration - Execution duration
   * @returns Standardized error result
   */
  static createUnknownError<T = unknown>(
    actionType: string,
    error: unknown,
    duration: number,
  ): ActionResult<T> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logger.error('Creating unknown error result', {
      actionType,
      error: errorMessage,
    });

    return {
      success: false,
      actionType,
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        errorType: ActionExecutionError.EXECUTION_FAILED,
        originalError: String(error),
      },
    };
  }

  /**
   * Create retry exhausted result
   * @param action - Action that exhausted retries
   * @param lastError - Last error encountered
   * @param attempts - Number of attempts made
   * @param duration - Total execution duration
   * @returns Standardized error result
   */
  static createRetryExhausted<T = unknown>(
    action: BrowserAction,
    lastError: Error | null,
    attempts: number,
    duration: number,
  ): ActionResult<T> {
    const errorMessage = lastError 
      ? `Action failed after ${attempts} attempts: ${lastError.message}`
      : `Action failed after ${attempts} attempts`;
    
    logger.error('Creating retry exhausted result', {
      actionType: action.type,
      attempts,
      lastError: lastError?.message,
    });

    return {
      success: false,
      actionType: action.type,
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        errorType: ActionExecutionError.EXECUTION_FAILED,
        retryAttempts: attempts,
        lastError: lastError?.message,
        lastErrorStack: lastError?.stack,
      },
    };
  }

  /**
   * Enhance error result with additional metadata
   * @param result - Base error result
   * @param metadata - Additional metadata to add
   * @returns Enhanced error result
   */
  static enhance<T = unknown>(
    result: ActionResult<T>,
    metadata: Record<string, unknown>,
  ): ActionResult<T> {
    return {
      ...result,
      metadata: {
        ...result.metadata,
        ...metadata,
      },
    };
  }
}