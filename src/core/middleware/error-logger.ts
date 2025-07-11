/**
 * Error logging utilities for comprehensive error logging
 * @module core/middleware/error-logger
 * @nist au-3 "Content of Audit Records"
 * @nist au-9 "Protection of Audit Information"
 */

import type { Request } from 'express';
import type { Logger } from 'pino';
import { EnhancedAppError } from '../errors/enhanced-app-error.js';
import { ErrorCategory, ErrorSeverity } from '../errors/error-context.js';
import '../../types/express.js';

/**
 * Configuration for error logging
 */
export interface ErrorLoggerConfig {
  includeStack?: boolean;
  sanitizeSensitiveData?: boolean;
}

/**
 * Error logger for comprehensive error logging with context
 */
export class ErrorLogger {
  private logger: Logger;
  private config: ErrorLoggerConfig;

  constructor(logger: Logger, config: ErrorLoggerConfig = {}) {
    this.logger = logger;
    this.config = {
      includeStack: process.env.NODE_ENV === 'development',
      sanitizeSensitiveData: true,
      ...config,
    };
  }

  /**
   * Log error with comprehensive context
   */
  logError(error: EnhancedAppError, req: Request, startTime: number): void {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        errorCode: error.errorContext.errorCode,
        category: error.errorContext.category,
        severity: error.errorContext.severity,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        requestId: error.getRequestId(),
        userId: error.getUserId(),
        sessionId: error.getSessionId(),
        correlationIds: error.getCorrelationIds(),
        tags: error.getTags(),
        ...(this.config.includeStack === true ? { stack: error.stack } : {}),
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        headers: {
          'user-agent': req.get('user-agent'),
          'content-type': req.get('content-type'),
          authorization: req.get('authorization') !== undefined ? '[REDACTED]' : undefined,
        },
        query: req.query,
        params: req.params,
        ip: req.ip,
      },
      duration: Date.now() - startTime,
    };

    // Log at appropriate level based on severity
    this.logBySeverity(error, logData);

    // Additional security logging for security-related errors
    this.logSecurityIncident(error, req);
  }

  /**
   * Log error based on severity level
   */
  private logBySeverity(error: EnhancedAppError, logData: Record<string, unknown>): void {
    switch (error.getSeverity()) {
      case ErrorSeverity.LOW:
        this.logger.info(logData, 'Request error (low severity)');
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(logData, 'Request error (medium severity)');
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(logData, 'Request error (high severity)');
        break;
      case ErrorSeverity.CRITICAL:
        this.logger.fatal(logData, 'Request error (critical severity)');
        break;
    }
  }

  /**
   * Log security incidents with additional context
   */
  private logSecurityIncident(error: EnhancedAppError, req: Request): void {
    if (error.getCategory() === ErrorCategory.SECURITY) {
      this.logger.error(
        {
          event: 'security_incident',
          errorCode: error.errorContext.errorCode,
          userId: error.getUserId(),
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          requestId: error.getRequestId(),
          timestamp: new Date().toISOString(),
          severity: error.getSeverity(),
          details:
            this.config.sanitizeSensitiveData === true ? '[REDACTED]' : error.getTechnicalDetails(),
        },
        'Security error detected',
      );
    }
  }
}
