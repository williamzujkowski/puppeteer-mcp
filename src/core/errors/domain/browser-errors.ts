/**
 * Browser automation domain errors
 * @module core/errors/domain/browser-errors
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
import type { BrowserErrorOptions, ProxyErrorOptions } from '../domain-error-interfaces.js';

/**
 * Browser automation domain errors
 */
export class BrowserDomainError extends EnhancedAppError {
  constructor(options: BrowserErrorOptions) {
    const { message, errorCode, browserInfo, requestId, sessionId } = options;

    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.BROWSER)
      .setSeverity(ErrorSeverity.MEDIUM)
      .setUserMessage(message)
      .setTechnicalDetails(browserInfo ?? {})
      .addRecoverySuggestion(RecoveryAction.RETRY)
      .addRecoverySuggestion(RecoveryAction.RESTART_SESSION)
      .setRequestContext(requestId ?? '', undefined, sessionId)
      .setOperationContext(browserInfo?.action ?? 'browser-operation', browserInfo?.pageId)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/browser',
        troubleshooting: 'https://docs.puppeteer-mcp.com/browser/troubleshooting',
      })
      .addTag('domain', 'browser')
      .addTag('browser-id', browserInfo?.browserId ?? 'unknown')
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 500, isOperational: true, details: browserInfo });
    this.name = 'BrowserDomainError';

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, BrowserDomainError.prototype);
  }
}

/**
 * Proxy domain errors
 */
export class ProxyDomainError extends EnhancedAppError {
  constructor(options: ProxyErrorOptions) {
    const { message, errorCode, proxyInfo, requestId, sessionId } = options;

    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.NETWORK)
      .setSeverity(ErrorSeverity.MEDIUM)
      .setUserMessage(message)
      .setTechnicalDetails(proxyInfo ?? {})
      .addRecoverySuggestion(RecoveryAction.RETRY)
      .addRecoverySuggestion(RecoveryAction.CHECK_NETWORK)
      .setRequestContext(requestId ?? '', undefined, sessionId)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/proxy',
        troubleshooting: 'https://docs.puppeteer-mcp.com/proxy/troubleshooting',
      })
      .addTag('domain', 'proxy')
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 502, isOperational: true, details: proxyInfo });
    this.name = 'ProxyDomainError';
  }
}
