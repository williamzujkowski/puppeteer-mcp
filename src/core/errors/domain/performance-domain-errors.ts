/**
 * Performance and business logic domain errors
 * @module core/errors/domain/performance-domain-errors
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
import type {
  PerformanceErrorOptions,
  BusinessLogicErrorOptions,
  SecurityErrorOptions,
} from '../domain-error-interfaces.js';

/**
 * Performance domain errors
 */
export class PerformanceDomainError extends EnhancedAppError {
  constructor(options: PerformanceErrorOptions) {
    const { message, errorCode, performanceInfo, requestId } = options;

    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.PERFORMANCE)
      .setSeverity(ErrorSeverity.MEDIUM)
      .setUserMessage(message)
      .setTechnicalDetails(performanceInfo)
      .addRecoverySuggestion(RecoveryAction.OPTIMIZE)
      .addRecoverySuggestion(RecoveryAction.RETRY)
      .setRequestContext(requestId ?? '')
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/performance',
        troubleshooting: 'https://docs.puppeteer-mcp.com/performance/troubleshooting',
      })
      .addTag('domain', 'performance')
      .addTag('operation', performanceInfo.operation)
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 503, isOperational: true, details: performanceInfo });
    this.name = 'PerformanceDomainError';
  }
}

/**
 * Business logic domain errors
 */
export class BusinessLogicDomainError extends EnhancedAppError {
  constructor(options: BusinessLogicErrorOptions) {
    const { message, errorCode, businessInfo, requestId, userId } = options;

    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.BUSINESS_LOGIC)
      .setSeverity(ErrorSeverity.MEDIUM)
      .setUserMessage(message)
      .setTechnicalDetails(businessInfo)
      .addRecoverySuggestion(RecoveryAction.CHECK_INPUT)
      .addRecoverySuggestion(RecoveryAction.CONTACT_SUPPORT)
      .setRequestContext(requestId ?? '', userId)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/business-rules',
        troubleshooting: 'https://docs.puppeteer-mcp.com/business-rules/troubleshooting',
      })
      .addTag('domain', 'business-logic')
      .addTag('rule', businessInfo.rule)
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 400, isOperational: true, details: businessInfo });
    this.name = 'BusinessLogicDomainError';
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
      .setUserMessage(message)
      .setTechnicalDetails(securityInfo)
      .addRecoverySuggestion(RecoveryAction.CONTACT_SUPPORT)
      .setRequestContext(requestId ?? '', userId)
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/security',
        troubleshooting: 'https://docs.puppeteer-mcp.com/security/troubleshooting',
      })
      .addTag('domain', 'security')
      .addTag('threat-type', securityInfo.type)
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 403, isOperational: true, details: securityInfo });
    this.name = 'SecurityDomainError';
  }
}
