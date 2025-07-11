/**
 * Sessions API routes
 * @module routes/sessions
 * @nist ac-12 "Session termination"
 * @nist au-2 "Audit events"
 */

import { Router } from 'express';
import { SessionStore } from '../store/session-store.interface.js';
import { createAuthMiddleware, requireRoles } from '../auth/middleware.js';
import {
  handleRefreshToken,
  handleRevokeToken,
  handleGetCurrentSession,
  handleGetUserSessions,
  handleTerminateSession,
  handleTerminateAllSessions,
  handleListAllSessions,
  handleAdminTerminateSession,
  handleDevCreateSession,
} from './session-handlers.js';

/**
 * Create session routes
 * @nist ac-12 "Session termination"
 */
export const createSessionRoutes = (sessionStore: SessionStore): Router => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(sessionStore);

  /**
   * Development-only: Create session
   * POST /v1/sessions/dev-create
   * WARNING: This endpoint bypasses authentication and should NEVER be enabled in production
   */
  router.post('/dev-create', (req, res, next) => {
    void handleDevCreateSession(req, res, next, sessionStore);
  });

  /**
   * Refresh access token
   * POST /v1/sessions/refresh
   */
  router.post('/refresh', (req, res, next) => {
    void handleRefreshToken(req, res, next, sessionStore);
  });

  /**
   * Revoke refresh token (logout)
   * POST /v1/sessions/revoke
   */
  router.post('/revoke', (req, res, next) => {
    void handleRevokeToken(req, res, next, sessionStore);
  });

  /**
   * Get current session info
   * GET /v1/sessions/current
   */
  router.get('/current', authMiddleware, (req, res, next) => {
    void handleGetCurrentSession(req, res, next, sessionStore);
  });

  /**
   * Get all sessions for current user
   * GET /v1/sessions/my-sessions
   */
  router.get('/my-sessions', authMiddleware, (req, res, next) => {
    void handleGetUserSessions(req, res, next, sessionStore);
  });

  /**
   * Terminate a specific session
   * DELETE /v1/sessions/:sessionId
   */
  router.delete('/:sessionId', authMiddleware, (req, res, next) => {
    void handleTerminateSession(req, res, next, sessionStore);
  });

  /**
   * Terminate all sessions for current user (except current)
   * DELETE /v1/sessions/all
   */
  router.delete('/all', authMiddleware, (req, res, next) => {
    void handleTerminateAllSessions(req, res, next, sessionStore);
  });

  /**
   * Admin: Get all active sessions
   * GET /v1/sessions
   */
  router.get('/', authMiddleware, requireRoles('admin'), (req, res, next) => {
    void handleListAllSessions(req, res, next, sessionStore);
  });

  /**
   * Admin: Terminate any session
   * DELETE /v1/sessions/admin/:sessionId
   */
  router.delete('/admin/:sessionId', authMiddleware, requireRoles('admin'), (req, res, next) => {
    void handleAdminTerminateSession(req, res, next, sessionStore);
  });

  return router;
};
