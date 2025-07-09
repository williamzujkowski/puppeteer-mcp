/**
 * Error logging and exception handling
 * @module core/middleware/logging/error-logger
 * @nist au-3 "Content of audit records"
 * @nist au-10 "Non-repudiation"
 */

import type { Response } from 'express';
import type { Logger } from 'pino';
import type { ExtendedRequest } from './types.js';
import { formatErrorLogData, generateErrorLogMessage } from './log-formatter.js';
import { sanitizeError } from './log-sanitizer.js';

/**
 * Log request error
 */
export const logRequestError = (
  req: ExtendedRequest,
  requestId: string,
  error: Error,
  logger: Logger,
): void => {
  const errorLogData = formatErrorLogData(req, requestId, error);
  const message = generateErrorLogMessage(req);
  
  logger.error(errorLogData, message);
};

/**
 * Setup error logging for response
 */
export const setupErrorLogging = (
  req: ExtendedRequest,
  res: Response,
  requestId: string,
  logger: Logger,
): void => {
  res.on('error', (error) => {
    logRequestError(req, requestId, error, logger);
  });
};

/**
 * Log uncaught exception during request processing
 */
export const logUncaughtException = (
  req: ExtendedRequest,
  requestId: string,
  error: Error,
  logger: Logger,
): void => {
  const sanitizedError = sanitizeError(error);
  
  logger.error({
    type: 'HTTP_UNCAUGHT_EXCEPTION',
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    path: req.path,
    userId: req.user?.userId,
    sessionId: req.user?.sessionId,
    ...sanitizedError,
  }, `Uncaught exception in HTTP ${req.method} ${req.path}`);
};

/**
 * Log request timeout
 */
export const logRequestTimeout = (
  req: ExtendedRequest,
  requestId: string,
  timeout: number,
  logger: Logger,
): void => {
  logger.warn({
    type: 'HTTP_TIMEOUT',
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    path: req.path,
    timeout,
    userId: req.user?.userId,
    sessionId: req.user?.sessionId,
  }, `HTTP ${req.method} ${req.path} timed out after ${timeout}ms`);
};

/**
 * Log request cancellation
 */
export const logRequestCancellation = (
  req: ExtendedRequest,
  requestId: string,
  logger: Logger,
): void => {
  logger.warn({
    type: 'HTTP_CANCELLED',
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    path: req.path,
    userId: req.user?.userId,
    sessionId: req.user?.sessionId,
  }, `HTTP ${req.method} ${req.path} cancelled`);
};

/**
 * Log middleware error
 */
export const logMiddlewareError = (
  req: ExtendedRequest,
  errorData: {
    requestId: string;
    middlewareName: string;
    error: Error;
  },
  logger: Logger,
): void => {
  const sanitizedError = sanitizeError(errorData.error);
  
  logger.error({
    type: 'MIDDLEWARE_ERROR',
    requestId: errorData.requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    path: req.path,
    middleware: errorData.middlewareName,
    userId: req.user?.userId,
    sessionId: req.user?.sessionId,
    ...sanitizedError,
  }, `Middleware error in ${errorData.middlewareName} for HTTP ${req.method} ${req.path}`);
};