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
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { contextId } = req.params;
  if (!contextId || contextId === '') {
    throw new AppError('Context ID is required', 400);
  }
}

/**
 * Build page options from request and context
 */
export function buildPageOptions(
  requestBody: any,
  contextConfig: any
): {
  viewport?: { width: number; height: number };
  userAgent?: string;
  extraHeaders?: Record<string, string>;
  javaScriptEnabled?: boolean;
  bypassCSP?: boolean;
  ignoreHTTPSErrors?: boolean;
} {
  return {
    viewport: requestBody.viewport ?? contextConfig.viewport,
    userAgent: requestBody.userAgent ?? contextConfig.userAgent,
    extraHeaders: requestBody.extraHeaders ?? contextConfig.extraHTTPHeaders,
    javaScriptEnabled: requestBody.javaScriptEnabled ?? contextConfig.javaScriptEnabled,
    bypassCSP: requestBody.bypassCSP ?? contextConfig.bypassCSP,
    ignoreHTTPSErrors: requestBody.ignoreHTTPSErrors ?? contextConfig.ignoreHTTPSErrors,
  };
}

/**
 * Get user session ID
 */
export function getUserSessionId(user: { sessionId?: string; userId: string }): string {
  return user.sessionId ?? user.userId;
}