/**
 * Session validation middleware
 * @module routes/session/validation-middleware
 * @nist ac-3 "Access enforcement"
 * @nist ac-12 "Session termination"
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../core/errors/app-error.js';

/**
 * Middleware to validate user is authenticated
 * @nist ac-3 "Access enforcement"
 */
export function requireAuthentication(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError('Not authenticated', 401));
    return;
  }
  next();
}

/**
 * Middleware to validate admin role
 * @nist ac-3 "Access enforcement"
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError('Not authenticated', 401));
    return;
  }

  if (!req.user.roles.includes('admin')) {
    next(new AppError('Admin access required', 403));
    return;
  }

  next();
}

/**
 * Middleware to validate session ID parameter
 * @nist ac-12 "Session termination"
 */
export function validateSessionIdParam(req: Request, _res: Response, next: NextFunction): void {
  const { sessionId } = req.params;
  
  if (!sessionId?.trim()) {
    next(new AppError('Session ID is required', 400));
    return;
  }

  next();
}

/**
 * Middleware to validate development mode
 * @nist ac-3 "Access enforcement"
 */
export function requireDevelopmentMode(_req: Request, _res: Response, next: NextFunction): void {
  // Using process.env directly to avoid config dependency
  const nodeEnv = process.env.NODE_ENV ?? 'production';
  
  if (nodeEnv === 'production') {
    next(new AppError('Development endpoint disabled in production', 403));
    return;
  }

  next();
}