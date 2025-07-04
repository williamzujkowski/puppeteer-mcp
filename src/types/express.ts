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

// Module augmentation for Express types
export interface CustomRequestProperties {
  user?: {
    userId: string;
    username: string;
    roles: string[];
    sessionId: string;
  };
  context?: RequestContext;
}

// Extend the Express Request type
declare module 'express' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Request extends CustomRequestProperties {}
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