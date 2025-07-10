/**
 * Error classification and analysis module
 * @module puppeteer/actions/execution/error/error-classifier
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of audit records"
 */

import type { BrowserAction } from '../../../interfaces/action-executor.interface.js';
import { ActionExecutionError, type ActionExecutionErrorDetails } from '../types.js';

/**
 * Error classification patterns
 */
interface ErrorPattern {
  patterns: string[];
  type: ActionExecutionError;
  extractor?: (message: string) => Record<string, unknown>;
}

/**
 * Error classifier for action execution errors
 * @nist si-11 "Error handling"
 */
export class ErrorClassifier {
  private readonly errorPatterns: ErrorPattern[] = [
    {
      patterns: ['timeout'],
      type: ActionExecutionError.TIMEOUT,
      extractor: (message) => ({ timeoutType: this.extractTimeoutType(message) }),
    },
    {
      patterns: ['element not found', 'no such element'],
      type: ActionExecutionError.ELEMENT_NOT_FOUND,
      extractor: (message) => ({ selector: this.extractSelector(message) }),
    },
    {
      patterns: ['navigation', 'failed'],
      type: ActionExecutionError.NAVIGATION_FAILED,
      extractor: (message) => ({ url: this.extractUrl(message) }),
    },
    {
      patterns: ['page', 'closed', 'crashed'],
      type: ActionExecutionError.PAGE_NOT_FOUND,
    },
    {
      patterns: ['evaluation', 'evaluate'],
      type: ActionExecutionError.EVALUATION_FAILED,
    },
    {
      patterns: ['upload', 'file'],
      type: ActionExecutionError.FILE_UPLOAD_FAILED,
    },
    {
      patterns: ['click', 'type', 'interact'],
      type: ActionExecutionError.INTERACTION_FAILED,
    },
  ];

  /**
   * Classify an error and extract details
   * @param error - Error to classify
   * @param action - Action that caused the error
   * @returns Error details with classification
   */
  classify(error: unknown, action?: BrowserAction): ActionExecutionErrorDetails {
    if (!(error instanceof Error)) {
      return this.createUnknownError(error, action);
    }

    const message = error.message.toLowerCase();
    
    // Check each pattern
    for (const pattern of this.errorPatterns) {
      if (this.matchesPattern(message, pattern.patterns)) {
        const context = pattern.extractor?.(message) ?? {};
        
        return {
          type: pattern.type,
          message: this.formatErrorMessage(pattern.type, error.message),
          cause: error,
          action,
          context,
        };
      }
    }

    // Default classification
    return {
      type: ActionExecutionError.EXECUTION_FAILED,
      message: error.message,
      cause: error,
      action,
    };
  }

  /**
   * Check if message matches any of the patterns
   */
  private matchesPattern(message: string, patterns: string[]): boolean {
    return patterns.every(pattern => message.includes(pattern));
  }

  /**
   * Format error message based on type
   */
  private formatErrorMessage(type: ActionExecutionError, originalMessage: string): string {
    const prefixes = new Map<ActionExecutionError, string>([
      [ActionExecutionError.TIMEOUT, 'Action timed out'],
      [ActionExecutionError.ELEMENT_NOT_FOUND, 'Element not found'],
      [ActionExecutionError.NAVIGATION_FAILED, 'Navigation failed'],
      [ActionExecutionError.PAGE_NOT_FOUND, 'Page is no longer available'],
      [ActionExecutionError.EVALUATION_FAILED, 'JavaScript evaluation failed'],
      [ActionExecutionError.FILE_UPLOAD_FAILED, 'File operation failed'],
      [ActionExecutionError.INTERACTION_FAILED, 'Interaction failed'],
      [ActionExecutionError.VALIDATION_FAILED, 'Validation failed'],
      [ActionExecutionError.UNKNOWN_ACTION, 'Unknown action type'],
      [ActionExecutionError.HANDLER_NOT_FOUND, 'Handler not found'],
      [ActionExecutionError.EXECUTION_FAILED, 'Execution failed'],
    ]);

    const prefix = prefixes.get(type) ?? 'Error occurred';
    return `${prefix}: ${originalMessage}`;
  }

  /**
   * Create error details for unknown error
   */
  private createUnknownError(error: unknown, action?: BrowserAction): ActionExecutionErrorDetails {
    return {
      type: ActionExecutionError.EXECUTION_FAILED,
      message: 'Unknown error occurred',
      action,
      context: { originalError: String(error) },
    };
  }

  /**
   * Extract timeout type from error message
   */
  private extractTimeoutType(message: string): string {
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
   * Check if error indicates a retryable condition
   * @param error - Error to check
   * @returns True if error should be retried
   */
  isRetryable(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    
    // Non-retryable patterns
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

    if (nonRetryablePatterns.some(pattern => message.includes(pattern))) {
      return false;
    }

    // Retryable patterns
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

    if (retryablePatterns.some(pattern => message.includes(pattern))) {
      return true;
    }

    // Default to retryable for unknown errors
    return true;
  }
}