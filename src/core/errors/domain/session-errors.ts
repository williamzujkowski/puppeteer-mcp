/**
 * Session and security domain errors
 * @module core/errors/domain/session-errors
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { EnhancedAppError } from '../enhanced-app-error.js';
import { ErrorContextBuilder, ErrorCategory, ErrorSeverity, RecoveryAction } from '../error-context.js';
import type { SessionErrorOptions, SecurityErrorOptions } from '../domain-error-interfaces.js';

/**
 * Session domain errors
 */
export class SessionDomainError extends EnhancedAppError {
  constructor(options: SessionErrorOptions) {
    const { message, errorCode, sessionInfo, requestId } = options;
    
    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.SESSION)
      .setSeverity(ErrorSeverity.MEDIUM)
      .setUserMessage(message)
      .setTechnicalDetails(sessionInfo ?? {})
      .addRecoverySuggestion(RecoveryAction.REFRESH_TOKEN)
      .addRecoverySuggestion(RecoveryAction.LOGIN_AGAIN)
      .setRequestContext(requestId ?? '', sessionInfo?.userId, sessionInfo?.sessionId)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/sessions',
        troubleshooting: 'https://docs.puppeteer-mcp.com/sessions/troubleshooting',
      })
      .addTag('domain', 'session')
      .addTag('session-id', sessionInfo?.sessionId ?? 'unknown')
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 401, isOperational: true, details: sessionInfo });
    this.name = 'SessionDomainError';
  }
}

/**
 * Security domain errors
 */
export class SecurityDomainError extends EnhancedAppError {
  constructor(options: SecurityErrorOptions) {
    const { message, errorCode, securityInfo, requestId, userId } = options;
    
    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.SECURITY)
      .setSeverity(ErrorSeverity.CRITICAL)
      .setUserMessage('A security issue was detected')
      .setTechnicalDetails(securityInfo)
      .addRecoverySuggestion(RecoveryAction.CONTACT_SUPPORT)
      .setRequestContext(requestId ?? '', userId)
      .setSecurityContext(securityInfo.type, securityInfo.details)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/security',
        troubleshooting: 'https://docs.puppeteer-mcp.com/security/incident-response',
      })
      .addTag('domain', 'security')
      .addTag('security-type', securityInfo.type)
      .setShouldReport(true)
      .setShouldAlert(true)
      .build();

    super({ message, context, statusCode: 403, isOperational: true, details: securityInfo });
    this.name = 'SecurityDomainError';
  }
}