/**
 * Configuration management for request/response logging
 * @module core/middleware/logging/log-configuration
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 */

import type { RequestResponseLoggerOptions } from './types.js';
import { VerbosityLevel } from './types.js';

/**
 * Sensitive data patterns for redaction
 * @nist au-3 "Content of audit records"
 * @nist ia-5 "Authenticator management"
 */
export const DEFAULT_SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'x-session-token',
  'x-csrf-token',
  'x-access-token',
  'x-refresh-token',
  'bearer',
  'basic',
  'set-cookie',
];

export const DEFAULT_SENSITIVE_BODY_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'auth',
  'authorization',
  'credential',
  'apiKey',
  'sessionId',
  'refreshToken',
  'accessToken',
  'csrfToken',
  'jwt',
  'bearer',
  'privateKey',
  'publicKey',
  'signature',
  'hash',
  'salt',
];

export const DEFAULT_LOGGED_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'text/plain',
  'text/html',
  'text/xml',
  'application/xml',
];

/**
 * Default configuration based on verbosity level
 */
export const getDefaultConfig = (verbosity: VerbosityLevel): Partial<RequestResponseLoggerOptions> => {
  const baseConfig = {
    maxBodySize: 8192, // 8KB
    sensitiveHeaders: DEFAULT_SENSITIVE_HEADERS,
    sensitiveBodyFields: DEFAULT_SENSITIVE_BODY_FIELDS,
    loggedContentTypes: DEFAULT_LOGGED_CONTENT_TYPES,
    auditLogging: true,
    requestIdHeader: 'x-request-id',
    highPrecisionTiming: false,
    skipPaths: ['/health', '/metrics'],
    skipMethods: [],
    slowRequestThreshold: 1000, // 1 second
    errorsOnly: false,
  };

  switch (verbosity) {
    case VerbosityLevel.MINIMAL:
      return {
        ...baseConfig,
        includeHeaders: false,
        includeResponseHeaders: false,
        includeRequestBody: false,
        includeResponseBody: false,
        maxBodySize: 0,
        highPrecisionTiming: false,
      };

    case VerbosityLevel.STANDARD:
      return {
        ...baseConfig,
        includeHeaders: false,
        includeResponseHeaders: false,
        includeRequestBody: false,
        includeResponseBody: false,
        maxBodySize: 1024, // 1KB
        highPrecisionTiming: true,
      };

    case VerbosityLevel.VERBOSE:
      return {
        ...baseConfig,
        includeHeaders: true,
        includeResponseHeaders: true,
        includeRequestBody: true,
        includeResponseBody: false,
        maxBodySize: 4096, // 4KB
        highPrecisionTiming: true,
      };

    case VerbosityLevel.DEBUG:
      return {
        ...baseConfig,
        includeHeaders: true,
        includeResponseHeaders: true,
        includeRequestBody: true,
        includeResponseBody: true,
        maxBodySize: 16384, // 16KB
        highPrecisionTiming: true,
        skipPaths: [], // Log everything in debug mode
      };

    default:
      return baseConfig;
  }
};

/**
 * Preset configuration factories
 */
export const createPresetConfigs = {
  /**
   * Production-ready configuration
   * @nist au-2 "Audit events"
   * @nist au-3 "Content of audit records"
   */
  production: (options: Partial<RequestResponseLoggerOptions> = {}): RequestResponseLoggerOptions => ({
    verbosity: VerbosityLevel.STANDARD,
    auditLogging: true,
    includeHeaders: false,
    includeRequestBody: false,
    includeResponseBody: false,
    errorsOnly: false,
    slowRequestThreshold: 2000,
    maxBodySize: 4096,
    skipPaths: ['/health', '/metrics'],
    ...options,
  }),

  /**
   * Development configuration
   */
  development: (options: Partial<RequestResponseLoggerOptions> = {}): RequestResponseLoggerOptions => ({
    verbosity: VerbosityLevel.VERBOSE,
    auditLogging: false,
    includeHeaders: true,
    includeRequestBody: true,
    includeResponseBody: true,
    errorsOnly: false,
    slowRequestThreshold: 500,
    maxBodySize: 16384,
    skipPaths: ['/health'],
    ...options,
  }),

  /**
   * Security-focused configuration
   * @nist au-2 "Audit events"
   * @nist au-3 "Content of audit records"
   * @nist au-10 "Non-repudiation"
   */
  security: (options: Partial<RequestResponseLoggerOptions> = {}): RequestResponseLoggerOptions => ({
    verbosity: VerbosityLevel.VERBOSE,
    auditLogging: true,
    includeHeaders: true,
    includeRequestBody: true,
    includeResponseBody: false,
    errorsOnly: false,
    slowRequestThreshold: 1000,
    maxBodySize: 8192,
    skipPaths: [],
    highPrecisionTiming: true,
    ...options,
  }),

  /**
   * Performance-focused configuration
   * @nist au-8 "Time stamps"
   */
  performance: (options: Partial<RequestResponseLoggerOptions> = {}): RequestResponseLoggerOptions => ({
    verbosity: VerbosityLevel.MINIMAL,
    auditLogging: false,
    includeHeaders: false,
    includeRequestBody: false,
    includeResponseBody: false,
    errorsOnly: false,
    slowRequestThreshold: 100,
    maxBodySize: 0,
    skipPaths: ['/health', '/metrics'],
    highPrecisionTiming: true,
    ...options,
  }),
};