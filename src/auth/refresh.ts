/**
 * Token refresh mechanism
 * @module auth/refresh
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 */

import { AppError } from '../core/errors/app-error.js';
import { verifyToken, generateTokenPair, isTokenExpiringSoon } from './jwt.js';
import { SessionStore } from '../store/session-store.interface.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { config } from '../core/config.js';

/**
 * Refresh token request interface
 */
export interface RefreshTokenRequest {
  refreshToken: string;
  accessToken?: string; // Optional, for early refresh
}

/**
 * Refresh token response interface
 */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Validate early refresh attempt
 */
const validateEarlyRefresh = async (
  accessToken: string | undefined,
  refreshPayload: { sub: string; sessionId: string },
  metadata?: { ip?: string; userAgent?: string },
): Promise<void> => {
  if (accessToken === undefined || accessToken === '') {
    return;
  }

  const accessTokenExpiringSoon = isTokenExpiringSoon(
    accessToken,
    Math.floor(config.SESSION_RENEWAL_THRESHOLD / 1000),
  );

  if (!accessTokenExpiringSoon) {
    await logSecurityEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, {
      userId: refreshPayload.sub,
      reason: 'Token refresh attempted too early',
      result: 'failure',
      metadata: {
        ...metadata,
        sessionId: refreshPayload.sessionId,
      },
    });

    throw new AppError('Token refresh not allowed yet', 400);
  }
};

/**
 * Refresh access token using refresh token
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 */
export const refreshAccessToken = async (
  request: RefreshTokenRequest,
  sessionStore: SessionStore,
  metadata?: { ip?: string; userAgent?: string },
): Promise<RefreshTokenResponse> => {
  try {
    // Verify refresh token
    const refreshPayload = await verifyToken(request.refreshToken, 'refresh');

    // Verify session exists and is valid
    const session = await sessionStore.get(refreshPayload.sessionId);
    if (!session) {
      throw new AppError('Session not found', 401);
    }

    // Check if user is trying to refresh too early (potential abuse)
    await validateEarlyRefresh(request.accessToken, refreshPayload, metadata);

    // Generate new token pair
    const newTokens = generateTokenPair(
      refreshPayload.sub,
      refreshPayload.username,
      refreshPayload.roles,
      refreshPayload.sessionId,
    );

    // Update session last accessed time
    await sessionStore.touch(refreshPayload.sessionId);

    // Log successful token refresh
    await logSecurityEvent(SecurityEventType.TOKEN_REFRESH, {
      userId: refreshPayload.sub,
      result: 'success',
      metadata: {
        ...metadata,
        sessionId: refreshPayload.sessionId,
      },
    });

    return newTokens;
  } catch (error) {
    // Log failed refresh attempt
    await logSecurityEvent(SecurityEventType.TOKEN_REFRESH, {
      result: 'failure',
      reason: error instanceof Error ? error.message : 'Unknown error',
      metadata,
    });

    throw error;
  }
};

/**
 * Revoke refresh token
 * @nist ia-5 "Authenticator management"
 */
export const revokeRefreshToken = async (
  refreshToken: string,
  sessionStore: SessionStore,
  metadata?: { ip?: string; userAgent?: string },
): Promise<void> => {
  try {
    // Verify refresh token
    const payload = await verifyToken(refreshToken, 'refresh');

    // Delete the session
    const deleted = await sessionStore.delete(payload.sessionId);

    if (!deleted) {
      throw new AppError('Session not found', 404);
    }

    // Log token revocation
    await logSecurityEvent(SecurityEventType.TOKEN_REVOKE, {
      userId: payload.sub,
      result: 'success',
      metadata: {
        ...metadata,
        sessionId: payload.sessionId,
      },
    });
  } catch (error) {
    // Log failed revocation attempt
    await logSecurityEvent(SecurityEventType.TOKEN_REVOKE, {
      result: 'failure',
      reason: error instanceof Error ? error.message : 'Unknown error',
      metadata,
    });

    throw error;
  }
};

/**
 * Check if refresh token is valid
 */
export const isRefreshTokenValid = async (
  refreshToken: string,
  sessionStore: SessionStore,
): Promise<boolean> => {
  try {
    const payload = await verifyToken(refreshToken, 'refresh');
    const session = await sessionStore.get(payload.sessionId);
    return session !== null;
  } catch {
    return false;
  }
};

/**
 * Rotate refresh token (issue new refresh token when used)
 * This provides additional security by invalidating old refresh tokens
 * @nist ia-5 "Authenticator management"
 */
export const rotateRefreshToken = async (
  oldRefreshToken: string,
  sessionStore: SessionStore,
  metadata?: { ip?: string; userAgent?: string },
): Promise<RefreshTokenResponse> => {
  try {
    // Verify old refresh token
    const payload = await verifyToken(oldRefreshToken, 'refresh');

    // Verify session
    const session = await sessionStore.get(payload.sessionId);
    if (!session) {
      throw new AppError('Session not found', 401);
    }

    // Create new session (invalidating the old one)
    await sessionStore.delete(payload.sessionId);
    const newSessionId = await sessionStore.create(session.data);

    // Generate new token pair with new session ID
    const newTokens = generateTokenPair(payload.sub, payload.username, payload.roles, newSessionId);

    // Log token rotation
    await logSecurityEvent(SecurityEventType.TOKEN_REFRESH, {
      userId: payload.sub,
      result: 'success',
      metadata: {
        ...metadata,
        oldSessionId: payload.sessionId,
        newSessionId,
        action: 'rotation',
      },
    });

    return newTokens;
  } catch (error) {
    await logSecurityEvent(SecurityEventType.TOKEN_REFRESH, {
      result: 'failure',
      reason: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        ...metadata,
        action: 'rotation',
      },
    });

    throw error;
  }
};
