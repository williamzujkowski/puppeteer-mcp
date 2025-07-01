/**
 * Sessions API routes
 * @module routes/sessions
 * @nist ac-12 "Session termination"
 * @nist au-2 "Audit events"
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SessionStore } from '../store/session-store.interface.js';
import { createAuthMiddleware, requireRoles } from '../auth/middleware.js';
import { refreshAccessToken, revokeRefreshToken } from '../auth/refresh.js';
import { AppError } from '../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';

/**
 * Create session routes
 * @nist ac-12 "Session termination"
 */
export const createSessionRoutes = (sessionStore: SessionStore): Router => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(sessionStore);

  /**
   * Refresh access token
   * POST /v1/sessions/refresh
   * @nist ia-2 "Identification and authentication"
   * @nist ia-5 "Authenticator management"
   */
  router.post('/refresh', (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      // Validate request body
      const refreshSchema = z.object({
        refreshToken: z.string(),
        accessToken: z.string().optional(),
      });

      const body = refreshSchema.parse(req.body);

      // Refresh token
      const newTokens = await refreshAccessToken(body, sessionStore, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        data: newTokens,
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Revoke refresh token (logout)
   * POST /v1/sessions/revoke
   * @nist ac-12 "Session termination"
   */
  router.post('/revoke', (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      // Validate request body
      const revokeSchema = z.object({
        refreshToken: z.string(),
      });

      const body = revokeSchema.parse(req.body);

      // Revoke token
      await revokeRefreshToken(body.refreshToken, sessionStore, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: 'Token revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Get current session info
   * GET /v1/sessions/current
   * @nist au-2 "Audit events"
   */
  router.get('/current', authMiddleware, (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const session = await sessionStore.get(req.user.sessionId);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      res.json({
        success: true,
        data: {
          id: session.id,
          userId: session.data.userId,
          username: session.data.username,
          roles: session.data.roles,
          createdAt: session.data.createdAt,
          expiresAt: session.data.expiresAt,
          lastAccessedAt: session.lastAccessedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Get all sessions for current user
   * GET /v1/sessions/my-sessions
   * @nist au-2 "Audit events"
   */
  router.get('/my-sessions', authMiddleware, (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const sessions = await sessionStore.getByUserId(req.user.id);

      res.json({
        success: true,
        data: sessions.map((session) => ({
          id: session.id,
          createdAt: session.data.createdAt,
          expiresAt: session.data.expiresAt,
          lastAccessedAt: session.lastAccessedAt,
          isCurrent: session.id === req.user?.sessionId,
        })),
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Terminate a specific session
   * DELETE /v1/sessions/:sessionId
   * @nist ac-12 "Session termination"
   */
  router.delete('/:sessionId', authMiddleware, (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { sessionId } = req.params;

      // Get session to verify ownership
      const session = await sessionStore.get(sessionId);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      // Check if user owns this session or is admin
      if (session.data.userId !== req.user.id && !req.user.roles.includes('admin')) {
        throw new AppError('Cannot terminate session for another user', 403);
      }

      // Delete session
      const deleted = await sessionStore.delete(sessionId);

      if (!deleted) {
        throw new AppError('Failed to delete session', 500);
      }

      // Log session termination
      await logSecurityEvent(SecurityEventType.LOGOUT, {
        userId: req.user.id,
        result: 'success',
        metadata: {
          terminatedSessionId: sessionId,
          terminatedByUser: req.user.id,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      res.json({
        success: true,
        message: 'Session terminated successfully',
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Terminate all sessions for current user (except current)
   * DELETE /v1/sessions/all
   * @nist ac-12 "Session termination"
   */
  router.delete('/all', authMiddleware, (req: Request, res: Response, next: NextFunction) => void (async () => {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      // Get all user sessions
      const sessions = await sessionStore.getByUserId(req.user.id);

      let deletedCount = 0;

      // Delete all sessions except current
      for (const session of sessions) {
        if (session.id !== req.user.sessionId) {
          const deleted = await sessionStore.delete(session.id);
          if (deleted) {
            deletedCount++;
          }
        }
      }

      // Log mass session termination
      await logSecurityEvent(SecurityEventType.LOGOUT, {
        userId: req.user.id,
        result: 'success',
        metadata: {
          action: 'terminate_all',
          deletedCount,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      res.json({
        success: true,
        message: `Terminated ${deletedCount} sessions`,
        data: {
          deletedCount,
        },
      });
    } catch (error) {
      next(error);
    }
  })());

  /**
   * Admin: Get all active sessions
   * GET /v1/sessions
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  router.get('/', authMiddleware, requireRoles('admin'), (req: Request, res: Response, next: NextFunction) => {
    try {
      // This would require modification to SessionStore interface
      // For now, return not implemented
      throw new AppError('List all sessions not implemented', 501);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Admin: Terminate any session
   * DELETE /v1/sessions/admin/:sessionId
   * @nist ac-12 "Session termination"
   * @nist ac-3 "Access enforcement"
   */
  router.delete(
    '/admin/:sessionId',
    authMiddleware,
    requireRoles('admin'),
    (req: Request, res: Response, next: NextFunction) => void (async () => {
      try {
        const { sessionId } = req.params;

        // Get session info before deletion
        const session = await sessionStore.get(sessionId);

        if (!session) {
          throw new AppError('Session not found', 404);
        }

        // Delete session
        const deleted = await sessionStore.delete(sessionId);

        if (!deleted) {
          throw new AppError('Failed to delete session', 500);
        }

        // Log admin session termination
        await logSecurityEvent(SecurityEventType.LOGOUT, {
          userId: session.data.userId,
          result: 'success',
          metadata: {
            terminatedSessionId: sessionId,
            terminatedByAdmin: req.user?.id ?? 'unknown',
            action: 'admin_terminate',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });

        res.json({
          success: true,
          message: 'Session terminated successfully',
          data: {
            terminatedUserId: session.data.userId,
            terminatedUsername: session.data.username,
          },
        });
      } catch (error) {
        next(error);
      }
    })(),
  );

  return router;
};