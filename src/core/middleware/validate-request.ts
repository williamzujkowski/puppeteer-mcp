/**
 * Request validation middleware
 * @module core/middleware/validate-request
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { AppError } from '../errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';

/**
 * Request validation middleware factory
 * @nist si-10 "Information input validation"
 * @evidence code, test
 */
export function validateRequest<T extends ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request against schema
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Log validation failure
        await logSecurityEvent(SecurityEventType.VALIDATION_FAILURE, {
          resource: req.path,
          action: req.method,
          result: 'failure',
          reason: 'Input validation failed',
          metadata: {
            errors: error.errors,
            ip: req.ip,
            userAgent: req.get('user-agent'),
          },
        });

        // Return structured validation error
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
        });
      } else {
        // Pass unexpected errors to error handler
        next(new AppError('Validation error', 500));
      }
    }
  };
}

/**
 * Create request validator for specific fields
 * @nist si-10 "Information input validation"
 */
export function createValidator<T extends ZodSchema>(schema: T) {
  return {
    body: validateRequest(z.object({ body: schema })),
    query: validateRequest(z.object({ query: schema })),
    params: validateRequest(z.object({ params: schema })),
    all: validateRequest(schema),
  };
}