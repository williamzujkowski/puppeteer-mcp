/**
 * Authentication and authorization domain errors
 * @module core/errors/domain/auth-errors
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { EnhancedAppError } from '../enhanced-app-error.js';
import { ErrorContextBuilder, ErrorCategory, ErrorSeverity, RecoveryAction } from '../error-context.js';
import type { AuthenticationErrorOptions, AuthorizationErrorOptions } from '../domain-error-interfaces.js';

/**
 * Authentication domain errors
 */
export class AuthenticationDomainError extends EnhancedAppError {
  constructor(options: AuthenticationErrorOptions) {
    const { message, errorCode, technicalDetails, requestId, userId } = options;
    
    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.AUTHENTICATION)
      .setSeverity(ErrorSeverity.HIGH)
      .setUserMessage(message)
      .setTechnicalDetails(technicalDetails ?? {})
      .addRecoverySuggestion(RecoveryAction.REFRESH_TOKEN)
      .addRecoverySuggestion(RecoveryAction.CONTACT_SUPPORT)
      .setRequestContext(requestId ?? '', userId)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/auth',
        troubleshooting: 'https://docs.puppeteer-mcp.com/auth/troubleshooting',
      })
      .addTag('domain', 'authentication')
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 401, isOperational: true, details: technicalDetails });
    this.name = 'AuthenticationDomainError';
  }
}

/**
 * Authorization domain errors
 */
export class AuthorizationDomainError extends EnhancedAppError {
  constructor(options: AuthorizationErrorOptions) {
    const { message, errorCode, requiredPermissions, userPermissions, requestId, userId } = options;
    
    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.AUTHORIZATION)
      .setSeverity(ErrorSeverity.HIGH)
      .setUserMessage(message)
      .setTechnicalDetails({
        requiredPermissions,
        userPermissions,
        missingPermissions: requiredPermissions.filter(p => !userPermissions.includes(p)),
      })
      .addRecoverySuggestion(RecoveryAction.CHECK_PERMISSIONS)
      .addRecoverySuggestion(RecoveryAction.CONTACT_SUPPORT)
      .setRequestContext(requestId ?? '', userId)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/permissions',
        troubleshooting: 'https://docs.puppeteer-mcp.com/permissions/troubleshooting',
      })
      .addTag('domain', 'authorization')
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 403, isOperational: true });
    this.name = 'AuthorizationDomainError';
  }
}