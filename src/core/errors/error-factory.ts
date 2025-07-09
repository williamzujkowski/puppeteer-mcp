/**
 * Error factory for creating domain-specific errors with consistent patterns
 * @module core/errors/error-factory
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import type { RequestContext } from './factories/types.js';

/**
 * Parameters for range validation in ErrorFactory
 */
interface RangeValidationInput {
  field: string;
  value: unknown;
  min: number;
  max: number;
  context?: RequestContext;
}
import { authErrors, authorizationErrors } from './factories/auth-errors.js';
import { browserErrors } from './factories/browser-errors.js';
import { networkErrors } from './factories/network-errors.js';
import { resourceErrors } from './factories/resource-errors.js';
import { validationErrors } from './factories/validation-errors.js';
import {
  rateLimitErrors,
  externalServiceErrors,
  configErrors,
  systemErrors,
} from './factories/service-errors.js';
import {
  securityErrors,
  performanceErrors,
  businessLogicErrors,
} from './factories/security-errors.js';
import type {
  AuthenticationDomainError,
  ExternalServiceDomainError,
  PerformanceDomainError,
  SystemDomainError,
  BusinessLogicDomainError,
} from './domain-errors.js';

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
    invalidCredentials: (context?: RequestContext): AuthenticationDomainError =>
      authErrors.invalidCredentials(context, this.defaultContext),

    tokenExpired: (context?: RequestContext): AuthenticationDomainError =>
      authErrors.tokenExpired(context, this.defaultContext),

    tokenInvalid: (context?: RequestContext): AuthenticationDomainError =>
      authErrors.tokenInvalid(context, this.defaultContext),

    missingToken: (context?: RequestContext): AuthenticationDomainError =>
      authErrors.missingToken(context, this.defaultContext),

    accountLocked: (context?: RequestContext): AuthenticationDomainError =>
      authErrors.accountLocked(context, this.defaultContext),

    accountDisabled: (context?: RequestContext): AuthenticationDomainError =>
      authErrors.accountDisabled(context, this.defaultContext),
  };

  /**
   * Authorization errors
   */
  static authorization = {
    insufficientPermissions: (
      requiredPermissions: string[],
      userPermissions: string[],
      context?: RequestContext
    ) =>
      authorizationErrors.insufficientPermissions(
        requiredPermissions,
        userPermissions,
        context,
        this.defaultContext
      ),

    roleRequired: (requiredRole: string, userRole: string, context?: RequestContext) =>
      authorizationErrors.roleRequired(requiredRole, userRole, context, this.defaultContext),

    resourceAccessDenied: (resource: string, context?: RequestContext) =>
      authorizationErrors.resourceAccessDenied(resource, context, this.defaultContext),

    operationForbidden: (operation: string, context?: RequestContext) =>
      authorizationErrors.operationForbidden(operation, context, this.defaultContext),
  };

  /**
   * Browser automation errors
   */
  static browser = {
    pageNotFound: (pageId: string, context?: RequestContext) =>
      browserErrors.pageNotFound(pageId, context, this.defaultContext),

    elementNotFound: (selector: string, pageId: string, context?: RequestContext) =>
      browserErrors.elementNotFound(selector, pageId, context, this.defaultContext),

    navigationFailed: (url: string, error: string, context?: RequestContext) =>
      browserErrors.navigationFailed(url, error, context, this.defaultContext),

    actionTimeout: (action: string, selector: string, timeout: number, context?: RequestContext) =>
      browserErrors.actionTimeout({ action, selector, timeout, context, defaultContext: this.defaultContext }),

    poolExhausted: (poolSize: number, activeConnections: number, context?: RequestContext) =>
      browserErrors.poolExhausted(poolSize, activeConnections, context, this.defaultContext),

    browserCrashed: (browserId: string, context?: RequestContext) =>
      browserErrors.browserCrashed(browserId, context, this.defaultContext),

    evaluationFailed: (script: string, error: string, context?: RequestContext) =>
      browserErrors.evaluationFailed(script, error, context, this.defaultContext),
  };

  /**
   * Network errors
   */
  static network = {
    connectionFailed: (url: string, context?: RequestContext) =>
      networkErrors.connectionFailed(url, context, this.defaultContext),

    timeout: (url: string, timeout: number, context?: RequestContext) =>
      networkErrors.timeout(url, timeout, context, this.defaultContext),

    dnsResolutionFailed: (hostname: string, context?: RequestContext) =>
      networkErrors.dnsResolutionFailed(hostname, context, this.defaultContext),

    sslError: (url: string, error: string, context?: RequestContext) =>
      networkErrors.sslError(url, error, context, this.defaultContext),

    proxyError: (proxyUrl: string, context?: RequestContext) =>
      networkErrors.proxyError(proxyUrl, context, this.defaultContext),
  };

  /**
   * Resource errors
   */
  static resource = {
    memoryExhausted: (currentUsage: number, maxLimit: number, context?: RequestContext) =>
      resourceErrors.memoryExhausted(currentUsage, maxLimit, context, this.defaultContext),

    cpuExhausted: (currentUsage: number, maxLimit: number, context?: RequestContext) =>
      resourceErrors.cpuExhausted(currentUsage, maxLimit, context, this.defaultContext),

    connectionPoolExhausted: (
      poolSize: number,
      activeConnections: number,
      context?: RequestContext
    ) =>
      resourceErrors.connectionPoolExhausted(
        poolSize,
        activeConnections,
        context,
        this.defaultContext
      ),

    diskSpaceExhausted: (available: number, required: number, context?: RequestContext) =>
      resourceErrors.diskSpaceExhausted(available, required, context, this.defaultContext),

    fileHandleExhausted: (currentUsage: number, maxLimit: number, context?: RequestContext) =>
      resourceErrors.fileHandleExhausted(currentUsage, maxLimit, context, this.defaultContext),
  };

  /**
   * Validation errors
   */
  static validation = {
    required: (field: string, context?: RequestContext) =>
      validationErrors.required(field, context, this.defaultContext),

    invalidFormat: (
      field: string,
      value: unknown,
      expectedFormat: string,
      context?: RequestContext
    ) =>
      validationErrors.invalidFormat({ field, value, expectedFormat, context, defaultContext: this.defaultContext }),

    outOfRange: (params: RangeValidationInput) => {
      return validationErrors.outOfRange({ 
        field: params.field, 
        value: params.value, 
        min: params.min, 
        max: params.max, 
        context: params.context, 
        defaultContext: this.defaultContext 
      });
    },

    invalidEnum: (field: string, value: unknown, validValues: unknown[], context?: RequestContext) =>
      validationErrors.invalidEnum({ field, value, validValues, context, defaultContext: this.defaultContext }),

    tooLong: (field: string, value: string, maxLength: number, context?: RequestContext) =>
      validationErrors.tooLong({ field, value, limit: maxLength, context, defaultContext: this.defaultContext }),

    tooShort: (field: string, value: string, minLength: number, context?: RequestContext) =>
      validationErrors.tooShort({ field, value, limit: minLength, context, defaultContext: this.defaultContext }),
  };

  /**
   * Rate limiting errors
   */
  static rateLimit = {
    exceeded: (limit: number, resetTime: Date, context?: RequestContext) =>
      rateLimitErrors.exceeded(limit, resetTime, context, this.defaultContext),

    quotaExceeded: (quota: number, period: string, context?: RequestContext) =>
      rateLimitErrors.quotaExceeded(quota, period, context, this.defaultContext),
  };

  /**
   * External service errors
   */
  static externalService = {
    unavailable: (serviceName: string, context?: RequestContext): ExternalServiceDomainError =>
      externalServiceErrors.unavailable(serviceName, context, this.defaultContext),

    timeout: (serviceName: string, timeout: number, context?: RequestContext): ExternalServiceDomainError =>
      externalServiceErrors.timeout(serviceName, timeout, context, this.defaultContext),

    badResponse: (serviceName: string, statusCode: number, context?: RequestContext): ExternalServiceDomainError =>
      externalServiceErrors.badResponse(serviceName, statusCode, context, this.defaultContext),
  };

  /**
   * Configuration errors
   */
  static config = {
    missing: (configKey: string, context?: RequestContext) =>
      configErrors.missing(configKey, context, this.defaultContext),

    invalid: (configKey: string, value: unknown, expectedType: string, context?: RequestContext) =>
      configErrors.invalid({ configKey, value, expectedType, context, defaultContext: this.defaultContext }),
  };

  /**
   * Security errors
   */
  static security = {
    suspiciousActivity: (threatType: string, sourceIp: string, context?: RequestContext) =>
      securityErrors.suspiciousActivity(threatType, sourceIp, context, this.defaultContext),

    xssAttempt: (input: string, context?: RequestContext) =>
      securityErrors.xssAttempt(input, context, this.defaultContext),

    sqlInjection: (input: string, context?: RequestContext) =>
      securityErrors.sqlInjection(input, context, this.defaultContext),
  };

  /**
   * Performance errors
   */
  static performance = {
    slowOperation: (
      operation: string,
      duration: number,
      threshold: number,
      context?: RequestContext
    ): PerformanceDomainError =>
      performanceErrors.slowOperation({ operation, duration, threshold, context, defaultContext: this.defaultContext }),

    memoryLeak: (component: string, memoryUsage: number, context?: RequestContext): PerformanceDomainError =>
      performanceErrors.memoryLeak(component, memoryUsage, context, this.defaultContext),
  };

  /**
   * System errors
   */
  static system = {
    serviceUnavailable: (component: string, context?: RequestContext): SystemDomainError =>
      systemErrors.serviceUnavailable(component, context, this.defaultContext),

    maintenanceMode: (context?: RequestContext): SystemDomainError =>
      systemErrors.maintenanceMode(context, this.defaultContext),

    healthCheckFailed: (component: string, reason: string, context?: RequestContext): SystemDomainError =>
      systemErrors.healthCheckFailed(component, reason, context, this.defaultContext),
  };

  /**
   * Business logic errors
   */
  static businessLogic = {
    ruleViolation: (rule: string, details: Record<string, unknown>, context?: RequestContext): BusinessLogicDomainError =>
      businessLogicErrors.ruleViolation(rule, details, context, this.defaultContext),

    workflowError: (workflow: string, step: string, context?: RequestContext): BusinessLogicDomainError =>
      businessLogicErrors.workflowError(workflow, step, context, this.defaultContext),
  };

  /**
   * Create a custom error using the enhanced error system
   */
  static custom = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: <T extends new (...args: any[]) => any>(
      errorClass: T,
      ...args: ConstructorParameters<T>
    ): InstanceType<T> => {
      // Type assertion is necessary here because TypeScript cannot infer
      // the exact type when using generic constructors
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return new errorClass(...args) as InstanceType<T>;
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