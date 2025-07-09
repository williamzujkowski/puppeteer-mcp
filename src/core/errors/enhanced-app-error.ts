/**
 * Enhanced application error class with comprehensive error context
 * @module core/errors/enhanced-app-error
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { AppError } from './app-error.js';
import { ErrorContext, ErrorContextBuilder, ErrorCategory, ErrorSeverity, RecoveryAction, RetryConfig } from './error-context.js';

/**
 * Options for EnhancedAppError constructor
 */
export interface EnhancedAppErrorOptions {
  message: string;
  context: ErrorContext;
  statusCode?: number;
  isOperational?: boolean;
  details?: Record<string, unknown>;
}

/**
 * Enhanced application error with comprehensive context
 */
export class EnhancedAppError extends AppError {
  public readonly errorContext: ErrorContext;

  constructor(options: EnhancedAppErrorOptions) {
    const { message, context, statusCode, isOperational, details } = options;
    
    super(
      message,
      statusCode ?? context.context?.statusCode ?? 500,
      isOperational ?? true,
      details
    );
    
    this.errorContext = context;
    this.name = 'EnhancedAppError';
    
    // Set proper prototype
    Object.setPrototypeOf(this, EnhancedAppError.prototype);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.errorContext.userMessage;
  }

  /**
   * Get technical details
   */
  getTechnicalDetails(): Record<string, unknown> {
    return this.errorContext.technicalDetails ?? {};
  }

  /**
   * Get recovery suggestions
   */
  getRecoverySuggestions(): RecoveryAction[] | undefined {
    return this.errorContext.recoverySuggestions;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.errorContext.retryConfig !== undefined;
  }

  /**
   * Get retry configuration
   */
  getRetryConfig(): RetryConfig | null | undefined {
    return this.errorContext.retryConfig;
  }

  /**
   * Get error severity
   */
  getSeverity(): ErrorSeverity {
    return this.errorContext.severity;
  }

  /**
   * Get error category
   */
  getCategory(): ErrorCategory {
    return this.errorContext.category;
  }

  /**
   * Get help links
   */
  getHelpLinks(): ErrorContext['helpLinks'] | undefined {
    return this.errorContext.helpLinks;
  }

  /**
   * Check if error should be reported to monitoring
   */
  shouldReport(): boolean {
    return this.errorContext.shouldReport !== false;
  }

  /**
   * Check if error contains sensitive data
   */
  containsSensitiveData(): boolean {
    return this.errorContext.containsSensitiveData === true;
  }

  /**
   * Get correlation IDs
   */
  getCorrelationIds(): string[] {
    return this.errorContext.context?.correlationIds ?? [];
  }

  /**
   * Get request ID
   */
  getRequestId(): string | undefined {
    return this.errorContext.context?.requestId;
  }

  /**
   * Get user ID
   */
  getUserId(): string | undefined {
    return this.errorContext.context?.userId;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | undefined {
    return this.errorContext.context?.sessionId;
  }

  /**
   * Get operation name
   */
  getOperation(): string | undefined {
    return this.errorContext.context?.operation;
  }

  /**
   * Get resource name
   */
  getResource(): string | undefined {
    return this.errorContext.context?.resource;
  }

  /**
   * Get error tags
   */
  getTags(): Record<string, string> {
    return this.errorContext.tags ?? {};
  }

  /**
   * Serialize error for JSON response
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      errorCode: this.errorContext.errorCode,
      category: this.errorContext.category,
      severity: this.errorContext.severity,
      userMessage: this.errorContext.userMessage,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      recoverySuggestions: this.errorContext.recoverySuggestions,
      context: this.errorContext.context,
      helpLinks: this.errorContext.helpLinks,
      tags: this.errorContext.tags,
      timestamp: this.errorContext.context?.timestamp,
      ...(this.errorContext.technicalDetails && { technicalDetails: this.errorContext.technicalDetails }),
      ...(this.errorContext.retryConfig && { retryConfig: this.errorContext.retryConfig }),
    };
  }

  /**
   * Create an enhanced error from a regular error
   */
  static fromError(error: Error, context: ErrorContext): EnhancedAppError {
    const enhancedError = new EnhancedAppError({
      message: error.message,
      context,
      statusCode: context.context?.statusCode,
      isOperational: true,
      details: { originalError: error.name }
    });
    
    // Preserve stack trace
    if (error.stack !== undefined) {
      enhancedError.stack = error.stack;
    }
    
    return enhancedError;
  }

  /**
   * Create an enhanced error from an AppError
   */
  static fromAppError(appError: AppError, contextBuilder?: ErrorContextBuilder): EnhancedAppError {
    const builder = contextBuilder ?? new ErrorContextBuilder();
    
    const context = builder
      .setErrorCode(appError.name ?? 'UNKNOWN_ERROR')
      .setUserMessage(appError.message)
      .setTechnicalDetails(appError.details ?? {})
      .build();

    const enhancedError = new EnhancedAppError({
      message: appError.message,
      context,
      statusCode: appError.statusCode,
      isOperational: appError.isOperational,
      details: appError.details
    });

    // Preserve stack trace
    if (appError.stack !== undefined) {
      enhancedError.stack = appError.stack;
    }

    return enhancedError;
  }

  /**
   * Create builder for this error type
   */
  static builder(): ErrorContextBuilder {
    return new ErrorContextBuilder();
  }
}