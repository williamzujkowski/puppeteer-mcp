/**
 * Interfaces for domain error constructor parameters
 * @module core/errors/domain-error-interfaces
 * @nist si-11 "Error handling"
 */

/**
 * Base error options interface
 */
export interface BaseErrorOptions {
  message: string;
  errorCode: string;
  requestId?: string;
}

/**
 * Authentication error options
 */
export interface AuthenticationErrorOptions extends BaseErrorOptions {
  technicalDetails?: Record<string, unknown>;
  userId?: string;
}

/**
 * Authorization error options
 */
export interface AuthorizationErrorOptions extends BaseErrorOptions {
  requiredPermissions: string[];
  userPermissions: string[];
  userId?: string;
}

/**
 * Browser error options
 */
export interface BrowserErrorOptions extends BaseErrorOptions {
  browserInfo?: {
    browserId?: string;
    pageId?: string;
    action?: string;
    selector?: string;
    url?: string;
  };
  sessionId?: string;
}

/**
 * Network error options
 */
export interface NetworkErrorOptions extends BaseErrorOptions {
  networkInfo?: {
    url?: string;
    method?: string;
    statusCode?: number;
    timeout?: number;
    retryAttempt?: number;
  };
}

/**
 * Validation error options
 */
export interface ValidationErrorOptions extends BaseErrorOptions {
  validationErrors: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
  userId?: string;
}

/**
 * Session error options
 */
export interface SessionErrorOptions extends BaseErrorOptions {
  sessionInfo?: {
    sessionId?: string;
    userId?: string;
    action?: string;
    expiresAt?: Date;
  };
}

/**
 * Configuration error options
 */
export interface ConfigurationErrorOptions extends BaseErrorOptions {
  configurationIssue: string;
  configPath?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
}

/**
 * Security error options
 */
export interface SecurityErrorOptions extends BaseErrorOptions {
  securityInfo: {
    type: string;
    details?: Record<string, unknown>;
    clientIp?: string;
  };
  userId?: string;
}

/**
 * Rate limit error options
 */
export interface RateLimitErrorOptions extends BaseErrorOptions {
  rateLimitInfo: {
    limit: number;
    current: number;
    resetTime: Date;
    window: string;
  };
  userId?: string;
}

/**
 * Resource error options
 */
export interface ResourceErrorOptions extends BaseErrorOptions {
  resourceInfo: {
    resourceType: string;
    resourceId?: string;
    action?: string;
    reason?: string;
  };
}

/**
 * Proxy error options
 */
export interface ProxyErrorOptions extends BaseErrorOptions {
  proxyInfo?: {
    proxyUrl?: string;
    targetUrl?: string;
    statusCode?: number;
    errorDetails?: string;
  };
  sessionId?: string;
}

/**
 * Domain error options
 */
export interface DomainErrorOptions extends BaseErrorOptions {
  domainInfo?: {
    domain: string;
    subdomain?: string;
    operation?: string;
    details?: Record<string, unknown>;
  };
}