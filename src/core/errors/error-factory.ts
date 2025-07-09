/**
 * Error factory for creating domain-specific errors with consistent patterns
 * @module core/errors/error-factory
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { 
  AuthenticationDomainError,
  AuthorizationDomainError,
  BrowserDomainError,
  NetworkDomainError,
  ResourceDomainError,
  ValidationDomainError,
  ExternalServiceDomainError,
  RateLimitDomainError,
  ConfigurationDomainError,
  SecurityDomainError,
  PerformanceDomainError,
  SystemDomainError,
  BusinessLogicDomainError,
} from './domain-errors.js';

/**
 * Request context for error creation
 */
interface RequestContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Error factory class for consistent error creation
 */
export class ErrorFactory {
  private static defaultContext: RequestContext = {};

  /**
   * Set default context for all errors
   */
  static setDefaultContext(context: RequestContext): void {
    this.defaultContext = { ...context };
  }

  /**
   * Get current default context
   */
  static getDefaultContext(): RequestContext {
    return { ...this.defaultContext };
  }

  /**
   * Clear default context
   */
  static clearDefaultContext(): void {
    this.defaultContext = {};
  }

  /**
   * Authentication errors
   */
  static auth = {
    invalidCredentials: (context?: RequestContext) => 
      new AuthenticationDomainError(
        'Invalid credentials provided',
        'AUTH_INVALID_CREDENTIALS',
        { reason: 'credentials_mismatch' },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    tokenExpired: (context?: RequestContext) => 
      new AuthenticationDomainError(
        'Authentication token has expired',
        'AUTH_TOKEN_EXPIRED',
        { reason: 'token_expired' },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    tokenInvalid: (context?: RequestContext) => 
      new AuthenticationDomainError(
        'Invalid authentication token',
        'AUTH_TOKEN_INVALID',
        { reason: 'token_invalid' },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    missingToken: (context?: RequestContext) => 
      new AuthenticationDomainError(
        'Authentication token is required',
        'AUTH_TOKEN_MISSING',
        { reason: 'token_missing' },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    accountLocked: (context?: RequestContext) => 
      new AuthenticationDomainError(
        'Account is locked due to too many failed attempts',
        'AUTH_ACCOUNT_LOCKED',
        { reason: 'account_locked' },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    accountDisabled: (context?: RequestContext) => 
      new AuthenticationDomainError(
        'Account is disabled',
        'AUTH_ACCOUNT_DISABLED',
        { reason: 'account_disabled' },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),
  };

  /**
   * Authorization errors
   */
  static authorization = {
    insufficientPermissions: (requiredPermissions: string[], userPermissions: string[], context?: RequestContext) => 
      new AuthorizationDomainError(
        'Insufficient permissions to perform this action',
        'AUTH_INSUFFICIENT_PERMISSIONS',
        requiredPermissions,
        userPermissions,
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    roleRequired: (requiredRole: string, userRole: string, context?: RequestContext) => 
      new AuthorizationDomainError(
        `Role '${requiredRole}' is required for this action`,
        'AUTH_ROLE_REQUIRED',
        [requiredRole],
        [userRole],
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    resourceAccessDenied: (resource: string, context?: RequestContext) => 
      new AuthorizationDomainError(
        `Access denied to resource: ${resource}`,
        'AUTH_RESOURCE_ACCESS_DENIED',
        ['resource_access'],
        [],
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    operationForbidden: (operation: string, context?: RequestContext) => 
      new AuthorizationDomainError(
        `Operation '${operation}' is forbidden`,
        'AUTH_OPERATION_FORBIDDEN',
        [operation],
        [],
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),
  };

  /**
   * Browser automation errors
   */
  static browser = {
    pageNotFound: (pageId: string, context?: RequestContext) => 
      new BrowserDomainError(
        `Browser page not found: ${pageId}`,
        'BROWSER_PAGE_NOT_FOUND',
        { pageId, action: 'page_lookup' },
        context?.requestId || this.defaultContext.requestId,
        context?.sessionId || this.defaultContext.sessionId
      ),

    elementNotFound: (selector: string, pageId: string, context?: RequestContext) => 
      new BrowserDomainError(
        `Element not found: ${selector}`,
        'BROWSER_ELEMENT_NOT_FOUND',
        { selector, pageId, action: 'element_lookup' },
        context?.requestId || this.defaultContext.requestId,
        context?.sessionId || this.defaultContext.sessionId
      ),

    navigationFailed: (url: string, _error: string, context?: RequestContext) => 
      new BrowserDomainError(
        `Navigation failed to: ${url}`,
        'BROWSER_NAVIGATION_FAILED',
        { url, action: 'navigation' },
        context?.requestId || this.defaultContext.requestId,
        context?.sessionId || this.defaultContext.sessionId
      ),

    actionTimeout: (action: string, selector: string, _timeout: number, context?: RequestContext) => 
      new BrowserDomainError(
        `Browser action timed out: ${action} on ${selector}`,
        'BROWSER_ACTION_TIMEOUT',
        { action, selector },
        context?.requestId || this.defaultContext.requestId,
        context?.sessionId || this.defaultContext.sessionId
      ),

    poolExhausted: (_poolSize: number, _activeConnections: number, context?: RequestContext) => 
      new BrowserDomainError(
        'Browser pool exhausted - no available browsers',
        'BROWSER_POOL_EXHAUSTED',
        { action: 'pool_allocation' },
        context?.requestId || this.defaultContext.requestId,
        context?.sessionId || this.defaultContext.sessionId
      ),

    browserCrashed: (browserId: string, context?: RequestContext) => 
      new BrowserDomainError(
        'Browser instance crashed unexpectedly',
        'BROWSER_CRASHED',
        { browserId, action: 'browser_operation' },
        context?.requestId || this.defaultContext.requestId,
        context?.sessionId || this.defaultContext.sessionId
      ),

    evaluationFailed: (_script: string, _error: string, context?: RequestContext) => 
      new BrowserDomainError(
        'JavaScript evaluation failed',
        'BROWSER_EVALUATION_FAILED',
        { action: 'evaluation' },
        context?.requestId || this.defaultContext.requestId,
        context?.sessionId || this.defaultContext.sessionId
      ),
  };

  /**
   * Network errors
   */
  static network = {
    connectionFailed: (url: string, context?: RequestContext) => 
      new NetworkDomainError(
        `Connection failed to: ${url}`,
        'NETWORK_CONNECTION_FAILED',
        { url, method: 'GET' },
        context?.requestId || this.defaultContext.requestId
      ),

    timeout: (url: string, timeout: number, context?: RequestContext) => 
      new NetworkDomainError(
        `Request timeout: ${url}`,
        'NETWORK_TIMEOUT',
        { url, timeout },
        context?.requestId || this.defaultContext.requestId
      ),

    dnsResolutionFailed: (hostname: string, context?: RequestContext) => 
      new NetworkDomainError(
        `DNS resolution failed for: ${hostname}`,
        'NETWORK_DNS_RESOLUTION_FAILED',
        { url: hostname },
        context?.requestId || this.defaultContext.requestId
      ),

    sslError: (url: string, _error: string, context?: RequestContext) => 
      new NetworkDomainError(
        `SSL/TLS error for: ${url}`,
        'NETWORK_SSL_ERROR',
        { url },
        context?.requestId || this.defaultContext.requestId
      ),

    proxyError: (proxyUrl: string, context?: RequestContext) => 
      new NetworkDomainError(
        `Proxy connection failed: ${proxyUrl}`,
        'NETWORK_PROXY_ERROR',
        { url: proxyUrl },
        context?.requestId || this.defaultContext.requestId
      ),
  };

  /**
   * Resource errors
   */
  static resource = {
    memoryExhausted: (currentUsage: number, maxLimit: number, context?: RequestContext) => 
      new ResourceDomainError(
        'Memory limit exceeded',
        'RESOURCE_MEMORY_EXHAUSTED',
        { resourceType: 'memory', currentUsage, maxLimit, unit: 'MB' },
        context?.requestId || this.defaultContext.requestId
      ),

    cpuExhausted: (currentUsage: number, maxLimit: number, context?: RequestContext) => 
      new ResourceDomainError(
        'CPU limit exceeded',
        'RESOURCE_CPU_EXHAUSTED',
        { resourceType: 'cpu', currentUsage, maxLimit, unit: 'percent' },
        context?.requestId || this.defaultContext.requestId
      ),

    connectionPoolExhausted: (poolSize: number, activeConnections: number, context?: RequestContext) => 
      new ResourceDomainError(
        'Connection pool exhausted',
        'RESOURCE_CONNECTION_POOL_EXHAUSTED',
        { resourceType: 'connection_pool', poolSize, activeConnections },
        context?.requestId || this.defaultContext.requestId
      ),

    diskSpaceExhausted: (available: number, required: number, context?: RequestContext) => 
      new ResourceDomainError(
        'Insufficient disk space',
        'RESOURCE_DISK_SPACE_EXHAUSTED',
        { resourceType: 'disk', currentUsage: available, maxLimit: required, unit: 'GB' },
        context?.requestId || this.defaultContext.requestId
      ),

    fileHandleExhausted: (currentUsage: number, maxLimit: number, context?: RequestContext) => 
      new ResourceDomainError(
        'File handle limit exceeded',
        'RESOURCE_FILE_HANDLE_EXHAUSTED',
        { resourceType: 'file_handles', currentUsage, maxLimit },
        context?.requestId || this.defaultContext.requestId
      ),
  };

  /**
   * Validation errors
   */
  static validation = {
    required: (field: string, context?: RequestContext) => 
      new ValidationDomainError(
        `Field '${field}' is required`,
        'VALIDATION_REQUIRED',
        { field, constraint: 'required' },
        context?.requestId || this.defaultContext.requestId
      ),

    invalidFormat: (field: string, value: unknown, expectedFormat: string, context?: RequestContext) => 
      new ValidationDomainError(
        `Invalid format for field '${field}'`,
        'VALIDATION_INVALID_FORMAT',
        { field, value, expectedType: expectedFormat, constraint: 'format' },
        context?.requestId || this.defaultContext.requestId
      ),

    outOfRange: (field: string, value: unknown, min: number, max: number, context?: RequestContext) => 
      new ValidationDomainError(
        `Field '${field}' is out of range`,
        'VALIDATION_OUT_OF_RANGE',
        { field, value, constraint: `${min}-${max}` },
        context?.requestId || this.defaultContext.requestId
      ),

    invalidEnum: (field: string, value: unknown, _validValues: unknown[], context?: RequestContext) => 
      new ValidationDomainError(
        `Invalid value for field '${field}'`,
        'VALIDATION_INVALID_ENUM',
        { field, value, constraint: 'enum' },
        context?.requestId || this.defaultContext.requestId
      ),

    tooLong: (field: string, value: string, maxLength: number, context?: RequestContext) => 
      new ValidationDomainError(
        `Field '${field}' is too long`,
        'VALIDATION_TOO_LONG',
        { field, value: value.length, constraint: `max_length_${maxLength}` },
        context?.requestId || this.defaultContext.requestId
      ),

    tooShort: (field: string, value: string, minLength: number, context?: RequestContext) => 
      new ValidationDomainError(
        `Field '${field}' is too short`,
        'VALIDATION_TOO_SHORT',
        { field, value: value.length, constraint: `min_length_${minLength}` },
        context?.requestId || this.defaultContext.requestId
      ),
  };

  /**
   * Rate limiting errors
   */
  static rateLimit = {
    exceeded: (limit: number, resetTime: Date, context?: RequestContext) => 
      new RateLimitDomainError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        { limit, resetTime, retryAfter: Math.ceil((resetTime.getTime() - Date.now()) / 1000) },
        context?.requestId || this.defaultContext.requestId
      ),

    quotaExceeded: (quota: number, period: string, context?: RequestContext) => 
      new RateLimitDomainError(
        `Quota exceeded: ${quota} requests per ${period}`,
        'RATE_LIMIT_QUOTA_EXCEEDED',
        { limit: quota, resetTime: new Date(Date.now() + 3600000) }, // 1 hour from now
        context?.requestId || this.defaultContext.requestId
      ),
  };

  /**
   * External service errors
   */
  static externalService = {
    unavailable: (serviceName: string, context?: RequestContext) => 
      new ExternalServiceDomainError(
        `External service unavailable: ${serviceName}`,
        'EXTERNAL_SERVICE_UNAVAILABLE',
        { serviceName, responseCode: 503 },
        context?.requestId || this.defaultContext.requestId
      ),

    timeout: (serviceName: string, timeout: number, context?: RequestContext) => 
      new ExternalServiceDomainError(
        `External service timeout: ${serviceName}`,
        'EXTERNAL_SERVICE_TIMEOUT',
        { serviceName, responseTime: timeout },
        context?.requestId || this.defaultContext.requestId
      ),

    badResponse: (serviceName: string, statusCode: number, context?: RequestContext) => 
      new ExternalServiceDomainError(
        `External service error: ${serviceName}`,
        'EXTERNAL_SERVICE_BAD_RESPONSE',
        { serviceName, responseCode: statusCode },
        context?.requestId || this.defaultContext.requestId
      ),
  };

  /**
   * Configuration errors
   */
  static config = {
    missing: (configKey: string, context?: RequestContext) => 
      new ConfigurationDomainError(
        `Configuration missing: ${configKey}`,
        'CONFIG_MISSING',
        { configKey },
        context?.requestId || this.defaultContext.requestId
      ),

    invalid: (configKey: string, value: unknown, expectedType: string, context?: RequestContext) => 
      new ConfigurationDomainError(
        `Invalid configuration: ${configKey}`,
        'CONFIG_INVALID',
        { configKey, configValue: value, expectedType },
        context?.requestId || this.defaultContext.requestId
      ),
  };

  /**
   * Security errors
   */
  static security = {
    suspiciousActivity: (threatType: string, sourceIp: string, context?: RequestContext) => 
      new SecurityDomainError(
        'Suspicious activity detected',
        'SECURITY_SUSPICIOUS_ACTIVITY',
        { threatType, sourceIp, riskLevel: 'high' },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    xssAttempt: (_input: string, context?: RequestContext) => 
      new SecurityDomainError(
        'XSS attempt detected',
        'SECURITY_XSS_ATTEMPT',
        { attackVector: 'xss', sourceIp: context?.ipAddress },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    sqlInjection: (_input: string, context?: RequestContext) => 
      new SecurityDomainError(
        'SQL injection attempt detected',
        'SECURITY_SQL_INJECTION',
        { attackVector: 'sql_injection', sourceIp: context?.ipAddress },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),
  };

  /**
   * Performance errors
   */
  static performance = {
    slowOperation: (operation: string, duration: number, threshold: number, context?: RequestContext) => 
      new PerformanceDomainError(
        `Operation exceeded performance threshold: ${operation}`,
        'PERFORMANCE_SLOW_OPERATION',
        { operation, duration, threshold },
        context?.requestId || this.defaultContext.requestId
      ),

    memoryLeak: (component: string, memoryUsage: number, context?: RequestContext) => 
      new PerformanceDomainError(
        `Memory leak detected: ${component}`,
        'PERFORMANCE_MEMORY_LEAK',
        { operation: 'memory_monitoring', memoryUsage },
        context?.requestId || this.defaultContext.requestId
      ),
  };

  /**
   * System errors
   */
  static system = {
    serviceUnavailable: (component: string, context?: RequestContext) => 
      new SystemDomainError(
        `System service unavailable: ${component}`,
        'SYSTEM_SERVICE_UNAVAILABLE',
        { component },
        context?.requestId || this.defaultContext.requestId
      ),

    maintenanceMode: (context?: RequestContext) => 
      new SystemDomainError(
        'System is in maintenance mode',
        'SYSTEM_MAINTENANCE_MODE',
        { component: 'system' },
        context?.requestId || this.defaultContext.requestId
      ),

    healthCheckFailed: (component: string, _reason: string, context?: RequestContext) => 
      new SystemDomainError(
        `Health check failed: ${component}`,
        'SYSTEM_HEALTH_CHECK_FAILED',
        { component },
        context?.requestId || this.defaultContext.requestId
      ),
  };

  /**
   * Business logic errors
   */
  static businessLogic = {
    ruleViolation: (rule: string, details: Record<string, unknown>, context?: RequestContext) => 
      new BusinessLogicDomainError(
        `Business rule violation: ${rule}`,
        'BUSINESS_RULE_VIOLATION',
        { rule, violationType: 'rule_violation', contextData: details },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),

    workflowError: (workflow: string, step: string, context?: RequestContext) => 
      new BusinessLogicDomainError(
        `Workflow error in ${workflow} at step ${step}`,
        'BUSINESS_WORKFLOW_ERROR',
        { rule: workflow, violationType: 'workflow_error', contextData: { step } },
        context?.requestId || this.defaultContext.requestId,
        context?.userId || this.defaultContext.userId
      ),
  };

  /**
   * Create a custom error using the enhanced error system
   */
  static custom = {
    create: (errorClass: new (...args: any[]) => any, ...args: any[]) => {
      return new errorClass(...args);
    },
  };
}

/**
 * Convenient error creation functions
 */
export const createError = ErrorFactory;

/**
 * Type-safe error creation helpers
 */
export type ErrorFactoryType = typeof ErrorFactory;
export type AuthErrorFactory = typeof ErrorFactory.auth;
export type BrowserErrorFactory = typeof ErrorFactory.browser;
export type NetworkErrorFactory = typeof ErrorFactory.network;
export type ResourceErrorFactory = typeof ErrorFactory.resource;
export type ValidationErrorFactory = typeof ErrorFactory.validation;