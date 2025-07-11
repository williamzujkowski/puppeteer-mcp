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
import { ErrorTracker } from '../errors/error-tracking.js';
import { ErrorRecoveryManager } from '../errors/error-recovery.js';
import { ErrorFormatters, type ErrorContext } from './error-formatters.js';
import { ErrorLogger } from './error-logger.js';
import { ErrorResponseHandler } from './error-response.js';
import '../../types/express.js';

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
  private errorLogger: ErrorLogger;
  private responseHandler: ErrorResponseHandler;

  constructor(
    logger: Logger,
    config: ErrorHandlerConfig = {},
    errorTracker?: ErrorTracker,
    recoveryManager?: ErrorRecoveryManager,
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
    this.errorLogger = new ErrorLogger(logger, {
      includeStack: this.config.includeStack,
      sanitizeSensitiveData: this.config.sanitizeSensitiveData,
    });
    this.responseHandler = new ErrorResponseHandler({
      includeStack: this.config.includeStack,
      includeTechnicalDetails: this.config.includeTechnicalDetails,
      includeRetryConfig: this.config.includeRetryConfig,
      includeHelpLinks: this.config.includeHelpLinks,
      sanitizeSensitiveData: this.config.sanitizeSensitiveData,
    });
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
      const context = this.createErrorContext(req);
      const enhancedError = this.convertToEnhancedError(err, context);

      await this.trackErrorIfEnabled(enhancedError, context);
      this.errorLogger.logError(enhancedError, req, startTime);
      await this.attemptRecoveryIfEnabled(enhancedError, context);
      this.responseHandler.sendErrorResponse(enhancedError, req, res, startTime);
    };
  }

  /**
   * Create error context from request
   */
  private createErrorContext(req: Request): ErrorContext {
    const requestId = (req.headers['x-request-id'] as string) ?? 'unknown';
    const userId = req.user?.userId;

    return {
      requestId,
      userId,
      endpoint: req.originalUrl,
      method: req.method,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    };
  }

  /**
   * Convert error to enhanced error
   */
  private convertToEnhancedError(
    err: Error | AppError | EnhancedAppError | ZodError,
    context: ErrorContext,
  ): EnhancedAppError {
    if (err instanceof EnhancedAppError) {
      return err;
    } else if (err instanceof ZodError) {
      return ErrorFormatters.createEnhancedErrorFromZod(err, context);
    } else if (err instanceof AppError) {
      return ErrorFormatters.createEnhancedErrorFromApp(err, context);
    } else {
      return ErrorFormatters.createEnhancedErrorFromGeneric(err, context);
    }
  }

  /**
   * Track error if tracking is enabled
   */
  private async trackErrorIfEnabled(
    enhancedError: EnhancedAppError,
    context: ErrorContext,
  ): Promise<void> {
    if (this.config.trackErrors === true && this.errorTracker !== undefined) {
      try {
        await this.errorTracker.trackError(enhancedError, context);
      } catch (trackingError) {
        this.logger.error(
          {
            error: trackingError,
            originalError: enhancedError.message,
            requestId: context.requestId,
          },
          'Failed to track error',
        );
      }
    }
  }

  /**
   * Attempt error recovery if enabled
   */
  private async attemptRecoveryIfEnabled(
    enhancedError: EnhancedAppError,
    context: ErrorContext,
  ): Promise<void> {
    if (this.config.enableRecovery === true && this.recoveryManager !== undefined) {
      try {
        const recoveryResult = await this.recoveryManager.recover(enhancedError, context);
        if (recoveryResult.success === true) {
          this.logger.info(
            {
              requestId: context.requestId,
              recovery: recoveryResult.strategy,
              duration: recoveryResult.duration,
            },
            'Error recovery succeeded',
          );
        }
      } catch (recoveryError) {
        this.logger.error(
          {
            error: recoveryError,
            requestId: context.requestId,
          },
          'Error recovery failed',
        );
      }
    }
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
  recoveryManager?: ErrorRecoveryManager,
): ErrorRequestHandler => {
  const enhancedHandler = new EnhancedErrorHandler(logger, config, errorTracker, recoveryManager);
  return enhancedHandler.getMiddleware();
};
