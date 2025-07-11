/**
 * Filtering logic for what to log
 * @module core/middleware/logging/log-filters
 * @nist au-2 "Audit events"
 */

import type { Response } from 'express';
import type { RequestResponseLoggerOptions, ExtendedRequest } from './types.js';

/**
 * Check if request should be skipped from logging
 */
export const shouldSkipRequest = (
  req: ExtendedRequest,
  config: RequestResponseLoggerOptions,
): boolean => {
  // Skip logging for specified paths
  if (config.skipPaths?.some((path) => req.path.includes(path)) === true) {
    return true;
  }

  // Skip logging for specified methods
  if (config.skipMethods?.some((method) => req.method === method) === true) {
    return true;
  }

  return false;
};

/**
 * Check if response should be skipped from logging
 */
export const shouldSkipResponse = (
  _req: ExtendedRequest,
  res: Response,
  config: RequestResponseLoggerOptions,
): boolean => {
  // Skip logging if errorsOnly is true and response is successful
  if (config.errorsOnly === true && res.statusCode < 400) {
    return true;
  }

  return false;
};

/**
 * Determine if request is slow based on duration
 */
export const isSlowRequest = (duration: number, threshold: number = 1000): boolean => {
  return duration > threshold;
};

/**
 * Get appropriate log level based on status code and performance
 */
export const getLogLevel = (
  statusCode: number,
  isSlowRequest: boolean,
): 'error' | 'warn' | 'info' => {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  if (isSlowRequest) return 'warn';
  return 'info';
};

/**
 * Determine audit result based on status code
 */
export const getAuditResult = (statusCode: number): 'success' | 'failure' => {
  return statusCode >= 200 && statusCode < 400 ? 'success' : 'failure';
};

/**
 * Extract paths that should be monitored for security
 */
export const isSecuritySensitivePath = (path: string): boolean => {
  const sensitivePatterns = [
    '/auth',
    '/login',
    '/logout',
    '/register',
    '/admin',
    '/api/v',
    '/password',
    '/token',
    '/oauth',
    '/session',
  ];

  return sensitivePatterns.some((pattern) => path.toLowerCase().includes(pattern));
};

/**
 * Check if request method is mutating (POST, PUT, DELETE, PATCH)
 */
export const isMutatingRequest = (method: string): boolean => {
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
};
