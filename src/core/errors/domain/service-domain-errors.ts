/**
 * Service domain errors
 * @module core/errors/domain/service-domain-errors
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
  ExternalServiceErrorOptions,
  SystemErrorOptions,
  ConfigurationErrorOptions,
} from '../domain-error-interfaces.js';

/**
 * External service domain errors
 */
export class ExternalServiceDomainError extends EnhancedAppError {
  constructor(options: ExternalServiceErrorOptions) {
    const { message, errorCode, serviceInfo, requestId } = options;

    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.EXTERNAL_SERVICE)
      .setSeverity(ErrorSeverity.HIGH)
      .setUserMessage(message)
      .setTechnicalDetails(serviceInfo)
      .addRecoverySuggestion(RecoveryAction.RETRY)
      .addRecoverySuggestion(RecoveryAction.CHECK_CONNECTIVITY)
      .setRequestContext(requestId ?? '')
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/external-services',
        troubleshooting: 'https://docs.puppeteer-mcp.com/external-services/troubleshooting',
      })
      .addTag('domain', 'external-service')
      .addTag('service', serviceInfo.serviceName)
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 503, isOperational: true, details: serviceInfo });
    this.name = 'ExternalServiceDomainError';
  }
}

/**
 * System domain errors
 */
export class SystemDomainError extends EnhancedAppError {
  constructor(options: SystemErrorOptions) {
    const { message, errorCode, systemInfo, requestId } = options;

    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.SYSTEM)
      .setSeverity(ErrorSeverity.CRITICAL)
      .setUserMessage(message)
      .setTechnicalDetails(systemInfo)
      .addRecoverySuggestion(RecoveryAction.RETRY)
      .addRecoverySuggestion(RecoveryAction.CONTACT_SUPPORT)
      .setRequestContext(requestId ?? '')
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/system',
        troubleshooting: 'https://docs.puppeteer-mcp.com/system/troubleshooting',
      })
      .addTag('domain', 'system')
      .addTag('component', systemInfo.component)
      .setShouldReport(true)
      .build();

    super({ message, context, statusCode: 503, isOperational: true, details: systemInfo });
    this.name = 'SystemDomainError';
  }
}

/**
 * Configuration domain errors
 */
export class ConfigurationDomainError extends EnhancedAppError {
  constructor(options: ConfigurationErrorOptions) {
    const {
      message,
      errorCode,
      configurationIssue,
      configPath,
      expectedValue,
      actualValue,
      requestId,
    } = options;

    const context = new ErrorContextBuilder()
      .setErrorCode(errorCode)
      .setCategory(ErrorCategory.CONFIGURATION)
      .setSeverity(ErrorSeverity.HIGH)
      .setUserMessage(message)
      .setTechnicalDetails({
        issue: configurationIssue,
        path: configPath,
        expected: expectedValue,
        actual: actualValue,
      })
      .addRecoverySuggestion(RecoveryAction.CHECK_CONFIG)
      .addRecoverySuggestion(RecoveryAction.CONTACT_SUPPORT)
      .setRequestContext(requestId ?? '')
      .setHelpLinks({
        documentation: 'https://docs.puppeteer-mcp.com/configuration',
        troubleshooting: 'https://docs.puppeteer-mcp.com/configuration/troubleshooting',
      })
      .addTag('domain', 'configuration')
      .setShouldReport(true)
      .build();

    super({
      message,
      context,
      statusCode: 500,
      isOperational: true,
      details: { configurationIssue, configPath },
    });
    this.name = 'ConfigurationDomainError';
  }
}
