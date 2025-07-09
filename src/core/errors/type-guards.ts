/**
 * Type guard functions for error types - converted from namespace to ES modules
 * @module core/errors/type-guards
 */

import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { EnhancedAppError } from './enhanced-app-error.js';
import { ErrorCategory, ErrorSeverity } from './error-context.js';

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is an EnhancedAppError
 */
export function isEnhancedAppError(error: unknown): error is EnhancedAppError {
  return error instanceof EnhancedAppError;
}

/**
 * Type guard to check if error is a ZodError
 */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

/**
 * Check if error is operational
 */
export function isOperationalError(error: unknown): boolean {
  return error instanceof AppError && error.isOperational;
}

/**
 * Check if error has a specific error code
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  if (error instanceof EnhancedAppError) {
    return error.errorContext.errorCode === code;
  }
  return false;
}

/**
 * Check if error has a specific category
 */
export function hasCategory(error: unknown, category: ErrorCategory): boolean {
  if (error instanceof EnhancedAppError) {
    return error.errorContext.category === category;
  }
  return false;
}

/**
 * Check if error has a specific severity
 */
export function hasSeverity(error: unknown, severity: ErrorSeverity): boolean {
  if (error instanceof EnhancedAppError) {
    return error.errorContext.severity === severity;
  }
  return false;
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof EnhancedAppError) {
    return error.isRetryable();
  }
  return false;
}

/**
 * Check if error contains sensitive data
 */
export function containsSensitiveData(error: unknown): boolean {
  if (error instanceof EnhancedAppError) {
    return error.containsSensitiveData();
  }
  return false;
}
