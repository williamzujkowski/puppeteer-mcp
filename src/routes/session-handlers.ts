/**
 * Session route handlers
 * @module routes/session-handlers
 * @nist ac-12 "Session termination"
 * @nist au-2 "Audit events"
 * 
 * This file maintains backward compatibility by re-exporting handlers
 * from the modularized session components.
 */

import type { Request, Response, NextFunction } from 'express';
import type { SessionStore } from '../store/session-store.interface.js';
import {
  SessionCreationHandlerFactory,
  SessionRetrievalHandlerFactory,
  SessionUpdateHandlerFactory,
  SessionDeletionHandlerFactory,
  asyncHandler,
} from './session/index.js';

/**
 * Refresh access token handler
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 */
export function handleRefreshToken(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): void {
  const factory = new SessionUpdateHandlerFactory(sessionStore);
  asyncHandler(factory.refreshTokenHandler())(req, res, next);
}

/**
 * Revoke refresh token handler
 * @nist ac-12 "Session termination"
 */
export function handleRevokeToken(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): void {
  const factory = new SessionUpdateHandlerFactory(sessionStore);
  asyncHandler(factory.revokeTokenHandler())(req, res, next);
}

/**
 * Get current session info handler
 * @nist au-2 "Audit events"
 */
export function handleGetCurrentSession(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): void {
  const factory = new SessionRetrievalHandlerFactory(sessionStore);
  asyncHandler(factory.getCurrentSessionHandler())(req, res, next);
}

/**
 * Get user sessions handler
 * @nist au-2 "Audit events"
 */
export function handleGetUserSessions(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): void {
  const factory = new SessionRetrievalHandlerFactory(sessionStore);
  asyncHandler(factory.getUserSessionsHandler())(req, res, next);
}

/**
 * Terminate specific session handler
 * @nist ac-12 "Session termination"
 */
export function handleTerminateSession(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): void {
  const factory = new SessionDeletionHandlerFactory(sessionStore);
  asyncHandler(factory.terminateSessionHandler())(req, res, next);
}

/**
 * Terminate all user sessions handler
 * @nist ac-12 "Session termination"
 */
export function handleTerminateAllSessions(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): void {
  const factory = new SessionDeletionHandlerFactory(sessionStore);
  asyncHandler(factory.terminateAllSessionsHandler())(req, res, next);
}

/**
 * Admin list all sessions handler
 * @nist au-2 "Audit events"
 * @nist ac-3 "Access enforcement"
 */
export function handleListAllSessions(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): void {
  const factory = new SessionRetrievalHandlerFactory(sessionStore);
  asyncHandler(factory.getAllSessionsHandler())(req, res, next);
}

/**
 * Admin terminate any session handler
 * @nist ac-12 "Session termination"
 * @nist ac-3 "Access enforcement"
 */
export function handleAdminTerminateSession(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): void {
  const factory = new SessionDeletionHandlerFactory(sessionStore);
  asyncHandler(factory.adminTerminateSessionHandler())(req, res, next);
}

/**
 * Development-only session creation handler
 * WARNING: This endpoint bypasses authentication and should NEVER be enabled in production
 */
export function handleDevCreateSession(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): void {
  const factory = new SessionCreationHandlerFactory(sessionStore);
  asyncHandler(factory.createDevSessionHandler())(req, res, next);
}

// Re-export all session module components for convenience
export * from './session/index.js';