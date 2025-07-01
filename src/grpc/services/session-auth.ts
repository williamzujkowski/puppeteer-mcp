/**
 * gRPC Session authentication operations
 * @module grpc/services/session-auth
 * @nist ia-2 "Identification and authentication"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';
import type { Session } from '../../types/session.js';
import { generateTokens, verifyRefreshToken, verifyAccessToken } from '../../auth/jwt.js';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { SessionUtils } from './session-utils.js';
import type {
  RefreshSessionRequest,
  RefreshSessionResponse,
  ValidateSessionRequest,
  ValidateSessionResponse,
} from '../types/session.types.js';

/**
 * Session authentication operations
 * @nist ia-2 "Identification and authentication"
 */
export class SessionAuth {
  constructor(
    private logger: pino.Logger,
    private sessionStore: SessionStore,
  ) {}

  /**
   * Refresh session token
   * @nist ia-2 "Identification and authentication"
   * @nist au-3 "Content of audit records"
   */
  async refreshSession(
    call: grpc.ServerUnaryCall<RefreshSessionRequest, RefreshSessionResponse>,
    callback: grpc.sendUnaryData<RefreshSessionResponse>,
  ): Promise<void> {
    try {
      const { refresh_token } = call.request;

      if (!refresh_token) {
        throw new AppError('Refresh token is required', 400);
      }

      // Verify refresh token
      const payload = await verifyRefreshToken(refresh_token);

      if (
        payload?.sessionId === undefined ||
        payload.sessionId === null ||
        payload.sessionId === ''
      ) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Get session
      const session = await this.sessionStore.get(payload.sessionId);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      // Check if session is still valid
      if (new Date(session.data.expiresAt).getTime() < Date.now()) {
        throw new AppError('Session expired', 401);
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(
        session.data.userId,
        session.data.username,
        session.data.roles,
        session.id,
      );

      // Update session last accessed time
      await this.sessionStore.touch(session.id);

      // Log token refresh
      await logSecurityEvent(SecurityEventType.TOKEN_REFRESHED, {
        resource: `session:${session.id}`,
        userId: session.data.userId,
        result: 'success',
        metadata: {
          username: session.data.username,
        },
      });

      callback(null, {
        session: SessionUtils.mapSessionToProto(session),
        access_token: accessToken,
        refresh_token: newRefreshToken,
      });
    } catch (error) {
      const grpcError = {
        code: grpc.status.INTERNAL,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      callback(grpcError);
    }
  }

  /**
   * Validate session
   * @nist ia-2 "Identification and authentication"
   */
  async validateSession(
    call: grpc.ServerUnaryCall<ValidateSessionRequest, ValidateSessionResponse>,
    callback: grpc.sendUnaryData<ValidateSessionResponse>,
  ): Promise<void> {
    try {
      const { session_id, access_token } = call.request;

      if (this.isEmptyOrNull(session_id) && this.isEmptyOrNull(access_token)) {
        throw new AppError('Session ID or access token is required', 400);
      }

      const session = await this.getSessionFromIdOrToken(session_id, access_token);

      if (session === null) {
        this.sendSessionNotFound(callback);
        return;
      }

      if (this.isSessionExpired(session)) {
        this.sendSessionExpired(callback, session);
        return;
      }

      // Session is valid
      callback(null, {
        valid: true,
        session: SessionUtils.mapSessionToProto(session),
      });
    } catch (error) {
      const grpcError = {
        code: grpc.status.INTERNAL,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      callback(grpcError);
    }
  }

  private isEmptyOrNull(value: string | null | undefined): boolean {
    return value === null || value === undefined || value === '';
  }

  private async getSessionFromIdOrToken(
    sessionId: string | null | undefined,
    accessToken: string | null | undefined,
  ): Promise<Session | null> {
    if (sessionId !== null && sessionId.length > 0) {
      return this.sessionStore.get(sessionId);
    }

    if (accessToken !== null && accessToken.length > 0) {
      const payload = await verifyAccessToken(accessToken);
      if (payload?.sessionId !== null && payload.sessionId.length > 0) {
        return this.sessionStore.get(payload.sessionId);
      }
    }

    return null;
  }

  private sendSessionNotFound(callback: grpc.sendUnaryData<ValidateSessionResponse>): void {
    callback(null, {
      valid: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      },
    });
  }

  private isSessionExpired(session: Session): boolean {
    return new Date(session.data.expiresAt).getTime() < Date.now();
  }

  private sendSessionExpired(
    callback: grpc.sendUnaryData<ValidateSessionResponse>,
    session: Session,
  ): void {
    callback(null, {
      valid: false,
      session: SessionUtils.mapSessionToProto(session),
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Session has expired',
      },
    });
  }
}
