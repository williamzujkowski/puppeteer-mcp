/**
 * Error tracking and exception instrumentation
 * @module telemetry/instrumentations/puppeteer/error-instrumentation
 * @nist au-2 "Audit events"
 */

import type { Span } from '@opentelemetry/api';
import { recordError } from './trace-manager.js';
import { PuppeteerMetricsCollector } from './metrics-collector.js';
import type { ErrorType, ErrorData, InstrumentationContext } from './types.js';

/**
 * Error instrumentation manager
 */
export class ErrorInstrumentation {
  private metricsCollector: PuppeteerMetricsCollector;

  constructor(context: InstrumentationContext) {
    this.metricsCollector = new PuppeteerMetricsCollector(context.metrics);
  }

  /**
   * Handle and record error in span
   */
  handleError(
    span: Span,
    error: Error,
    operation: string,
    additionalData?: Record<string, any>,
  ): void {
    // Record error in span
    recordError(span, error);

    // Classify error type
    const errorType = this.classifyError(error);

    // Record metrics
    this.metricsCollector.recordError(errorType, operation, error.message);

    // Add additional context
    if (additionalData) {
      span.setAttributes(additionalData);
    }

    // Add error classification
    span.setAttributes({
      'error.type': errorType,
      'error.operation': operation,
      'error.classified': true,
    });
  }

  /**
   * Classify error type based on error properties
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (this.isTimeoutError(name, message)) return 'timeout';
    if (this.isNavigationError(message)) return 'navigation';
    if (this.isEvaluationError(message)) return 'evaluation';
    if (this.isNetworkError(message)) return 'network';
    if (this.isScreenshotError(message)) return 'screenshot';
    if (this.isPdfError(message)) return 'pdf';

    return 'unknown';
  }

  private isTimeoutError(name: string, message: string): boolean {
    return name.includes('timeout') || message.includes('timeout');
  }

  private isNavigationError(message: string): boolean {
    return message.includes('navigation') || message.includes('navigate');
  }

  private isEvaluationError(message: string): boolean {
    return message.includes('evaluation') || message.includes('evaluate');
  }

  private isNetworkError(message: string): boolean {
    return message.includes('net::') || message.includes('network');
  }

  private isScreenshotError(message: string): boolean {
    return message.includes('screenshot');
  }

  private isPdfError(message: string): boolean {
    return message.includes('pdf');
  }

  /**
   * Create error data object
   */
  createErrorData(
    error: Error,
    operation: string,
    additionalContext?: Record<string, any>,
  ): ErrorData {
    return {
      type: this.classifyError(error),
      message: error.message,
      stack: error.stack,
      operation,
      ...additionalContext,
    };
  }

  /**
   * Handle timeout errors specifically
   */
  handleTimeoutError(span: Span, error: Error, operation: string, timeout: number): void {
    this.handleError(span, error, operation, {
      'error.timeout.value': timeout,
      'error.timeout.operation': operation,
    });

    // Record timeout-specific metrics
    this.metricsCollector.recordError('timeout', operation);
  }

  /**
   * Handle navigation errors
   */
  handleNavigationError(
    span: Span,
    error: Error,
    url: string,
    options?: Record<string, any>,
  ): void {
    this.handleError(span, error, 'navigation', {
      'error.navigation.url': url,
      'error.navigation.timeout': options?.timeout,
      'error.navigation.wait_until': options?.waitUntil,
    });
  }

  /**
   * Handle evaluation errors
   */
  handleEvaluationError(span: Span, error: Error, functionLength: number, argsCount: number): void {
    this.handleError(span, error, 'evaluation', {
      'error.evaluation.function_length': functionLength,
      'error.evaluation.args_count': argsCount,
    });
  }

  /**
   * Check if error is recoverable
   */
  isRecoverableError(error: Error): boolean {
    const recoverablePatterns = [
      /net::ERR_INTERNET_DISCONNECTED/,
      /net::ERR_CONNECTION_TIMED_OUT/,
      /Target closed/,
      /Protocol error/,
    ];

    return recoverablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Get error severity level
   */
  getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();

    // Critical errors that indicate serious problems
    if (message.includes('crash') || message.includes('fatal')) {
      return 'critical';
    }

    // High severity errors
    if (message.includes('timeout') || message.includes('connection')) {
      return 'high';
    }

    // Medium severity errors
    if (message.includes('navigation') || message.includes('element')) {
      return 'medium';
    }

    // Low severity errors
    return 'low';
  }
}

/**
 * Create error handler function
 */
export function createErrorHandler(
  context: InstrumentationContext,
): (span: Span, error: Error, operation: string, additionalData?: Record<string, any>) => void {
  const errorInstrumentation = new ErrorInstrumentation(context);

  return (
    span: Span,
    error: Error,
    operation: string,
    additionalData?: Record<string, any>,
  ): void => {
    errorInstrumentation.handleError(span, error, operation, additionalData);
  };
}

/**
 * Wrap function with error instrumentation
 */
export function withErrorInstrumentation<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  span: Span,
  operation: string,
  context: InstrumentationContext,
): (...args: T) => Promise<R> {
  const errorHandler = createErrorHandler(context);

  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      errorHandler(span, error as Error, operation);
      throw error;
    }
  };
}

/**
 * Global error handler for uncaught exceptions
 */
export function setupGlobalErrorHandler(context: InstrumentationContext): void {
  const errorInstrumentation = new ErrorInstrumentation(context);

  process.on('uncaughtException', (error: Error) => {
    const errorData = errorInstrumentation.createErrorData(error, 'uncaught');
    console.error('Uncaught exception in Puppeteer instrumentation:', errorData);
  });

  process.on('unhandledRejection', (reason: any) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const errorData = errorInstrumentation.createErrorData(error, 'unhandled_rejection');
    console.error('Unhandled rejection in Puppeteer instrumentation:', errorData);
  });
}
