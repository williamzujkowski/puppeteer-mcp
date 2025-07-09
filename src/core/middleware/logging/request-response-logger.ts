/**
 * Main request/response logging middleware
 * @module core/middleware/logging/request-response-logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-8 "Time stamps"
 * @nist au-10 "Non-repudiation"
 */

import type { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { createLogger } from '../../../utils/logger.js';
import type { RequestResponseLoggerOptions, ExtendedRequest } from './types.js';
import { VerbosityLevel } from './types.js';
import { getDefaultConfig, createPresetConfigs } from './log-configuration.js';
import { shouldSkipRequest, shouldSkipResponse } from './log-filters.js';
import { createTiming, calculateTiming } from './performance-tracker.js';
import { logRequest, attachRequestLogging } from './request-logger.js';
import { setupResponseBodyCapture, setupResponseLogging } from './response-logger.js';
import { setupErrorLogging } from './error-logger.js';
import { logAuditEvent } from './audit-logger.js';

/**
 * Enhanced request/response logging middleware
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-8 "Time stamps"
 * @nist au-10 "Non-repudiation"
 */
export const requestResponseLogger = (
  options: RequestResponseLoggerOptions = {},
): ((req: ExtendedRequest, res: Response, next: NextFunction) => void) => {
  const verbosity = options.verbosity || VerbosityLevel.STANDARD;
  const config = { ...getDefaultConfig(verbosity), ...options };
  const logger = options.logger || createLogger('request-response-logger');
  
  return (req: ExtendedRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const timing = createTiming(config.highPrecisionTiming);

    // Generate or extract request ID
    const requestId = req.id || 
      (config.requestIdHeader ? req.get(config.requestIdHeader) : undefined) ||
      randomUUID();
    
    // Attach request logging data
    attachRequestLogging(req, requestId, startTime);

    // Skip logging for specified paths/methods
    if (shouldSkipRequest(req, config)) {
      return next();
    }

    // Log incoming request
    logRequest(req, requestId, config, logger);

    // Setup response body capture
    const { getResponseBody } = setupResponseBodyCapture(res, config);

    // Setup response logging
    const logResponseHandler = async () => {
      // Skip response logging if configured
      if (shouldSkipResponse(req, res, config)) {
        return;
      }

      // Calculate final timing
      const endTiming = config.highPrecisionTiming === true ? calculateTiming(timing) : timing;
      const responseBody = getResponseBody();
      
      // Log response
      setupResponseLogging(req, res, requestId, startTime, endTiming, responseBody, config, logger);
      
      // Log audit event
      const duration = endTiming.duration || (Date.now() - startTime);
      const isSlowRequest = duration > (config.slowRequestThreshold || 1000);
      
      await logAuditEvent(req, res, {
        requestId,
        duration,
        isSlowRequest,
        config,
      });
    };

    // Setup error logging
    setupErrorLogging(req, res, requestId, logger);

    // Handle response logging
    res.on('finish', logResponseHandler);
    res.on('close', () => {
      if (!res.headersSent) {
        logResponseHandler();
      }
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
   */
  production: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger(createPresetConfigs.production(options)),

  /**
   * Development configuration
   */
  development: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger(createPresetConfigs.development(options)),

  /**
   * Security-focused configuration
   */
  security: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger(createPresetConfigs.security(options)),

  /**
   * Performance-focused configuration
   */
  performance: (options: Partial<RequestResponseLoggerOptions> = {}) =>
    requestResponseLogger(createPresetConfigs.performance(options)),
};