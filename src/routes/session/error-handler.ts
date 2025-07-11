/**
 * Session error handling utilities
 * @module routes/session/error-handler
 * @nist au-2 "Audit events"
 * @nist au-10 "Non-repudiation"
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';

/**
 * Session error types for logging
 */
export enum SessionErrorType {
  VALIDATION_ERROR = 'SESSION_VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'SESSION_AUTH_ERROR',
  AUTHORIZATION_ERROR = 'SESSION_AUTHZ_ERROR',
  NOT_FOUND = 'SESSION_NOT_FOUND',
  INTERNAL_ERROR = 'SESSION_INTERNAL_ERROR',
}

/**
 * Map error to session error type
 */
function getErrorType(error: unknown): SessionErrorType {
  if (error instanceof ZodError) {
    return SessionErrorType.VALIDATION_ERROR;
  }

  if (error instanceof AppError) {
    switch (error.statusCode) {
      case 401:
        return SessionErrorType.AUTHENTICATION_ERROR;
      case 403:
        return SessionErrorType.AUTHORIZATION_ERROR;
      case 404:
        return SessionErrorType.NOT_FOUND;
      default:
        return SessionErrorType.INTERNAL_ERROR;
    }
  }

  return SessionErrorType.INTERNAL_ERROR;
}

/**
 * Create session error handler with context
 * @nist au-2 "Audit events"
 */
export function createSessionErrorHandler(operation: string) {
  return async (
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const errorType = getErrorType(error);
    const userId = req.user?.userId ?? 'anonymous';

    // Log security event for errors
    await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
      userId,
      result: 'failure',
      metadata: {
        operation,
        errorType,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      },
    });

    // Format error response
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          details: error.errors,
        },
      });
      return;
    }

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
        },
      });
      return;
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  };
}

/**
 * Wrap async handler with error catching
 */
export function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: T, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
