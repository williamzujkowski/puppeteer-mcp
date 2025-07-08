/**
 * CSRF utility functions
 * @module core/middleware/csrf-utils
 * @nist si-10 "Information input validation"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import csrf from 'csrf';
import type { Request, Response } from 'express';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';

/**
 * Session interface for CSRF handling
 */
export interface SessionWithCSRF {
  csrfSecret?: string;
}

/**
 * CSRF Options interface
 */
export interface CSRFOptions {
  secretLength?: number;
  saltLength?: number;
  ignoreMethods?: string[];
  value?: (req: Request) => string | undefined;
}

// Create CSRF instance
export const csrfTokens = new csrf({
  secretLength: 128, // 128-bit secret
  saltLength: 64, // 64-bit salt
});

/**
 * Check if request should skip CSRF protection
 */
export const shouldSkipCSRF = (req: Request): boolean => {
  return req.path === '/health' || req.path === '/ready' || req.path.startsWith('/health/');
};

/**
 * Initialize CSRF secret in session
 */
export const initializeCSRFSecret = (req: Request): void => {
  const session = req.session as unknown as SessionWithCSRF | undefined;

  if (session?.csrfSecret === undefined) {
    if (req.session === undefined) {
      (req as unknown as { session: SessionWithCSRF }).session = {};
    }
    (req.session as unknown as SessionWithCSRF).csrfSecret = csrfTokens.secretSync();
  }
};

/**
 * Extract CSRF token from request
 */
export const extractCSRFToken = (req: Request, options: CSRFOptions): string | undefined => {
  // Try header first (recommended)
  let token = req.headers['x-csrf-token'] as string | undefined;

  // Try body if not in header
  if (token === undefined && req.body !== undefined && typeof req.body === 'object') {
    token = req.body._csrf ?? req.body.csrfToken;
  }

  // Try query parameter as fallback
  token ??= (req.query._csrf as string) ?? (req.query.csrfToken as string);

  // Apply custom value function if provided
  token ??= options.value?.(req);

  return token;
};

/**
 * Log CSRF security event
 */
export const logCSRFSecurityEvent = (
  eventType: SecurityEventType,
  req: Request,
  additionalData?: Record<string, unknown>,
): void => {
  void logSecurityEvent(eventType, {
    resource: req.path,
    action: req.method,
    result: 'failure',
    metadata: {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      ...additionalData,
    },
  });
};

/**
 * Send CSRF error response
 */
export const sendCSRFError = (res: Response, code: string, message: string): void => {
  res.status(403).json({
    success: false,
    error: {
      code,
      message,
    },
  });
};

/**
 * Handle CSRF token verification error
 */
export const handleCSRFVerificationError = (req: Request, res: Response, error: unknown): void => {
  logCSRFSecurityEvent(SecurityEventType.CSRF_TOKEN_INVALID, req, {
    error: error instanceof Error ? error.message : 'Unknown error',
  });

  sendCSRFError(res, 'CSRF_TOKEN_ERROR', 'CSRF token verification failed');
};
