/**
 * Service-related error factories
 * @module core/errors/factories/service-errors
 * @nist si-11 "Error handling"
 */

import {
  ExternalServiceDomainError,
  RateLimitDomainError,
  ConfigurationDomainError,
  SystemDomainError,
} from '../domain-errors.js';
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
    defaultContext?: RequestContext
  ): RateLimitDomainError =>
    new RateLimitDomainError(
      'Rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      { limit, resetTime, retryAfter: Math.ceil((resetTime.getTime() - Date.now()) / 1000) },
      context?.requestId ?? defaultContext?.requestId
    ),

  quotaExceeded: (
    quota: number,
    period: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): RateLimitDomainError =>
    new RateLimitDomainError(
      `Quota exceeded: ${quota} requests per ${period}`,
      'RATE_LIMIT_QUOTA_EXCEEDED',
      { limit: quota, resetTime: new Date(Date.now() + 3600000) }, // 1 hour from now
      context?.requestId ?? defaultContext?.requestId
    ),
};

/**
 * External service error factory methods
 */
export const externalServiceErrors = {
  unavailable: (
    serviceName: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): ExternalServiceDomainError =>
    new ExternalServiceDomainError(
      `External service unavailable: ${serviceName}`,
      'EXTERNAL_SERVICE_UNAVAILABLE',
      { serviceName, responseCode: 503 },
      context?.requestId ?? defaultContext?.requestId
    ),

  timeout: (
    serviceName: string,
    timeout: number,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): ExternalServiceDomainError =>
    new ExternalServiceDomainError(
      `External service timeout: ${serviceName}`,
      'EXTERNAL_SERVICE_TIMEOUT',
      { serviceName, responseTime: timeout },
      context?.requestId ?? defaultContext?.requestId
    ),

  badResponse: (
    serviceName: string,
    statusCode: number,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): ExternalServiceDomainError =>
    new ExternalServiceDomainError(
      `External service error: ${serviceName}`,
      'EXTERNAL_SERVICE_BAD_RESPONSE',
      { serviceName, responseCode: statusCode },
      context?.requestId ?? defaultContext?.requestId
    ),
};

/**
 * Configuration error factory methods
 */
export const configErrors = {
  missing: (
    configKey: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): ConfigurationDomainError =>
    new ConfigurationDomainError(
      `Configuration missing: ${configKey}`,
      'CONFIG_MISSING',
      { configKey },
      context?.requestId ?? defaultContext?.requestId
    ),

  invalid: (params: InvalidConfigParams): ConfigurationDomainError =>
    new ConfigurationDomainError(
      `Invalid configuration: ${params.configKey}`,
      'CONFIG_INVALID',
      { configKey: params.configKey, configValue: params.value, expectedType: params.expectedType },
      params.context?.requestId ?? params.defaultContext?.requestId
    ),
};

/**
 * System error factory methods
 */
export const systemErrors = {
  serviceUnavailable: (
    component: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): SystemDomainError =>
    new SystemDomainError(
      `System service unavailable: ${component}`,
      'SYSTEM_SERVICE_UNAVAILABLE',
      { component },
      context?.requestId ?? defaultContext?.requestId
    ),

  maintenanceMode: (
    context?: RequestContext,
    defaultContext?: RequestContext
  ): SystemDomainError =>
    new SystemDomainError(
      'System is in maintenance mode',
      'SYSTEM_MAINTENANCE_MODE',
      { component: 'system' },
      context?.requestId ?? defaultContext?.requestId
    ),

  healthCheckFailed: (
    component: string,
    reason: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): SystemDomainError =>
    new SystemDomainError(
      `Health check failed: ${component}`,
      'SYSTEM_HEALTH_CHECK_FAILED',
      { component, reason },
      context?.requestId ?? defaultContext?.requestId
    ),
};