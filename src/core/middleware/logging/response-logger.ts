/**
 * Response logging functionality
 * @module core/middleware/logging/response-logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 */

import type { Response } from 'express';
import type { Logger } from 'pino';
import type { RequestResponseLoggerOptions, RequestTiming, ExtendedRequest } from './types.js';
import { redactSensitiveData } from './log-sanitizer.js';
import { 
  formatResponseLogData, 
  generateResponseLogMessage, 
  formatHeaders,
  addTimingDetails,
  addHeadersToLogData,
  addBodyToLogData,
} from './log-formatter.js';
import { calculateDuration } from './performance-tracker.js';
import { isSlowRequest, getLogLevel } from './log-filters.js';
import { DEFAULT_SENSITIVE_HEADERS, DEFAULT_SENSITIVE_BODY_FIELDS } from './log-configuration.js';

/**
 * Extract response body for logging
 * @nist au-3 "Content of audit records"
 */
export const extractResponseBody = (
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
 * Setup response body capture
 */
export const setupResponseBodyCapture = (
  res: Response,
  config: RequestResponseLoggerOptions,
): { getResponseBody: () => unknown } => {
  let responseBody: unknown;
  
  if (config.includeResponseBody !== true) {
    return { getResponseBody: () => undefined };
  }

  // Store original methods
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  // Override send method
  res.send = function(body: unknown) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  // Override json method
  res.json = function(body: unknown) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  // Override end method
  res.end = function(...args: unknown[]) {
    const [chunk] = args;
    if (chunk && !responseBody) {
      responseBody = chunk;
    }
    return (originalEnd as any).apply(this, args);
  };

  return {
    getResponseBody: () => responseBody,
  };
};

/**
 * Log response
 */
export const logResponse = (
  req: ExtendedRequest,
  res: Response,
  requestId: string,
  startTime: number,
  timing: RequestTiming,
  responseBody: unknown,
  config: RequestResponseLoggerOptions,
  logger: Logger,
): void => {
  // Calculate duration and performance metrics
  const duration = calculateDuration(startTime, timing);
  const slowRequest = isSlowRequest(duration, config.slowRequestThreshold);
  
  // Extract custom metadata
  const customMetadata = config.metadataExtractor?.(req, res) || {};
  
  // Prepare response log data
  let responseLogData = formatResponseLogData(
    req,
    res,
    requestId,
    duration,
    slowRequest,
    customMetadata,
  );

  // Add timing details for high precision
  if (config.highPrecisionTiming === true) {
    responseLogData = addTimingDetails(responseLogData, timing);
  }

  // Add response headers if configured
  if (config.includeResponseHeaders === true) {
    const headers = formatHeaders(
      res.getHeaders() as Record<string, string | string[]>,
      config.sensitiveHeaders || DEFAULT_SENSITIVE_HEADERS,
    );
    addHeadersToLogData(responseLogData, headers);
  }

  // Add response body if configured
  if (config.includeResponseBody === true && responseBody) {
    const sanitizedBody = extractResponseBody(
      res,
      responseBody,
      config.maxBodySize || 8192,
      config.sensitiveBodyFields || DEFAULT_SENSITIVE_BODY_FIELDS,
    );
    addBodyToLogData(responseLogData, sanitizedBody);
  }

  // Determine log level and log response
  const logLevel = getLogLevel(res.statusCode, slowRequest);
  const message = generateResponseLogMessage(req, res, duration);
  
  logger[logLevel](responseLogData, message);
};

/**
 * Setup response logging handlers
 */
export const setupResponseLogging = (
  req: ExtendedRequest,
  res: Response,
  requestId: string,
  startTime: number,
  timing: RequestTiming,
  responseBody: unknown,
  config: RequestResponseLoggerOptions,
  logger: Logger,
): void => {
  const logResponseHandler = () => {
    logResponse(req, res, requestId, startTime, timing, responseBody, config, logger);
  };

  // Handle both 'finish' and 'close' events
  res.on('finish', logResponseHandler);
  res.on('close', () => {
    if (!res.headersSent) {
      logResponseHandler();
    }
  });
};