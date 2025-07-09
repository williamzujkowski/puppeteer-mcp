/**
 * Service-related error factories
 * @module core/errors/factories/service-errors
 * @nist si-11 "Error handling"
 */

import {
  ExternalServiceDomainError,
  ConfigurationDomainError,
  SystemDomainError,
} from '../domain-errors.js';
import { RateLimitDomainError } from '../domain/network-errors.js';
import type { RequestContext } from './types.js';

/**
 * Parameters for invalid configuration errors
 */
interface InvalidConfigParams {
  configKey: string;
  value: unknown;
  expectedType: string;
  context?: RequestContext;
  defaultContext?: RequestContext;
}

/**
 * Rate limiting error factory methods
 */
export const rateLimitErrors = {
  exceeded: (
    limit: number,
    resetTime: Date,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): RateLimitDomainError =>
    new RateLimitDomainError({
      message: 'Rate limit exceeded',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      rateLimitInfo: {
        limit,
        current: limit,
        resetTime,
        window: 'default',
      },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),

  quotaExceeded: (
    quota: number,
    period: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): RateLimitDomainError =>
    new RateLimitDomainError({
      message: `Quota exceeded: ${quota} requests per ${period}`,
      errorCode: 'RATE_LIMIT_QUOTA_EXCEEDED',
      rateLimitInfo: {
        limit: quota,
        current: quota,
        resetTime: new Date(Date.now() + 3600000), // 1 hour from now
        window: period,
      },
      requestId: context?.requestId ?? defaultContext?.requestId,
      userId: context?.userId ?? defaultContext?.userId,
    }),
};

/**
 * External service error factory methods
 */
export const externalServiceErrors = {
  unavailable: (
    serviceName: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): ExternalServiceDomainError =>
    new ExternalServiceDomainError({
      message: `External service unavailable: ${serviceName}`,
      errorCode: 'EXTERNAL_SERVICE_UNAVAILABLE',
      serviceInfo: { serviceName, responseCode: 503 },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  timeout: (
    serviceName: string,
    timeout: number,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): ExternalServiceDomainError =>
    new ExternalServiceDomainError({
      message: `External service timeout: ${serviceName}`,
      errorCode: 'EXTERNAL_SERVICE_TIMEOUT',
      serviceInfo: { serviceName, responseTime: timeout },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  badResponse: (
    serviceName: string,
    statusCode: number,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): ExternalServiceDomainError =>
    new ExternalServiceDomainError({
      message: `External service error: ${serviceName}`,
      errorCode: 'EXTERNAL_SERVICE_BAD_RESPONSE',
      serviceInfo: { serviceName, responseCode: statusCode },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),
};

/**
 * Configuration error factory methods
 */
export const configErrors = {
  missing: (
    configKey: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): ConfigurationDomainError =>
    new ConfigurationDomainError({
      message: `Configuration missing: ${configKey}`,
      errorCode: 'CONFIG_MISSING',
      configurationIssue: `Missing configuration: ${configKey}`,
      configPath: configKey,
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  invalid: (params: InvalidConfigParams): ConfigurationDomainError =>
    new ConfigurationDomainError({
      message: `Invalid configuration: ${params.configKey}`,
      errorCode: 'CONFIG_INVALID',
      configurationIssue: `Invalid configuration value for ${params.configKey}`,
      configPath: params.configKey,
      expectedValue: params.expectedType,
      actualValue: params.value,
      requestId: params.context?.requestId ?? params.defaultContext?.requestId,
    }),
};

/**
 * System error factory methods
 */
export const systemErrors = {
  serviceUnavailable: (
    component: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): SystemDomainError =>
    new SystemDomainError({
      message: `System service unavailable: ${component}`,
      errorCode: 'SYSTEM_SERVICE_UNAVAILABLE',
      systemInfo: { component },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  maintenanceMode: (context?: RequestContext, defaultContext?: RequestContext): SystemDomainError =>
    new SystemDomainError({
      message: 'System is in maintenance mode',
      errorCode: 'SYSTEM_MAINTENANCE_MODE',
      systemInfo: { component: 'system' },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  healthCheckFailed: (
    component: string,
    reason: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): SystemDomainError =>
    new SystemDomainError({
      message: `Health check failed: ${component}`,
      errorCode: 'SYSTEM_HEALTH_CHECK_FAILED',
      systemInfo: { component, reason },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),
};
