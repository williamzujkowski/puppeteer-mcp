/**
 * Session deletion handlers
 * @module routes/session/deletion-handlers
 * @nist ac-12 "Session termination"
 * @nist au-2 "Audit events"
 */

import type { Request, Response } from 'express';
import { SessionStore } from '../../store/session-store.interface.js';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { formatSuccessResponse } from './response-formatter.js';

/**
 * Handler factory for session deletion
 * @nist ac-12 "Session termination"
 */
export class SessionDeletionHandlerFactory {
  constructor(private readonly sessionStore: SessionStore) {}

  /**
   * Terminate specific session handler
   * @nist ac-12 "Session termination"
   */
  terminateSessionHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const { sessionId } = req.params;
      
      // Validation middleware ensures sessionId is defined
      if (!sessionId) {
        throw new AppError('Session ID is required', 400);
      }
      
      // Get session to verify ownership
      const session = await this.sessionStore.get(sessionId);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      // Check if user owns this session or is admin
      const isOwner = session.data.userId === req.user.userId;
      const isAdmin = req.user.roles.includes('admin');
      
      if (!isOwner && !isAdmin) {
        throw new AppError('Cannot terminate session for another user', 403);
      }

      // Delete session
      const deleted = await this.sessionStore.delete(sessionId);

      if (!deleted) {
        throw new AppError('Failed to delete session', 500);
      }

      // Log session termination
      await logSecurityEvent(SecurityEventType.LOGOUT, {
        userId: req.user.userId,
        result: 'success',
        metadata: {
          terminatedSessionId: sessionId,
          terminatedByUser: req.user.userId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      res.json(formatSuccessResponse(undefined, 'Session terminated successfully'));
    };
  }

  /**
   * Terminate all user sessions handler
   * @nist ac-12 "Session termination"
   */
  terminateAllSessionsHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      // Get all user sessions
      const sessions = await this.sessionStore.getByUserId(req.user.userId);

      let deletedCount = 0;

      // Delete all sessions except current
      for (const session of sessions) {
        if (session.id !== req.user.sessionId) {
          const deleted = await this.sessionStore.delete(session.id);
          if (deleted) {
            deletedCount++;
          }
        }
      }

      // Log mass session termination
      await logSecurityEvent(SecurityEventType.LOGOUT, {
        userId: req.user.userId,
        result: 'success',
        metadata: {
          action: 'terminate_all',
          deletedCount,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      res.json(formatSuccessResponse(
        { deletedCount },
        `Terminated ${deletedCount} sessions`
      ));
    };
  }

  /**
   * Admin terminate any session handler
   * @nist ac-12 "Session termination"
   * @nist ac-3 "Access enforcement"
   */
  adminTerminateSessionHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      const { sessionId } = req.params;
      
      // Validation middleware ensures sessionId is defined
      if (!sessionId) {
        throw new AppError('Session ID is required', 400);
      }

      // Get session info before deletion
      const session = await this.sessionStore.get(sessionId);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      // Delete session
      const deleted = await this.sessionStore.delete(sessionId);

      if (!deleted) {
        throw new AppError('Failed to delete session', 500);
      }

      // Log admin session termination
      await logSecurityEvent(SecurityEventType.LOGOUT, {
        userId: session.data.userId,
        result: 'success',
        metadata: {
          terminatedSessionId: sessionId,
          terminatedByAdmin: req.user?.userId ?? 'unknown',
          action: 'admin_terminate',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      res.json(formatSuccessResponse(
        {
          terminatedUserId: session.data.userId,
          terminatedUsername: session.data.username,
        },
        'Session terminated successfully'
      ));
    };
  }
}