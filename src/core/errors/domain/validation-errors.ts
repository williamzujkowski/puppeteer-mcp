/**
 * Validation and configuration domain errors
 * @module core/errors/domain/validation-errors
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { EnhancedAppError } from '../enhanced-app-error.js';
import {
  ErrorContextBuilder,
  ErrorCategory,
  ErrorSeverity,
  RecoveryAction,
} from '../error-context.js';
import type { ValidationErrorOptions } from '../domain-error-interfaces.js';

/**
 * Validation domain errors
 */
export class ValidationDomainError extends EnhancedAppError {
  constructor(options: ValidationErrorOptions) {
    const { message, errorCode, validationErrors, requestId, userId } = options;

    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.VALIDATION)
      .setSeverity(ErrorSeverity.LOW)
      .setUserMessage(message)
      .setTechnicalDetails({
        validationErrors,
        errorCount: validationErrors.length,
      })
      .addRecoverySuggestion(RecoveryAction.FIX_INPUT)
      .setRequestContext(requestId ?? '', userId)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/validation',
        troubleshooting: 'https://docs.puppeteer-mcp.com/validation/troubleshooting',
      })
      .addTag('domain', 'validation')
      .addTag('error-count', String(validationErrors.length))
      .setShouldReport(false)
      .build();

    super({
      message,
      context,
      statusCode: 400,
      isOperational: false,
      details: { validationErrors },
    });
    this.name = 'ValidationDomainError';
  }
}
