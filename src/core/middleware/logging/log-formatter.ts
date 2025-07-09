/**
 * Log formatting and serialization utilities
 * @module core/middleware/logging/log-formatter
 * @nist au-3 "Content of audit records"
 * @nist au-8 "Time stamps"
 */

import type { Response } from 'express';
import type { RequestLogData, ResponseLogData, RequestTiming, ExtendedRequest } from './types.js';
import { SecurityEventType } from '../../../utils/logger.js';
import { redactSensitiveHeaders } from './log-sanitizer.js';
import { roundDuration } from './performance-tracker.js';

/**
 * Format request log data
 */
export const formatRequestLogData = (
  req: ExtendedRequest,
  requestId: string,
  customMetadata: Record<string, unknown> = {},
): RequestLogData => {
  return {
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
};

/**
 * Format response log data
 */
export const formatResponseLogData = (
  req: ExtendedRequest,
  res: Response,
  requestId: string,
  duration: number,
  isSlowRequest: boolean,
  customMetadata: Record<string, unknown> = {},
): ResponseLogData => {
  return {
    type: 'HTTP_RESPONSE',
    eventType: SecurityEventType.HTTP_REQUEST_COMPLETED,
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    path: req.path,
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
    duration: roundDuration(duration),
    contentLength: res.get('content-length'),
    contentType: res.get('content-type'),
    userId: req.user?.userId,
    sessionId: req.user?.sessionId,
    isSlowRequest,
    ...customMetadata,
  };
};

/**
 * Add timing details to response log data
 */
export const addTimingDetails = (
  logData: ResponseLogData,
  timing: RequestTiming,
): ResponseLogData => {
  if (timing.duration !== undefined) {
    logData.timing = {
      duration: timing.duration,
      ttfb: timing.ttfb,
    };
  }
  return logData;
};

/**
 * Add headers to log data
 */
export const addHeadersToLogData = (
  logData: RequestLogData | ResponseLogData,
  headers: Record<string, string | string[]>,
): RequestLogData | ResponseLogData => {
  logData.headers = headers;
  return logData;
};

/**
 * Add body to log data
 */
export const addBodyToLogData = (
  logData: RequestLogData | ResponseLogData,
  body: unknown,
): RequestLogData | ResponseLogData => {
  logData.body = body;
  return logData;
};

/**
 * Format error log data
 */
export const formatErrorLogData = (
  req: ExtendedRequest,
  requestId: string,
  error: Error,
): Record<string, unknown> => {
  return {
    type: 'HTTP_ERROR',
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    path: req.path,
    error: error.message,
    stack: error.stack,
    userId: req.user?.userId,
    sessionId: req.user?.sessionId,
  };
};

/**
 * Format audit metadata
 */
export const formatAuditMetadata = (
  req: ExtendedRequest,
  res: Response,
  requestId: string,
  duration: number,
  isSlowRequest: boolean,
): Record<string, unknown> => {
  return {
    requestId,
    statusCode: res.statusCode,
    duration: roundDuration(duration),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    contentType: req.get('content-type'),
    responseContentType: res.get('content-type'),
    isSlowRequest,
  };
};

/**
 * Generate log message for request
 */
export const generateRequestLogMessage = (req: ExtendedRequest): string => {
  return `HTTP ${req.method} ${req.path} started`;
};

/**
 * Generate log message for response
 */
export const generateResponseLogMessage = (
  req: ExtendedRequest,
  res: Response,
  duration: number,
): string => {
  return `HTTP ${req.method} ${req.path} ${res.statusCode} (${Math.round(duration)}ms)`;
};

/**
 * Generate log message for error
 */
export const generateErrorLogMessage = (req: ExtendedRequest): string => {
  return `HTTP ${req.method} ${req.path} error`;
};

/**
 * Sanitize and format headers for logging
 */
export const formatHeaders = (
  headers: Record<string, string | string[]>,
  sensitiveHeaders: string[],
): Record<string, string | string[]> => {
  return redactSensitiveHeaders(headers, sensitiveHeaders);
};

/**
 * Format content length for display
 */
export const formatContentLength = (contentLength: string | undefined): string => {
  if (!contentLength) return 'unknown';
  
  const bytes = parseInt(contentLength, 10);
  if (isNaN(bytes)) return contentLength;
  
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
};