/**
 * Error context system for comprehensive error handling
 * @module core/errors/error-context
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { z } from 'zod';
import { DEFAULT_RETRY_CONFIGS } from './retry-configs.js';

/**
 * Recovery action types that can be suggested to users
 */
export enum RecoveryAction {
  RETRY = 'retry',
  RETRY_WITH_BACKOFF = 'retry_with_backoff',
  REFRESH_TOKEN = 'refresh_token',
  CONTACT_SUPPORT = 'contact_support',
  CHECK_PERMISSIONS = 'check_permissions',
  VALIDATE_INPUT = 'validate_input',
  RESTART_SESSION = 'restart_session',
  WAIT_AND_RETRY = 'wait_and_retry',
  UPGRADE_PLAN = 'upgrade_plan',
  CHECK_CONFIGURATION = 'check_configuration',
  CLEAR_CACHE = 'clear_cache',
  RELOAD_PAGE = 'reload_page',
  CHECK_NETWORK = 'check_network',
  REDUCE_LOAD = 'reduce_load',
  NONE = 'none',
  CHECK_RESOURCE = 'check_resource',
  LOGIN_AGAIN = 'login_again',
  FIX_INPUT = 'fix_input',
  UPDATE_CONFIG = 'update_config',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories for better organization
 */
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NETWORK = 'network',
  BROWSER = 'browser',
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
  RESOURCE = 'resource',
  CONFIGURATION = 'configuration',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  RATE_LIMIT = 'rate_limit',
  SESSION = 'session',
}

/**
 * Error context interface for comprehensive error information
 */
export interface ErrorContext {
  /** Unique error code for identification */
  errorCode: string;
  /** Error category for organization */
  category: ErrorCategory;
  /** Severity level */
  severity: ErrorSeverity;
  /** User-friendly error message */
  userMessage: string;
  /** Technical details for developers */
  technicalDetails?: Record<string, unknown>;
  /** Recovery suggestions */
  recoverySuggestions: RecoveryAction[];
  /** Retry configuration if applicable */
  retryConfig?: RetryConfig;
  /** Additional context information */
  context?: {
    /** Request ID for tracing */
    requestId?: string;
    /** User ID if available */
    userId?: string;
    /** Session ID if available */
    sessionId?: string;
    /** Timestamp of error */
    timestamp: Date;
    /** Stack trace */
    stack?: string;
    /** HTTP status code */
    statusCode?: number;
    /** Related error IDs */
    correlationIds?: string[];
    /** Operation that caused the error */
    operation?: string;
    /** Resource involved */
    resource?: string;
    /** Environment information */
    environment?: {
      nodeVersion?: string;
      platform?: string;
      service?: string;
      version?: string;
    };
  };
  /** Localization support */
  localization?: {
    locale?: string;
    translations?: Record<string, string>;
  };
  /** Help and documentation links */
  helpLinks?: {
    documentation?: string;
    troubleshooting?: string;
    support?: string;
    faq?: string;
  };
  /** Metrics and analytics tags */
  tags?: Record<string, string>;
  /** Whether error should be reported to monitoring */
  shouldReport?: boolean;
  /** Whether error contains sensitive information */
  containsSensitiveData?: boolean;
}

/**
 * Retry configuration for recoverable errors
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries (ms) */
  initialDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Maximum delay between retries (ms) */
  maxDelay: number;
  /** Jitter factor (0-1) to add randomness */
  jitter: number;
  /** Specific error codes that should trigger retry */
  retryableErrorCodes?: string[];
}

/**
 * Schema for validating error context
 */
export const ErrorContextSchema = z.object({
  errorCode: z.string(),
  category: z.nativeEnum(ErrorCategory),
  severity: z.nativeEnum(ErrorSeverity),
  userMessage: z.string(),
  technicalDetails: z.record(z.unknown()).optional(),
  recoverySuggestions: z.array(z.nativeEnum(RecoveryAction)),
  retryConfig: z.object({
    maxAttempts: z.number().int().min(1).max(10),
    initialDelay: z.number().int().min(100).max(60000),
    backoffMultiplier: z.number().min(1).max(10),
    maxDelay: z.number().int().min(1000).max(300000),
    jitter: z.number().min(0).max(1),
    retryableErrorCodes: z.array(z.string()).optional(),
  }).optional(),
  context: z.object({
    requestId: z.string().optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    timestamp: z.date(),
    stack: z.string().optional(),
    statusCode: z.number().optional(),
    correlationIds: z.array(z.string()).optional(),
    operation: z.string().optional(),
    resource: z.string().optional(),
    environment: z.object({
      nodeVersion: z.string().optional(),
      platform: z.string().optional(),
      service: z.string().optional(),
      version: z.string().optional(),
    }).optional(),
  }).optional(),
  localization: z.object({
    locale: z.string().optional(),
    translations: z.record(z.string()).optional(),
  }).optional(),
  helpLinks: z.object({
    documentation: z.string().url().optional(),
    troubleshooting: z.string().url().optional(),
    support: z.string().url().optional(),
    faq: z.string().url().optional(),
  }).optional(),
  tags: z.record(z.string()).optional(),
  shouldReport: z.boolean().optional(),
  containsSensitiveData: z.boolean().optional(),
});

// DEFAULT_RETRY_CONFIGS moved to retry-configs.ts

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
      [ErrorCategory.AUTHENTICATION]: [RecoveryAction.REFRESH_TOKEN, RecoveryAction.CONTACT_SUPPORT],
      [ErrorCategory.AUTHORIZATION]: [RecoveryAction.CHECK_PERMISSIONS, RecoveryAction.CONTACT_SUPPORT],
      [ErrorCategory.VALIDATION]: [RecoveryAction.VALIDATE_INPUT],
      [ErrorCategory.NETWORK]: [RecoveryAction.CHECK_NETWORK, RecoveryAction.RETRY_WITH_BACKOFF],
      [ErrorCategory.BROWSER]: [RecoveryAction.RETRY, RecoveryAction.RESTART_SESSION],
      [ErrorCategory.DATABASE]: [RecoveryAction.RETRY_WITH_BACKOFF, RecoveryAction.CONTACT_SUPPORT],
      [ErrorCategory.EXTERNAL_SERVICE]: [RecoveryAction.RETRY_WITH_BACKOFF, RecoveryAction.CONTACT_SUPPORT],
      [ErrorCategory.RESOURCE]: [RecoveryAction.WAIT_AND_RETRY, RecoveryAction.REDUCE_LOAD],
      [ErrorCategory.CONFIGURATION]: [RecoveryAction.CHECK_CONFIGURATION, RecoveryAction.CONTACT_SUPPORT],
      [ErrorCategory.BUSINESS_LOGIC]: [RecoveryAction.VALIDATE_INPUT, RecoveryAction.CONTACT_SUPPORT],
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

// Re-export utility functions (moved to separate file due to size)
export { ErrorContextUtils } from './error-context-utils.js';

/**
 * Create a new error context builder
 */
export function createErrorContextBuilder(): ErrorContextBuilder {
  return new ErrorContextBuilder();
}