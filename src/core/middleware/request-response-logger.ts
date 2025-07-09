/**
 * Comprehensive request/response logging middleware with configurable verbosity
 * @module core/middleware/request-response-logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-4 "Audit storage capacity"
 * @nist au-8 "Time stamps"
 * @nist au-10 "Non-repudiation"
 */

import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import type { IncomingHttpHeaders } from 'http';
import { randomUUID } from 'crypto';
import { hrtime } from 'process';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../utils/logger.js';

/**
 * Verbosity levels for request/response logging
 * @nist au-3 "Content of audit records"
 */
export enum VerbosityLevel {
  /** Minimal logging - only essential information */
  MINIMAL = 'minimal',
  /** Standard logging - request/response basics with timing */
  STANDARD = 'standard',
  /** Verbose logging - includes headers and sanitized body */
  VERBOSE = 'verbose',
  /** Debug logging - includes all data for troubleshooting */
  DEBUG = 'debug',
}

/**
 * Configuration options for the request/response logger
 */
export interface RequestResponseLoggerOptions {
  /** Verbosity level for logging */
  verbosity?: VerbosityLevel;
  /** Custom logger instance */
  logger?: Logger;
  /** Whether to include request headers */
  includeHeaders?: boolean;
  /** Whether to include response headers */
  includeResponseHeaders?: boolean;
  /** Whether to include request body */
  includeRequestBody?: boolean;
  /** Whether to include response body */
  includeResponseBody?: boolean;
  /** Maximum body size to log (in bytes) */
  maxBodySize?: number;
  /** Content types to log body for */
  loggedContentTypes?: string[];
  /** Sensitive header names to redact */
  sensitiveHeaders?: string[];
  /** Sensitive body fields to redact */
  sensitiveBodyFields?: string[];
  /** Whether to log to audit trail */
  auditLogging?: boolean;
  /** Custom request ID header name */
  requestIdHeader?: string;
  /** Whether to measure response time with high precision */
  highPrecisionTiming?: boolean;
  /** Skip logging for specific paths */
  skipPaths?: string[];
  /** Skip logging for specific methods */
  skipMethods?: string[];
  /** Custom metadata extractor */
  metadataExtractor?: (req: Request, res: Response) => Record<string, unknown>;
  /** Performance threshold for slow request logging (ms) */
  slowRequestThreshold?: number;
  /** Whether to log only errors */
  errorsOnly?: boolean;
}

/**
 * Timing information for request processing
 */
interface RequestTiming {
  /** High resolution start time */
  startTime: [number, number];
  /** JavaScript timestamp */
  timestamp: number;
  /** Request end time */
  endTime?: [number, number];
  /** Total duration in milliseconds */
  duration?: number;
  /** Time to first byte (TTFB) */
  ttfb?: number;
}

/**
 * Sensitive data patterns for redaction
 * @nist au-3 "Content of audit records"
 * @nist ia-5 "Authenticator management"
 */
const DEFAULT_SENSITIVE_HEADERS = [
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

const DEFAULT_SENSITIVE_BODY_FIELDS = [
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

const DEFAULT_LOGGED_CONTENT_TYPES = [
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
const getDefaultConfig = (verbosity: VerbosityLevel): Partial<RequestResponseLoggerOptions> => {
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
 * Check if content type should be logged
 */
const shouldLogContentType = (contentType: string | undefined, loggedTypes: string[]): boolean => {
  if (!contentType) return false;
  const type = contentType.toLowerCase().split(';')[0] || '';
  return loggedTypes.some((loggedType) => type.includes(loggedType));
};

/**
 * Redact sensitive data from object
 * @nist au-3 "Content of audit records"
 * @nist ia-5 "Authenticator management"
 */
const redactSensitiveData = (
  obj: Record<string, unknown>,
  sensitiveFields: string[],
): Record<string, unknown> => {
  const redacted = { ...obj };
  
  const redactRecursive = (target: any, path: string[] = []): any => {
    if (typeof target !== 'object' || target === null) {
      return target;
    }

    if (Array.isArray(target)) {
      return target.map((item, index) => redactRecursive(item, [...path, index.toString()]));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(target)) {
      const lowerKey = key.toLowerCase();
      const fullPath = [...path, key].join('.');
      
      // Check if this field should be redacted
      const shouldRedact = sensitiveFields.some(
        (field) => 
          lowerKey.includes(field.toLowerCase()) ||
          fullPath.toLowerCase().includes(field.toLowerCase())
      );

      if (shouldRedact) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactRecursive(value, [...path, key]);
      }
    }
    return result;
  };

  return redactRecursive(redacted);
};

/**
 * Redact sensitive headers
 * @nist au-3 "Content of audit records"
 * @nist ia-5 "Authenticator management"
 */
const redactSensitiveHeaders = (
  headers: IncomingHttpHeaders,
  sensitiveHeaders: string[],
): Record<string, string | string[]> => {
  const redacted: Record<string, string | string[]> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = sensitiveHeaders.some((header) => 
      lowerKey.includes(header.toLowerCase())
    );

    if (shouldRedact) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value ?? '';
    }
  }

  return redacted;
};

/**
 * Parse and sanitize request body
 * @nist au-3 "Content of audit records"
 * @nist si-10 "Information input validation"
 */
const parseRequestBody = (
  req: Request,
  maxSize: number,
  sensitiveFields: string[],
): unknown => {
  try {
    const contentType = req.get('content-type') || '';
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    
    // Skip if body is too large
    if (contentLength > maxSize) {
      return `[BODY TOO LARGE: ${contentLength} bytes]`;
    }

    // Handle different content types
    if (contentType.includes('application/json')) {
      return redactSensitiveData(req.body as Record<string, unknown>, sensitiveFields);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      return redactSensitiveData(req.body as Record<string, unknown>, sensitiveFields);
    } else if (contentType.includes('multipart/form-data')) {
      return '[MULTIPART DATA]';
    } else if (contentType.includes('text/')) {
      const bodyStr = String(req.body || '');
      return bodyStr.length > maxSize ? `[TEXT TOO LARGE: ${bodyStr.length} chars]` : bodyStr;
    } else {
      return `[BINARY DATA: ${contentType}]`;
    }
  } catch (error) {
    return `[PARSE ERROR: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
};

/**
 * Extract response body for logging
 * @nist au-3 "Content of audit records"
 */
const extractResponseBody = (
  res: Response,
  body: unknown,
  maxSize: number,
  sensitiveFields: string[],
): unknown => {
  try {
    const contentType = res.get('content-type') || '';
    
    if (typeof body === 'string') {
      const bodySize = Buffer.byteLength(body, 'utf8');
      if (bodySize > maxSize) {
        return `[RESPONSE TOO LARGE: ${bodySize} bytes]`;
      }

      // Try to parse JSON responses
      if (contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(body);
          return redactSensitiveData(parsed, sensitiveFields);
        } catch {
          return body;
        }
      }
      return body;
    }

    if (typeof body === 'object' && body !== null) {
      return redactSensitiveData(body as Record<string, unknown>, sensitiveFields);
    }

    return body;
  } catch (error) {
    return `[EXTRACT ERROR: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
};

/**
 * Calculate timing metrics
 * @nist au-8 "Time stamps"
 */
const calculateTiming = (timing: RequestTiming): RequestTiming => {
  if (!timing.endTime) {
    timing.endTime = hrtime();
  }
  
  const diff = hrtime(timing.startTime);
  timing.duration = diff[0] * 1000 + diff[1] / 1000000; // Convert to milliseconds
  timing.ttfb = timing.duration; // For now, TTFB = total time
  
  return timing;
};

/**
 * Enhanced request/response logging middleware
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-8 "Time stamps"
 * @nist au-10 "Non-repudiation"
 */
export const requestResponseLogger = (
  options: RequestResponseLoggerOptions = {},
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const verbosity = options.verbosity || VerbosityLevel.STANDARD;
  const config = { ...getDefaultConfig(verbosity), ...options };
  const logger = options.logger || createLogger('request-response-logger');
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const timing: RequestTiming = {
      startTime: config.highPrecisionTiming ? hrtime() : [0, 0],
      timestamp: startTime,
    };

    // Generate or extract request ID
    const requestId = req.id || 
      (config.requestIdHeader ? req.get(config.requestIdHeader) : undefined) ||
      randomUUID();
    
    // Assign request ID and timing
    req.id = requestId;
    req.startTime = startTime;

    // Skip logging for specified paths
    const shouldSkip = config.skipPaths?.some((path) => req.path.includes(path)) ||
                      config.skipMethods?.some((method) => req.method === method);

    if (shouldSkip) {
      return next();
    }

    // Extract custom metadata
    const customMetadata = config.metadataExtractor?.(req, res) || {};

    // Prepare request log data
    const requestLogData: Record<string, unknown> = {
      type: 'HTTP_REQUEST',
      eventType: SecurityEventType.HTTP_REQUEST_STARTED,
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      referer: req.get('referer'),
      contentType: req.get('content-type'),
      contentLength: req.get('content-length'),
      userId: req.user?.userId,
      sessionId: req.user?.sessionId,
      ...customMetadata,
    };

    // Add headers if configured
    if (config.includeHeaders) {
      requestLogData.headers = redactSensitiveHeaders(
        req.headers,
        config.sensitiveHeaders || DEFAULT_SENSITIVE_HEADERS,
      );
    }

    // Add request body if configured
    if (config.includeRequestBody && shouldLogContentType(req.get('content-type'), config.loggedContentTypes || [])) {
      requestLogData.body = parseRequestBody(
        req,
        config.maxBodySize || 8192,
        config.sensitiveBodyFields || DEFAULT_SENSITIVE_BODY_FIELDS,
      );
    }

    // Log request
    logger.info(requestLogData, `HTTP ${req.method} ${req.path} started`);

    // Capture response body if needed
    let responseBody: unknown;
    if (config.includeResponseBody) {
      const originalSend = res.send;
      const originalJson = res.json;
      const originalEnd = res.end;

      res.send = function(body: unknown) {
        responseBody = body;
        return originalSend.call(this, body);
      };

      res.json = function(body: unknown) {
        responseBody = body;
        return originalJson.call(this, body);
      };

      res.end = function(...args: any[]) {
        const [chunk] = args;
        if (chunk && !responseBody) {
          responseBody = chunk;
        }
        return (originalEnd as any).apply(this, args);
      };
    }

    // Log response on finish
    const logResponse = async () => {
      const endTiming = config.highPrecisionTiming ? calculateTiming(timing) : timing;
      const duration = endTiming.duration || (Date.now() - startTime);
      
      // Check if this is a slow request
      const isSlowRequest = duration > (config.slowRequestThreshold || 1000);
      
      // Skip logging if errorsOnly is true and response is successful
      if (config.errorsOnly && res.statusCode < 400) {
        return;
      }

      // Prepare response log data
      const responseLogData: Record<string, unknown> = {
        type: 'HTTP_RESPONSE',
        eventType: SecurityEventType.HTTP_REQUEST_COMPLETED,
        requestId,
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        path: req.path,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        contentLength: res.get('content-length'),
        contentType: res.get('content-type'),
        userId: req.user?.userId,
        sessionId: req.user?.sessionId,
        isSlowRequest,
        ...customMetadata,
      };

      // Add timing details for high precision
      if (config.highPrecisionTiming) {
        responseLogData.timing = {
          duration: endTiming.duration,
          ttfb: endTiming.ttfb,
        };
      }

      // Add response headers if configured
      if (config.includeResponseHeaders) {
        responseLogData.headers = redactSensitiveHeaders(
          res.getHeaders() as IncomingHttpHeaders,
          config.sensitiveHeaders || DEFAULT_SENSITIVE_HEADERS,
        );
      }

      // Add response body if configured
      if (config.includeResponseBody && responseBody) {
        responseLogData.body = extractResponseBody(
          res,
          responseBody,
          config.maxBodySize || 8192,
          config.sensitiveBodyFields || DEFAULT_SENSITIVE_BODY_FIELDS,
        );
      }

      // Determine log level based on status code
      const logLevel = res.statusCode >= 500 ? 'error' :
                      res.statusCode >= 400 ? 'warn' :
                      isSlowRequest ? 'warn' : 'info';

      // Log response
      logger[logLevel](responseLogData, 
        `HTTP ${req.method} ${req.path} ${res.statusCode} (${Math.round(duration)}ms)`
      );

      // Log to audit trail if configured
      if (config.auditLogging) {
        const auditResult = res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure';
        
        await logSecurityEvent(SecurityEventType.HTTP_REQUEST_COMPLETED, {
          userId: req.user?.userId,
          resource: req.path,
          action: req.method,
          result: auditResult,
          reason: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
          metadata: {
            requestId,
            statusCode: res.statusCode,
            duration,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            contentType: req.get('content-type'),
            responseContentType: res.get('content-type'),
            isSlowRequest,
          },
        });
      }
    };

    // Handle both 'finish' and 'close' events
    res.on('finish', logResponse);
    res.on('close', () => {
      if (!res.headersSent) {
        logResponse();
      }
    });

    // Handle errors
    res.on('error', (error) => {
      logger.error({
        type: 'HTTP_ERROR',
        requestId,
        method: req.method,
        url: req.url,
        path: req.path,
        error: error.message,
        stack: error.stack,
        userId: req.user?.userId,
      }, `HTTP ${req.method} ${req.path} error`);
    });

    next();
  };
};

/**
 * Create a request/response logger with preset configurations
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 */
export const createRequestResponseLogger = {
  /**
   * Minimal logging configuration
   */
  minimal: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger({ verbosity: VerbosityLevel.MINIMAL, ...options }),

  /**
   * Standard logging configuration
   */
  standard: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger({ verbosity: VerbosityLevel.STANDARD, ...options }),

  /**
   * Verbose logging configuration
   */
  verbose: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger({ verbosity: VerbosityLevel.VERBOSE, ...options }),

  /**
   * Debug logging configuration
   */
  debug: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger({ verbosity: VerbosityLevel.DEBUG, ...options }),

  /**
   * Production-ready configuration
   * @nist au-2 "Audit events"
   * @nist au-3 "Content of audit records"
   */
  production: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger({
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
  development: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger({
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
  security: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger({
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
  performance: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger({
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

/**
 * Export types for external use
 */
export type {
  RequestTiming,
};