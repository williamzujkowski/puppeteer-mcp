/**
 * Helper functions for context page handlers
 * @module routes/context-page-helpers
 */

import type { Request } from 'express';
import { AppError } from '../core/errors/app-error.js';

/**
 * Validate request for page creation
 */
export function validatePageRequest(req: Request): void {
  if (req.user === null || req.user === undefined) {
    throw new AppError('Not authenticated', 401);
  }

  const { contextId } = req.params;
  if (contextId === null || contextId === undefined || contextId === '') {
    throw new AppError('Context ID is required', 400);
  }
}

/**
 * Build page options from request and context
 */
export function buildPageOptions(
  requestBody: Record<string, unknown>,
  contextConfig: Record<string, unknown>
): {
  viewport?: { width: number; height: number };
  userAgent?: string;
  extraHeaders?: Record<string, string>;
  javaScriptEnabled?: boolean;
  bypassCSP?: boolean;
  ignoreHTTPSErrors?: boolean;
} {
  return {
    viewport: (requestBody.viewport ?? contextConfig.viewport) as { width: number; height: number } | undefined,
    userAgent: (requestBody.userAgent ?? contextConfig.userAgent) as string | undefined,
    extraHeaders: (requestBody.extraHeaders ?? contextConfig.extraHTTPHeaders) as Record<string, string> | undefined,
    javaScriptEnabled: (requestBody.javaScriptEnabled ?? contextConfig.javaScriptEnabled) as boolean | undefined,
    bypassCSP: (requestBody.bypassCSP ?? contextConfig.bypassCSP) as boolean | undefined,
    ignoreHTTPSErrors: (requestBody.ignoreHTTPSErrors ?? contextConfig.ignoreHTTPSErrors) as boolean | undefined,
  };
}

/**
 * Get user session ID
 */
export function getUserSessionId(user: { sessionId?: string; userId: string }): string {
  return user.sessionId ?? user.userId;
}