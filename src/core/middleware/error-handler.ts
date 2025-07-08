/**
 * Error handling middleware
 * @module core/middleware/error-handler
 * @nist si-11 "Error handling"
 */

import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

/**
 * Handle Zod validation errors
 */
const handleZodError = (err: ZodError, res: Response): void => {
  res.status(400).json({
    error: 'Validation Error',
    message: 'Invalid request data',
    details: err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    })),
  });
};

/**
 * Handle custom application errors
 */
const handleAppError = (err: AppError, res: Response): void => {
  res.status(err.statusCode).json({
    error: err.name,
    message: err.message,
    ...(err.details !== undefined && { details: err.details }),
  });
};

/**
 * Handle unexpected errors
 */
const handleUnexpectedError = (err: Error, res: Response): void => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'An unexpected error occurred',
    ...(isDevelopment && { stack: err.stack }),
  });
};

/**
 * Create error handler middleware
 * @param logger - Pino logger instance
 * @returns Express error handler middleware
 */
export const errorHandler = (logger: Logger): ErrorRequestHandler => {
  return (
    err: Error | AppError | ZodError,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void => {
    // Log error with context
    logger.error(
      {
        err,
        req: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          query: req.query,
          ip: req.ip,
        },
      },
      'Request error',
    );

    // Handle different error types
    if (err instanceof ZodError) {
      handleZodError(err, res);
    } else if (err instanceof AppError) {
      handleAppError(err, res);
    } else {
      handleUnexpectedError(err, res);
    }
  };
};
