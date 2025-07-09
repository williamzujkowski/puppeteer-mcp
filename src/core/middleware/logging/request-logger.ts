/**
 * Request logging functionality
 * @module core/middleware/logging/request-logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 */

import type { Logger } from 'pino';
import type { RequestResponseLoggerOptions, ExtendedRequest } from './types.js';
import { shouldLogContentType } from './log-sanitizer.js';
import { formatRequestLogData, generateRequestLogMessage, formatHeaders } from './log-formatter.js';
import { DEFAULT_SENSITIVE_HEADERS, DEFAULT_SENSITIVE_BODY_FIELDS } from './log-configuration.js';

/**
 * Parse and sanitize request body
 * @nist au-3 "Content of audit records"
 * @nist si-10 "Information input validation"
 */
export const parseRequestBody = (
  req: ExtendedRequest,
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
 * Import redactSensitiveData from log-sanitizer
 */
import { redactSensitiveData } from './log-sanitizer.js';

/**
 * Log incoming request
 */
export const logRequest = (
  req: ExtendedRequest,
  requestId: string,
  config: RequestResponseLoggerOptions,
  logger: Logger,
): void => {
  // Extract custom metadata
  const customMetadata = config.metadataExtractor?.(req, {} as any) || {};
  
  // Prepare request log data
  const requestLogData = formatRequestLogData(req, requestId, customMetadata);

  // Add headers if configured
  if (config.includeHeaders === true) {
    const headers = formatHeaders(
      req.headers as Record<string, string | string[]>,
      config.sensitiveHeaders || DEFAULT_SENSITIVE_HEADERS,
    );
    requestLogData.headers = headers;
  }

  // Add request body if configured
  if (
    config.includeRequestBody === true &&
    shouldLogContentType(req.get('content-type'), config.loggedContentTypes || [])
  ) {
    requestLogData.body = parseRequestBody(
      req,
      config.maxBodySize || 8192,
      config.sensitiveBodyFields || DEFAULT_SENSITIVE_BODY_FIELDS,
    );
  }

  // Log request
  const message = generateRequestLogMessage(req);
  logger.info(requestLogData, message);
};

/**
 * Attach request logging to Express request
 */
export const attachRequestLogging = (
  req: ExtendedRequest,
  requestId: string,
  startTime: number,
): void => {
  req.id = requestId;
  req.startTime = startTime;
};