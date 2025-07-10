/**
 * Shared types and interfaces for request/response logging
 * @module core/middleware/logging/types
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-8 "Time stamps"
 */

import type { Request, Response } from 'express';
import type { Logger } from 'pino';
import type { IncomingHttpHeaders } from 'http';

/**
 * Extended Request type with additional properties
 */
export interface ExtendedRequest extends Request {
  id: string;
  startTime: number;
  user?: {
    userId: string;
    username: string;
    roles: string[];
    sessionId: string;
  };
}

/**
 * Verbosity levels for request/response logging
 * @nist au-3 "Content of audit records"
 */
export const VerbosityLevel = {
  /** Minimal logging - only essential information */
  MINIMAL: 'minimal',
  /** Standard logging - request/response basics with timing */
  STANDARD: 'standard',
  /** Verbose logging - includes headers and sanitized body */
  VERBOSE: 'verbose',
  /** Debug logging - includes all data for troubleshooting */
  DEBUG: 'debug',
} as const;

export type VerbosityLevel = typeof VerbosityLevel[keyof typeof VerbosityLevel];

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
  metadataExtractor?: (req: ExtendedRequest, res: Response) => Record<string, unknown>;
  /** Performance threshold for slow request logging (ms) */
  slowRequestThreshold?: number;
  /** Whether to log only errors */
  errorsOnly?: boolean;
}

/**
 * Timing information for request processing
 */
export interface RequestTiming {
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
 * Processed request log data
 */
export interface RequestLogData {
  type: string;
  eventType: string;
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  path: string;
  query: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  referer?: string;
  contentType?: string;
  contentLength?: string;
  userId?: string;
  sessionId?: string;
  headers?: Record<string, string | string[]>;
  body?: unknown;
  [key: string]: unknown;
}

/**
 * Processed response log data
 */
export interface ResponseLogData {
  type: string;
  eventType: string;
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  path: string;
  statusCode: number;
  statusMessage?: string;
  duration: number;
  contentLength?: string;
  contentType?: string;
  userId?: string;
  sessionId?: string;
  isSlowRequest: boolean;
  timing?: {
    duration?: number;
    ttfb?: number;
  };
  headers?: Record<string, string | string[]>;
  body?: unknown;
  [key: string]: unknown;
}

/**
 * HTTP headers type for sanitization
 */
export type HttpHeaders = IncomingHttpHeaders | Record<string, string | string[]>;

/**
 * Log level type
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Audit result type
 */
export type AuditResult = 'success' | 'failure';