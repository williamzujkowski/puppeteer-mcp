/**
 * Session update handlers (token refresh/revoke)
 * @module routes/session/update-handlers
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 */

import type { Request, Response } from 'express';
import { SessionStore } from '../../store/session-store.interface.js';
import { refreshAccessToken, revokeRefreshToken } from '../../auth/refresh.js';
import { refreshTokenSchema, revokeTokenSchema } from './schemas.js';
import { formatSuccessResponse } from './response-formatter.js';

/**
 * Handler factory for session updates
 * @nist ia-5 "Authenticator management"
 */
export class SessionUpdateHandlerFactory {
  constructor(private readonly sessionStore: SessionStore) {}

  /**
   * Refresh access token handler
   * @nist ia-2 "Identification and authentication"
   * @nist ia-5 "Authenticator management"
   */
  refreshTokenHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      // Validate request body
      const body = refreshTokenSchema.parse(req.body);

      // Refresh token
      const newTokens = await refreshAccessToken(body, this.sessionStore, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(formatSuccessResponse(newTokens));
    };
  }

  /**
   * Revoke refresh token handler
   * @nist ac-12 "Session termination"
   */
  revokeTokenHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      // Validate request body
      const body = revokeTokenSchema.parse(req.body);

      // Revoke token
      await revokeRefreshToken(body.refreshToken, this.sessionStore, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(formatSuccessResponse(undefined, 'Token revoked successfully'));
    };
  }
}
