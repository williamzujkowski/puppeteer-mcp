/**
 * Network domain errors
 * @module core/errors/domain/network-errors
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { EnhancedAppError } from '../enhanced-app-error.js';
import { ErrorContextBuilder, ErrorCategory, ErrorSeverity, RecoveryAction } from '../error-context.js';
import type { NetworkErrorOptions, RateLimitErrorOptions } from '../domain-error-interfaces.js';

/**
 * Network domain errors
 */
export class NetworkDomainError extends EnhancedAppError {
  constructor(options: NetworkErrorOptions) {
    const { message, errorCode, networkInfo, requestId } = options;
    
    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.NETWORK)
      .setSeverity(ErrorSeverity.MEDIUM)
      .setUserMessage(message)
      .setTechnicalDetails(networkInfo ?? {})
      .addRecoverySuggestion(RecoveryAction.RETRY)
      .addRecoverySuggestion(RecoveryAction.CHECK_NETWORK)
      .setRequestContext(requestId ?? '')
      .setOperationContext('network-request', networkInfo?.url)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/network',
        troubleshooting: 'https://docs.puppeteer-mcp.com/network/troubleshooting',
      })
      .addTag('domain', 'network')
      .addTag('status-code', String(networkInfo?.statusCode ?? 0))
      .setShouldReport(networkInfo?.statusCode !== undefined && networkInfo.statusCode >= 500)
      .build();

    super({ message, context, statusCode: networkInfo?.statusCode ?? 500, isOperational: true, details: networkInfo });
    this.name = 'NetworkDomainError';
  }
}

/**
 * Rate limiting domain errors
 */
export class RateLimitDomainError extends EnhancedAppError {
  constructor(options: RateLimitErrorOptions) {
    const { message, errorCode, rateLimitInfo, requestId, userId } = options;
    
    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.RATE_LIMIT)
      .setSeverity(ErrorSeverity.LOW)
      .setUserMessage(message)
      .setTechnicalDetails(rateLimitInfo)
      .addRecoverySuggestion(RecoveryAction.WAIT_AND_RETRY)
      .setRequestContext(requestId ?? '', userId)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/rate-limits',
        troubleshooting: 'https://docs.puppeteer-mcp.com/rate-limits/troubleshooting',
      })
      .addTag('domain', 'rate-limit')
      .addTag('limit', String(rateLimitInfo.limit))
      .setShouldReport(false)
      .build();

    super({ message, context, statusCode: 429, isOperational: false, details: rateLimitInfo });
    this.name = 'RateLimitDomainError';
  }
}