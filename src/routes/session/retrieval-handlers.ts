/**
 * Session retrieval handlers
 * @module routes/session/retrieval-handlers
 * @nist au-2 "Audit events"
 * @nist ac-3 "Access enforcement"
 */

import type { Request, Response } from 'express';
import { SessionStore } from '../../store/session-store.interface.js';
import { AppError } from '../../core/errors/app-error.js';
import {
  formatSessionResponse,
  formatSessionListItem,
  formatSuccessResponse,
} from './response-formatter.js';

/**
 * Handler factory for session retrieval
 * @nist au-2 "Audit events"
 */
export class SessionRetrievalHandlerFactory {
  constructor(private readonly sessionStore: SessionStore) {}

  /**
   * Get current session info handler
   * @nist au-2 "Audit events"
   */
  getCurrentSessionHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const session = await this.sessionStore.get(req.user.sessionId);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      res.json(formatSuccessResponse(formatSessionResponse(session)));
    };
  }

  /**
   * Get user sessions handler
   * @nist au-2 "Audit events"
   */
  getUserSessionsHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const sessions = await this.sessionStore.getByUserId(req.user.userId);

      const formattedSessions = sessions.map((session) =>
        formatSessionListItem(session, req.user?.sessionId),
      );

      res.json(formatSuccessResponse(formattedSessions));
    };
  }

  /**
   * Admin list all sessions handler
   * @nist au-2 "Audit events"
   * @nist ac-3 "Access enforcement"
   */
  getAllSessionsHandler() {
    return async (_req: Request, _res: Response): Promise<void> => {
      // This would require modification to SessionStore interface
      // For now, return not implemented
      throw new AppError('List all sessions not implemented', 501);
    };
  }
}
