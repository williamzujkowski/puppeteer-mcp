/**
 * Resource and domain management errors
 * @module core/errors/domain/resource-errors
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { EnhancedAppError } from '../enhanced-app-error.js';
import { ErrorContextBuilder, ErrorCategory, ErrorSeverity, RecoveryAction } from '../error-context.js';
import type { ResourceErrorOptions, DomainErrorOptions } from '../domain-error-interfaces.js';

/**
 * Resource domain errors
 */
export class ResourceDomainError extends EnhancedAppError {
  constructor(options: ResourceErrorOptions) {
    const { message, errorCode, resourceInfo, requestId } = options;
    
    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.RESOURCE)
      .setSeverity(ErrorSeverity.MEDIUM)
      .setUserMessage(message)
      .setTechnicalDetails(resourceInfo)
      .addRecoverySuggestion(RecoveryAction.RETRY)
      .addRecoverySuggestion(RecoveryAction.CHECK_RESOURCE)
      .setRequestContext(requestId ?? '')
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/resources',
        troubleshooting: 'https://docs.puppeteer-mcp.com/resources/troubleshooting',
      })
      .addTag('domain', 'resource')
      .addTag('resource-type', resourceInfo.resourceType)
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 503, isOperational: true, details: resourceInfo });
    this.name = 'ResourceDomainError';
  }
}

/**
 * Generic domain errors
 */
export class DomainError extends EnhancedAppError {
  constructor(options: DomainErrorOptions) {
    const { message, errorCode, domainInfo, requestId } = options;
    
    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.BUSINESS_LOGIC)
      .setSeverity(ErrorSeverity.MEDIUM)
      .setUserMessage(message)
      .setTechnicalDetails(domainInfo ?? {})
      .addRecoverySuggestion(RecoveryAction.CONTACT_SUPPORT)
      .setRequestContext(requestId ?? '')
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com',
        troubleshooting: 'https://docs.puppeteer-mcp.com/troubleshooting',
      })
      .addTag('domain', domainInfo?.domain ?? 'unknown')
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 500, isOperational: true, details: domainInfo });
    this.name = 'DomainError';
  }
}