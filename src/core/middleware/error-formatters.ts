/**
 * Error formatting utilities for converting various error types to EnhancedAppError
 * @module core/middleware/error-formatters
 * @nist si-11 "Error handling"
 */

import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { EnhancedAppError } from '../errors/enhanced-app-error.js';
import { ErrorContextBuilder, ErrorCategory, ErrorSeverity } from '../errors/error-context.js';

/**
 * Context information for error formatting
 */
export interface ErrorContext {
  requestId: string;
  userId?: string;
  endpoint: string;
  method: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Error formatters for converting different error types to EnhancedAppError
 */
export class ErrorFormatters {
  /**
   * Create enhanced error from Zod validation error
   */
  static createEnhancedErrorFromZod(error: ZodError, context: ErrorContext): EnhancedAppError {
    const errorContext = new ErrorContextBuilder()
      .setErrorCode('VALIDATION_ERROR')
      .setCategory(ErrorCategory.VALIDATION)
      .setSeverity(ErrorSeverity.MEDIUM)
      .setUserMessage('Invalid request data')
      .setTechnicalDetails({
        validationErrors: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      })
      .setRequestContext(context.requestId, context.userId ?? '')
      .setOperationContext('request_validation', context.endpoint)
      .build();

    return new EnhancedAppError({
      message: 'Validation failed',
      context: errorContext,
      statusCode: 400,
    });
  }

  /**
   * Create enhanced error from AppError
   */
  static createEnhancedErrorFromApp(error: AppError, context: ErrorContext): EnhancedAppError {
    const errorContext = new ErrorContextBuilder()
      .setErrorCode(error.name.toUpperCase().replace(/ERROR$/, ''))
      .setCategory(ErrorFormatters.inferCategory(error.name))
      .setSeverity(ErrorFormatters.inferSeverity(error.statusCode))
      .setUserMessage(error.message)
      .setTechnicalDetails(error.details ?? {})
      .setRequestContext(context.requestId, context.userId ?? '')
      .setOperationContext('request_processing', context.endpoint)
      .build();

    return new EnhancedAppError({
      message: error.message,
      context: errorContext,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      details: error.details,
    });
  }

  /**
   * Create enhanced error from generic error
   */
  static createEnhancedErrorFromGeneric(error: Error, context: ErrorContext): EnhancedAppError {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorContext = new ErrorContextBuilder()
      .setErrorCode('INTERNAL_SERVER_ERROR')
      .setCategory(ErrorCategory.SYSTEM)
      .setSeverity(ErrorSeverity.CRITICAL)
      .setUserMessage(isDevelopment ? error.message : 'An unexpected error occurred')
      .setTechnicalDetails({
        errorType: error.constructor.name,
        ...(isDevelopment === true ? { stack: error.stack } : {}),
      })
      .setRequestContext(context.requestId, context.userId ?? '')
      .setOperationContext('request_processing', context.endpoint)
      .setShouldReport(true)
      .build();

    return new EnhancedAppError({
      message: error.message,
      context: errorContext,
      statusCode: 500,
      isOperational: false,
    });
  }

  /**
   * Infer error category from error name
   */
  static inferCategory(errorName: string): ErrorCategory {
    const name = errorName.toLowerCase();

    if (name.includes('auth')) return ErrorCategory.AUTHENTICATION;
    if (name.includes('validation')) return ErrorCategory.VALIDATION;
    if (name.includes('network')) return ErrorCategory.NETWORK;
    if (name.includes('browser')) return ErrorCategory.BROWSER;
    if (name.includes('database')) return ErrorCategory.DATABASE;
    if (name.includes('resource')) return ErrorCategory.RESOURCE;
    if (name.includes('ratelimit')) return ErrorCategory.RATE_LIMIT;
    if (name.includes('security')) return ErrorCategory.SECURITY;
    if (name.includes('config')) return ErrorCategory.CONFIGURATION;

    return ErrorCategory.SYSTEM;
  }

  /**
   * Infer error severity from status code
   */
  static inferSeverity(statusCode: number): ErrorSeverity {
    if (statusCode >= 400 && statusCode < 500) return ErrorSeverity.MEDIUM;
    if (statusCode >= 500) return ErrorSeverity.HIGH;
    return ErrorSeverity.LOW;
  }
}
