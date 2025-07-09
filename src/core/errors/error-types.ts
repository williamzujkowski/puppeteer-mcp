/**
 * Error types and enums for the error context system
 * @module core/errors/error-types
 * @nist si-11 "Error handling"
 */

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
  CHECK_CONFIG = 'check_config',
  OPTIMIZE = 'optimize',
  CHECK_INPUT = 'check_input',
  CHECK_CONNECTIVITY = 'check_connectivity',
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
