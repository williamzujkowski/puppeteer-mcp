/**
 * Error context builder for fluent API
 * @module core/errors/error-builder
 * @nist si-11 "Error handling"
 */

import { DEFAULT_RETRY_CONFIGS } from './retry-configs.js';
import { ErrorContextSchema } from './error-schemas.js';
import {
  ErrorContext,
  ErrorCategory,
  ErrorSeverity,
  RecoveryAction,
  RetryConfig,
} from './error-types.js';

/**
 * Error context builder for fluent API
 */
export class ErrorContextBuilder {
  private context: Partial<ErrorContext> = {
    recoverySuggestions: [],
    context: {
      timestamp: new Date(),
    },
  };

  /**
   * Set error code
   */
  setErrorCode(code: string): this {
    this.context.errorCode = code;
    return this;
  }

  /**
   * Set error category
   */
  setCategory(category: ErrorCategory): this {
    this.context.category = category;
    return this;
  }

  /**
   * Set error severity
   */
  setSeverity(severity: ErrorSeverity): this {
    this.context.severity = severity;
    return this;
  }

  /**
   * Set user message
   */
  setUserMessage(message: string): this {
    this.context.userMessage = message;
    return this;
  }

  /**
   * Set technical details
   */
  setTechnicalDetails(details: Record<string, unknown>): this {
    this.context.technicalDetails = details;
    return this;
  }

  /**
   * Add recovery suggestion
   */
  addRecoverySuggestion(action: RecoveryAction): this {
    this.context.recoverySuggestions ??= [];
    this.context.recoverySuggestions.push(action);
    return this;
  }

  /**
   * Set retry configuration
   */
  setRetryConfig(config: RetryConfig): this {
    this.context.retryConfig = config;
    return this;
  }

  /**
   * Set request context
   */
  setRequestContext(requestId: string, userId?: string, sessionId?: string): this {
    this.context.context ??= { timestamp: new Date() };
    this.context.context.requestId = requestId;
    this.context.context.userId = userId;
    this.context.context.sessionId = sessionId;
    return this;
  }

  /**
   * Set operation context
   */
  setOperationContext(operation: string, resource?: string): this {
    this.context.context ??= { timestamp: new Date() };
    this.context.context.operation = operation;
    this.context.context.resource = resource;
    return this;
  }

  /**
   * Add correlation ID
   */
  addCorrelationId(id: string): this {
    this.context.context ??= { timestamp: new Date() };
    this.context.context.correlationIds ??= [];
    this.context.context.correlationIds.push(id);
    return this;
  }

  /**
   * Set help links
   */
  setHelpLinks(links: ErrorContext['helpLinks']): this {
    this.context.helpLinks = links;
    return this;
  }

  /**
   * Add tag
   */
  addTag(key: string, value: string): this {
    this.context.tags ??= {};
    // eslint-disable-next-line security/detect-object-injection
    this.context.tags[key] = value;
    return this;
  }

  /**
   * Set reporting flag
   */
  setShouldReport(shouldReport: boolean): this {
    this.context.shouldReport = shouldReport;
    return this;
  }

  /**
   * Set sensitive data flag
   */
  setContainsSensitiveData(containsSensitiveData: boolean): this {
    this.context.containsSensitiveData = containsSensitiveData;
    return this;
  }

  /**
   * Set security context
   */
  setSecurityContext(type: string, details: Record<string, unknown>): this {
    this.context.technicalDetails ??= {};
    this.context.technicalDetails.securityType = type;
    this.context.technicalDetails.securityDetails = details;
    return this;
  }

  /**
   * Build the error context with automatic defaults
   */
  build(): ErrorContext {
    // Apply default retry config if not set
    if (!this.context.retryConfig && this.context.category !== undefined) {
      const defaultConfig = DEFAULT_RETRY_CONFIGS[this.context.category];
      if (defaultConfig) {
        this.context.retryConfig = defaultConfig;
      }
    }

    // Set default recovery suggestions based on category
    if (this.context.recoverySuggestions?.length === 0 && this.context.category !== undefined) {
      this.context.recoverySuggestions = this.getDefaultRecoverySuggestions(this.context.category);
    }

    // Set default severity if not provided
    this.context.severity ??= this.getDefaultSeverity(this.context.category);

    // Validate the context
    const validated = ErrorContextSchema.parse(this.context);
    return validated;
  }

  /**
   * Get default recovery suggestions for a category
   */
  private getDefaultRecoverySuggestions(category: ErrorCategory): RecoveryAction[] {
    const suggestions: Record<ErrorCategory, RecoveryAction[]> = {
      [ErrorCategory.AUTHENTICATION]: [
        RecoveryAction.REFRESH_TOKEN,
        RecoveryAction.CONTACT_SUPPORT,
      ],
      [ErrorCategory.AUTHORIZATION]: [
        RecoveryAction.CHECK_PERMISSIONS,
        RecoveryAction.CONTACT_SUPPORT,
      ],
      [ErrorCategory.VALIDATION]: [RecoveryAction.VALIDATE_INPUT],
      [ErrorCategory.NETWORK]: [RecoveryAction.CHECK_NETWORK, RecoveryAction.RETRY_WITH_BACKOFF],
      [ErrorCategory.BROWSER]: [RecoveryAction.RETRY, RecoveryAction.RESTART_SESSION],
      [ErrorCategory.DATABASE]: [RecoveryAction.RETRY_WITH_BACKOFF, RecoveryAction.CONTACT_SUPPORT],
      [ErrorCategory.EXTERNAL_SERVICE]: [
        RecoveryAction.RETRY_WITH_BACKOFF,
        RecoveryAction.CONTACT_SUPPORT,
      ],
      [ErrorCategory.RESOURCE]: [RecoveryAction.WAIT_AND_RETRY, RecoveryAction.REDUCE_LOAD],
      [ErrorCategory.CONFIGURATION]: [
        RecoveryAction.CHECK_CONFIGURATION,
        RecoveryAction.CONTACT_SUPPORT,
      ],
      [ErrorCategory.BUSINESS_LOGIC]: [
        RecoveryAction.VALIDATE_INPUT,
        RecoveryAction.CONTACT_SUPPORT,
      ],
      [ErrorCategory.SYSTEM]: [RecoveryAction.CONTACT_SUPPORT],
      [ErrorCategory.SECURITY]: [RecoveryAction.CHECK_PERMISSIONS, RecoveryAction.CONTACT_SUPPORT],
      [ErrorCategory.PERFORMANCE]: [RecoveryAction.REDUCE_LOAD, RecoveryAction.WAIT_AND_RETRY],
      [ErrorCategory.RATE_LIMIT]: [RecoveryAction.WAIT_AND_RETRY, RecoveryAction.REDUCE_LOAD],
      [ErrorCategory.SESSION]: [RecoveryAction.LOGIN_AGAIN, RecoveryAction.RESTART_SESSION],
    };

    // eslint-disable-next-line security/detect-object-injection
    return suggestions[category] ?? [RecoveryAction.CONTACT_SUPPORT];
  }

  /**
   * Get default severity for a category
   */
  private getDefaultSeverity(category?: ErrorCategory): ErrorSeverity {
    if (category === undefined) return ErrorSeverity.MEDIUM;

    const severities: Record<ErrorCategory, ErrorSeverity> = {
      [ErrorCategory.SECURITY]: ErrorSeverity.CRITICAL,
      [ErrorCategory.AUTHENTICATION]: ErrorSeverity.HIGH,
      [ErrorCategory.AUTHORIZATION]: ErrorSeverity.HIGH,
      [ErrorCategory.SYSTEM]: ErrorSeverity.CRITICAL,
      [ErrorCategory.DATABASE]: ErrorSeverity.HIGH,
      [ErrorCategory.CONFIGURATION]: ErrorSeverity.HIGH,
      [ErrorCategory.VALIDATION]: ErrorSeverity.MEDIUM,
      [ErrorCategory.NETWORK]: ErrorSeverity.MEDIUM,
      [ErrorCategory.BROWSER]: ErrorSeverity.MEDIUM,
      [ErrorCategory.EXTERNAL_SERVICE]: ErrorSeverity.MEDIUM,
      [ErrorCategory.RESOURCE]: ErrorSeverity.MEDIUM,
      [ErrorCategory.BUSINESS_LOGIC]: ErrorSeverity.LOW,
      [ErrorCategory.PERFORMANCE]: ErrorSeverity.MEDIUM,
      [ErrorCategory.RATE_LIMIT]: ErrorSeverity.LOW,
      [ErrorCategory.SESSION]: ErrorSeverity.HIGH,
    };

    // eslint-disable-next-line security/detect-object-injection
    return severities[category] ?? ErrorSeverity.MEDIUM;
  }
}

/**
 * Create a new error context builder
 */
export function createErrorContextBuilder(): ErrorContextBuilder {
  return new ErrorContextBuilder();
}
