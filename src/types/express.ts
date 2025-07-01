/**
 * Express type augmentations
 * @module types/express
 */

import { Request } from 'express';

/**
 * Request context for audit logging
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        roles: string[];
        sessionId: string;
      };
      context?: RequestContext;
    }
  }
}

/**
 * Authenticated request type with user information
 */
export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    username: string;
    roles: string[];
    sessionId: string;
  };
}