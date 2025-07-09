/**
 * Enhanced error handling middleware with comprehensive error system
 * @module core/middleware/error-handler
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 * @nist au-9 "Protection of Audit Information"
 */

import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { EnhancedAppError } from '../errors/enhanced-app-error.js';
import { ErrorSerializer } from '../errors/error-serialization.js';
import { ErrorTracker } from '../errors/error-tracking.js';
import { ErrorRecoveryManager } from '../errors/error-recovery.js';
import { ErrorContextBuilder, ErrorCategory, ErrorSeverity } from '../errors/error-context.js';

/**
 * Enhanced error handler configuration
 */
export interface ErrorHandlerConfig {
  includeStack?: boolean;
  includeTechnicalDetails?: boolean;
  includeRetryConfig?: boolean;
  includeHelpLinks?: boolean;
  sanitizeSensitiveData?: boolean;
  trackErrors?: boolean;
  enableRecovery?: boolean;
}

/**
 * Enhanced error handler middleware
 */
export class EnhancedErrorHandler {
  private logger: Logger;
  private config: ErrorHandlerConfig;
  private errorTracker?: ErrorTracker;
  private recoveryManager?: ErrorRecoveryManager;

  constructor(
    logger: Logger,
    config: ErrorHandlerConfig = {},
    errorTracker?: ErrorTracker,
    recoveryManager?: ErrorRecoveryManager
  ) {
    this.logger = logger;
    this.config = {
      includeStack: process.env.NODE_ENV === 'development',
      includeTechnicalDetails: true,
      includeRetryConfig: true,
      includeHelpLinks: true,
      sanitizeSensitiveData: true,
      trackErrors: true,
      enableRecovery: false,
      ...config,
    };
    this.errorTracker = errorTracker;
    this.recoveryManager = recoveryManager;
  }

  /**
   * Get the error handler middleware
   */
  getMiddleware(): ErrorRequestHandler {
    return async (
      err: Error | AppError | EnhancedAppError | ZodError,
      req: Request,
      res: Response,
      _next: NextFunction,
    ): Promise<void> => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string || 'unknown';
      const userId = req.user?.userId;

      // Create context for error handling
      const context = {
        requestId,
        userId,
        endpoint: req.originalUrl,
        method: req.method,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
      };

      // Convert to enhanced error if needed
      let enhancedError: EnhancedAppError;
      if (err instanceof EnhancedAppError) {
        enhancedError = err;
      } else if (err instanceof ZodError) {
        enhancedError = this.createEnhancedErrorFromZod(err, context);
      } else if (err instanceof AppError) {
        enhancedError = this.createEnhancedErrorFromApp(err, context);
      } else {
        enhancedError = this.createEnhancedErrorFromGeneric(err, context);
      }

      // Track error if enabled
      if (this.config.trackErrors && this.errorTracker) {
        try {
          await this.errorTracker.trackError(enhancedError, context);
        } catch (trackingError) {
          this.logger.error({
            error: trackingError,
            originalError: enhancedError.message,
            requestId,
          }, 'Failed to track error');
        }
      }

      // Log error with comprehensive context
      this.logError(enhancedError, req, startTime);

      // Attempt recovery if enabled
      if (this.config.enableRecovery && this.recoveryManager) {
        try {
          const recoveryResult = await this.recoveryManager.recover(enhancedError, context);
          if (recoveryResult.success) {
            this.logger.info({
              requestId,
              recovery: recoveryResult.strategy,
              duration: recoveryResult.duration,
            }, 'Error recovery succeeded');
            
            // Recovery succeeded, but we still need to return an error response
            // The recovery might have fixed the underlying issue for future requests
          }
        } catch (recoveryError) {
          this.logger.error({
            error: recoveryError,
            requestId,
          }, 'Error recovery failed');
        }
      }

      // Send error response
      await this.sendErrorResponse(enhancedError, req, res, startTime);
    };
  }

  /**
   * Create enhanced error from Zod validation error
   */
  private createEnhancedErrorFromZod(
    error: ZodError,
    context: Record<string, unknown>
  ): EnhancedAppError {
    const errorContext = new ErrorContextBuilder()
      .setErrorCode('VALIDATION_ERROR')
      .setCategory(ErrorCategory.VALIDATION)
      .setSeverity(ErrorSeverity.MEDIUM)
      .setUserMessage('Invalid request data')
      .setTechnicalDetails({
        validationErrors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      })
      .setRequestContext(
        context.requestId as string,
        context.userId as string
      )
      .setOperationContext('request_validation', context.endpoint as string)
      .build();

    return new EnhancedAppError('Validation failed', errorContext, 400);
  }

  /**
   * Create enhanced error from AppError
   */
  private createEnhancedErrorFromApp(
    error: AppError,
    context: Record<string, unknown>
  ): EnhancedAppError {
    const errorContext = new ErrorContextBuilder()
      .setErrorCode(error.name.toUpperCase().replace(/ERROR$/, ''))
      .setCategory(this.inferCategory(error.name))
      .setSeverity(this.inferSeverity(error.statusCode))
      .setUserMessage(error.message)
      .setTechnicalDetails(error.details || {})
      .setRequestContext(
        context.requestId as string,
        context.userId as string
      )
      .setOperationContext('request_processing', context.endpoint as string)
      .build();

    return new EnhancedAppError(
      error.message,
      errorContext,
      error.statusCode,
      error.isOperational,
      error.details
    );
  }

  /**
   * Create enhanced error from generic error
   */
  private createEnhancedErrorFromGeneric(
    error: Error,
    context: Record<string, unknown>
  ): EnhancedAppError {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorContext = new ErrorContextBuilder()
      .setErrorCode('INTERNAL_SERVER_ERROR')
      .setCategory(ErrorCategory.SYSTEM)
      .setSeverity(ErrorSeverity.CRITICAL)
      .setUserMessage(isDevelopment ? error.message : 'An unexpected error occurred')
      .setTechnicalDetails({
        errorType: error.constructor.name,
        ...(isDevelopment && { stack: error.stack }),
      })
      .setRequestContext(
        context.requestId as string,
        context.userId as string
      )
      .setOperationContext('request_processing', context.endpoint as string)
      .setShouldReport(true)
      .build();

    return new EnhancedAppError(error.message, errorContext, 500, false);
  }

  /**
   * Log error with comprehensive context
   */
  private logError(error: EnhancedAppError, req: Request, startTime: number): void {
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
        ...(this.config.includeStack && { stack: error.stack }),
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        headers: {
          'user-agent': req.get('user-agent'),
          'content-type': req.get('content-type'),
          'authorization': req.get('authorization') ? '[REDACTED]' : undefined,
        },
        query: req.query,
        params: req.params,
        ip: req.ip,
      },
      duration: Date.now() - startTime,
    };

    // Log at appropriate level based on severity
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

    // Additional security logging for security-related errors
    if (error.getCategory() === ErrorCategory.SECURITY) {
      this.logger.error({
        event: 'security_incident',
        errorCode: error.errorContext.errorCode,
        userId: error.getUserId(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: error.getRequestId(),
        timestamp: new Date().toISOString(),
        severity: error.getSeverity(),
        details: this.config.sanitizeSensitiveData 
          ? '[REDACTED]' 
          : error.getTechnicalDetails(),
      }, 'Security error detected');
    }
  }

  /**
   * Send error response
   */
  private async sendErrorResponse(
    error: EnhancedAppError,
    req: Request,
    res: Response,
    startTime: number
  ): Promise<void> {
    const requestDuration = Date.now() - startTime;
    
    const serializedError = ErrorSerializer.serializeForRest(error, {
      requestId: error.getRequestId(),
      userId: error.getUserId(),
      endpoint: req.originalUrl,
      method: req.method,
      requestDuration,
      includeStack: this.config.includeStack,
      includeTechnicalDetails: this.config.includeTechnicalDetails,
      includeRetryConfig: this.config.includeRetryConfig,
      includeHelpLinks: this.config.includeHelpLinks,
      sanitizeSensitiveData: this.config.sanitizeSensitiveData,
    });

    // Set security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    // Don't leak sensitive information in error responses
    if (error.containsSensitiveData()) {
      delete serializedError.error.details;
    }

    res.status(error.statusCode).json(serializedError);
  }

  /**
   * Infer error category from error name
   */
  private inferCategory(errorName: string): ErrorCategory {
    const name = errorName.toLowerCase();
    
    if (name.includes('auth')) return ErrorCategory.AUTHENTICATION;
    if (name.includes('validation')) return ErrorCategory.VALIDATION;
    if (name.includes('network')) return ErrorCategory.NETWORK;
    if (name.includes('browser')) return ErrorCategory.BROWSER;
    if (name.includes('database')) return ErrorCategory.DATABASE;
    if (name.includes('resource')) return ErrorCategory.RESOURCE;
    if (name.includes('ratelimit')) return ErrorCategory.RATE_LIMIT;
    if (name.includes('security')) return ErrorCategory.SECURITY;
    if (name.includes('config')) return ErrorCategory.CONFIGURATION;
    
    return ErrorCategory.SYSTEM;
  }

  /**
   * Infer error severity from status code
   */
  private inferSeverity(statusCode: number): ErrorSeverity {
    if (statusCode >= 400 && statusCode < 500) return ErrorSeverity.MEDIUM;
    if (statusCode >= 500) return ErrorSeverity.HIGH;
    return ErrorSeverity.LOW;
  }
}

/**
 * Legacy error handler for backward compatibility
 */
export const errorHandler = (logger: Logger): ErrorRequestHandler => {
  const enhancedHandler = new EnhancedErrorHandler(logger, {
    includeStack: process.env.NODE_ENV === 'development',
    includeTechnicalDetails: true,
    sanitizeSensitiveData: true,
    trackErrors: false, // Disabled by default for backward compatibility
  });

  return enhancedHandler.getMiddleware();
};

/**
 * Create enhanced error handler with full configuration
 */
export const createEnhancedErrorHandler = (
  logger: Logger,
  config: ErrorHandlerConfig = {},
  errorTracker?: ErrorTracker,
  recoveryManager?: ErrorRecoveryManager
): ErrorRequestHandler => {
  const enhancedHandler = new EnhancedErrorHandler(logger, config, errorTracker, recoveryManager);
  return enhancedHandler.getMiddleware();
};
