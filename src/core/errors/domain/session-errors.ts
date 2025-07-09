/**
 * Session and security domain errors
 * @module core/errors/domain/session-errors
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
import type { SessionErrorOptions } from '../domain-error-interfaces.js';

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
