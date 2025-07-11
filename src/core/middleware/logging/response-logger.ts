/**
 * Response logging functionality
 * @module core/middleware/logging/response-logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 */

import type { Response } from 'express';
import type { Logger } from 'pino';
import type {
  RequestResponseLoggerOptions,
  RequestTiming,
  ExtendedRequest,
  ResponseLogData,
} from './types.js';
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
    const contentType = res.get('content-type') ?? '';

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
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  const originalEnd = res.end.bind(res);

  // Override send method
  res.send = function (this: Response, body: unknown) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  // Override json method
  res.json = function (body: unknown) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  // Override end method
  res.end = function (this: Response, ...args: unknown[]) {
    const [chunk] = args;
    if (
      chunk !== null &&
      chunk !== undefined &&
      (responseBody === null || responseBody === undefined)
    ) {
      responseBody = chunk;
    }
    return (originalEnd as (this: Response, ...args: unknown[]) => Response).apply(this, args);
  };

  return {
    getResponseBody: () => responseBody,
  };
};

/**
 * Log response
 */
interface LogResponseOptions {
  req: ExtendedRequest;
  res: Response;
  requestId: string;
  startTime: number;
  timing: RequestTiming;
  responseBody: unknown;
  config: RequestResponseLoggerOptions;
  logger: Logger;
}

/**
 * Add headers to response log data if configured
 */
const addHeadersIfConfigured = (
  responseLogData: ResponseLogData,
  res: Response,
  config: RequestResponseLoggerOptions,
): void => {
  if (config.includeResponseHeaders === true) {
    const headers = formatHeaders(
      res.getHeaders() as Record<string, string | string[]>,
      config.sensitiveHeaders ?? DEFAULT_SENSITIVE_HEADERS,
    );
    addHeadersToLogData(responseLogData, headers);
  }
};

/**
 * Add response body to log data if configured
 */
const addResponseBodyIfConfigured = (
  responseLogData: ResponseLogData,
  res: Response,
  responseBody: unknown,
  config: RequestResponseLoggerOptions,
): void => {
  if (config.includeResponseBody === true && responseBody !== null && responseBody !== undefined) {
    const maxBodySize = config.maxBodySize ?? 8192;
    const sensitiveBodyFields = config.sensitiveBodyFields ?? DEFAULT_SENSITIVE_BODY_FIELDS;
    const sanitizedBody = extractResponseBody(res, responseBody, maxBodySize, sensitiveBodyFields);
    addBodyToLogData(responseLogData, sanitizedBody);
  }
};

export const logResponse = (options: LogResponseOptions): void => {
  const { req, res, requestId, startTime, timing, responseBody, config, logger } = options;
  // Calculate duration and performance metrics
  const duration = calculateDuration(startTime, timing);
  const slowRequest = isSlowRequest(duration, config.slowRequestThreshold);

  // Extract custom metadata
  const customMetadata = config.metadataExtractor?.(req, res) ?? {};

  // Prepare response log data
  let responseLogData = formatResponseLogData({
    req,
    res,
    requestId,
    duration,
    isSlowRequest: slowRequest,
    customMetadata,
  });

  // Add timing details for high precision
  if (config.highPrecisionTiming === true) {
    responseLogData = addTimingDetails(responseLogData, timing);
  }

  // Add response headers if configured
  addHeadersIfConfigured(responseLogData, res, config);

  // Add response body if configured
  addResponseBodyIfConfigured(responseLogData, res, responseBody, config);

  // Determine log level and log response
  const logLevel = getLogLevel(res.statusCode, slowRequest);
  const message = generateResponseLogMessage(req, res, duration);

  // eslint-disable-next-line security/detect-object-injection
  logger[logLevel](responseLogData, message);
};

interface SetupResponseLoggingOptions {
  req: ExtendedRequest;
  res: Response;
  requestId: string;
  startTime: number;
  timing: RequestTiming;
  responseBody: unknown;
  config: RequestResponseLoggerOptions;
  logger: Logger;
}

/**
 * Setup response logging handlers
 */
export const setupResponseLogging = (options: SetupResponseLoggingOptions): void => {
  const { req, res, requestId, startTime, timing, responseBody, config, logger } = options;
  const logResponseHandler = (): void => {
    logResponse({ req, res, requestId, startTime, timing, responseBody, config, logger });
  };

  // Handle both 'finish' and 'close' events
  res.on('finish', logResponseHandler);
  res.on('close', () => {
    if (!res.headersSent) {
      logResponseHandler();
    }
  });
};
