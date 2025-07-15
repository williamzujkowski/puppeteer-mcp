/**
 * Session creation handlers
 * @module routes/session/creation-handlers
 * @nist ac-2 "Account management"
 * @nist ia-2 "Identification and authentication"
 */

import type { Request, Response } from 'express';
import crypto from 'crypto';
import { SessionStore } from '../../store/session-store.interface.js';
import { generateTokenPair } from '../../auth/jwt.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { createSessionSchema } from './schemas.js';
import { formatSuccessResponse } from './response-formatter.js';
import { config } from '../../core/config.js';
import { AppError } from '../../core/errors/app-error.js';

/**
 * Handler factory for session creation
 * @nist ac-2 "Account management"
 */
export class SessionCreationHandlerFactory {
  constructor(private readonly sessionStore: SessionStore) {}

  /**
   * Create development session handler
   * WARNING: This endpoint bypasses authentication and should NEVER be enabled in production
   * @nist ac-2 "Account management"
   * @nist au-2 "Audit events"
   */
  createDevSessionHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      // Double-check we're in development mode
      if (config.NODE_ENV === 'production') {
        throw new AppError('Development endpoint disabled in production', 403);
      }

      // Parse and validate request
      const { userId, username, roles } = createSessionSchema.parse(req.body);
      const finalUserId = userId ?? crypto.randomUUID();

      // Create session data
      const sessionData = {
        userId: finalUserId,
        username,
        roles,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      };

      // Create session in store
      const sessionId = await this.sessionStore.create(sessionData);

      // Generate token pair
      const tokens = generateTokenPair(finalUserId, username, roles, sessionId);

      // Log session creation
      await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
        userId: finalUserId,
        result: 'success',
        metadata: {
          method: 'dev-session-creation',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      res.json(
        formatSuccessResponse({
          sessionId,
          userId: finalUserId,
          username,
          roles,
          token: tokens.accessToken, // Add token field for WebSocket authentication
          ...tokens,
        }),
      );
    };
  }
}
