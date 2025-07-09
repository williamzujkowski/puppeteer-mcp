/**
 * Validation and configuration domain errors
 * @module core/errors/domain/validation-errors
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { EnhancedAppError } from '../enhanced-app-error.js';
import { ErrorContextBuilder, ErrorCategory, ErrorSeverity, RecoveryAction } from '../error-context.js';
import type { ValidationErrorOptions, ConfigurationErrorOptions } from '../domain-error-interfaces.js';

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

    super({ message, context, statusCode: 400, isOperational: false, details: { validationErrors } });
    this.name = 'ValidationDomainError';
  }
}

/**
 * Configuration domain errors
 */
export class ConfigurationDomainError extends EnhancedAppError {
  constructor(options: ConfigurationErrorOptions) {
    const { message, errorCode, configurationIssue, configPath, expectedValue, actualValue, requestId } = options;
    
    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.CONFIGURATION)
      .setSeverity(ErrorSeverity.HIGH)
      .setUserMessage(message)
      .setTechnicalDetails({
        issue: configurationIssue,
        configPath,
        expectedValue,
        actualValue,
      })
      .addRecoverySuggestion(RecoveryAction.UPDATE_CONFIG)
      .addRecoverySuggestion(RecoveryAction.CONTACT_SUPPORT)
      .setRequestContext(requestId ?? '')
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/configuration',
        troubleshooting: 'https://docs.puppeteer-mcp.com/configuration/troubleshooting',
      })
      .addTag('domain', 'configuration')
      .addTag('config-path', configPath ?? 'unknown')
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 500, isOperational: true, details: { configurationIssue, configPath, expectedValue, actualValue } });
    this.name = 'ConfigurationDomainError';
  }
}