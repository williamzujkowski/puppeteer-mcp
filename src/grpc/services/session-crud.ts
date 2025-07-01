/**
 * gRPC Session basic CRUD operations
 * @module grpc/services/session-crud
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import type { SessionStore, Session, SessionData } from '../../store/session-store.interface.js';
import { generateTokens } from '../../auth/jwt.js';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { SessionUtils } from './session-utils.js';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionRequest,
  GetSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  DeleteSessionRequest,
  DeleteSessionResponse,
} from '../types/session.types.js';

/**
 * Session basic CRUD operations
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 */
export class SessionCrud {
  constructor(
    private logger: pino.Logger,
    private sessionStore: SessionStore,
  ) {}

  /**
   * Create a new session
   * @nist ac-2 "Account management"
   * @nist au-3 "Content of audit records"
   * @evidence code, test
   */
  async createSession(
    call: grpc.ServerUnaryCall<CreateSessionRequest, CreateSessionResponse>,
    callback: grpc.sendUnaryData<CreateSessionResponse>,
  ): Promise<void> {
    try {
      const { user_id, username, roles, data, ttl_seconds } = call.request;

      this.validateCreateSessionRequest(user_id, username);

      const sessionData = this.buildSessionData({ user_id, username, roles, data, ttl_seconds });
      const sessionId = await this.sessionStore.create(sessionData);
      const tokens = this.generateSessionTokens(user_id, username, roles ?? [], sessionId);

      const session = await this.getCreatedSession(sessionId);
      await this.logSessionCreation({ sessionId, user_id, username, roles: roles ?? [] });

      callback(null, {
        session: SessionUtils.mapSessionToProto(session),
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
    } catch (error) {
      this.handleCreateSessionError(error, callback);
    }
  }

  private validateCreateSessionRequest(user_id: string, username: string): void {
    if (!user_id || !username) {
      throw new AppError('User ID and username are required', 400);
    }
  }

  private buildSessionData(options: {
    user_id: string;
    username: string;
    roles?: string[];
    data?: Record<string, unknown>;
    ttl_seconds?: number;
  }): SessionData {
    const expiresAt = Date.now() + (options.ttl_seconds ?? 3600) * 1000; // Default 1 hour

    return {
      userId: options.user_id,
      username: options.username,
      roles: options.roles ?? [],
      metadata: options.data ?? {},
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  private generateSessionTokens(
    user_id: string,
    username: string,
    roles: string[],
    sessionId: string,
  ): { accessToken: string; refreshToken: string; expiresIn: number } {
    return generateTokens(user_id, username, roles, sessionId);
  }

  private async getCreatedSession(sessionId: string): Promise<Session> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      throw new AppError('Failed to create session', 500);
    }
    return session;
  }

  private async logSessionCreation(options: {
    sessionId: string;
    user_id: string;
    username: string;
    roles: string[];
  }): Promise<void> {
    await logSecurityEvent(SecurityEventType.SESSION_CREATED, {
      resource: `session:${options.sessionId}`,
      userId: options.user_id,
      result: 'success',
      metadata: {
        username: options.username,
        roles: options.roles,
        expiresAt: new Date().toISOString(),
      },
    });
  }

  private handleCreateSessionError(
    error: unknown,
    callback: grpc.sendUnaryData<CreateSessionResponse>,
  ): void {
    this.logger.error('Error creating session:', error);
    const grpcError = {
      code: grpc.status.INTERNAL,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    callback(grpcError);
  }

  /**
   * Get session details
   * @nist ac-3 "Access enforcement"
   */
  async getSession(
    call: grpc.ServerUnaryCall<GetSessionRequest, GetSessionResponse>,
    callback: grpc.sendUnaryData<GetSessionResponse>,
  ): Promise<void> {
    try {
      const { session_id } = call.request;

      if (session_id === null || session_id === undefined || session_id === '') {
        throw new AppError('Session ID is required', 400);
      }

      const session = await this.sessionStore.get(session_id);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      // Check access permission
      const { userId, roles: userRoles } = SessionUtils.extractUserFromCall(call);
      if (userId !== session.data.userId && !userRoles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      callback(null, {
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

  /**
   * Update session data
   * @nist ac-2 "Account management"
   * @nist au-3 "Content of audit records"
   */
  async updateSession(
    call: grpc.ServerUnaryCall<UpdateSessionRequest, UpdateSessionResponse>,
    callback: grpc.sendUnaryData<UpdateSessionResponse>,
  ): Promise<void> {
    try {
      const { session_id, data, extend_ttl, ttl_seconds } = call.request;

      if (session_id === null || session_id === undefined || session_id === '') {
        throw new AppError('Session ID is required', 400);
      }

      const session = await this.sessionStore.get(session_id);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      // Check access permission
      const { userId, roles: userRoles } = SessionUtils.extractUserFromCall(call);
      if (userId !== session.data.userId && !userRoles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      // Apply updates
      const updates = SessionUtils.buildSessionUpdates(session, data, extend_ttl, ttl_seconds);
      const updatedSession = await this.sessionStore.update(session_id, updates);

      if (!updatedSession) {
        throw new AppError('Failed to update session', 500);
      }

      // Log session update
      await logSecurityEvent(SecurityEventType.SESSION_UPDATED, {
        resource: `session:${session_id}`,
        userId: session.data.userId,
        result: 'success',
        metadata: {
          updatedFields: Object.keys(updates),
        },
      });

      callback(null, {
        session: SessionUtils.mapSessionToProto(updatedSession),
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
   * Delete a session
   * @nist ac-2 "Account management"
   * @nist au-3 "Content of audit records"
   */
  async deleteSession(
    call: grpc.ServerUnaryCall<DeleteSessionRequest, DeleteSessionResponse>,
    callback: grpc.sendUnaryData<DeleteSessionResponse>,
  ): Promise<void> {
    try {
      const { session_id } = call.request;

      if (session_id === null || session_id === undefined || session_id === '') {
        throw new AppError('Session ID is required', 400);
      }

      const session = await this.sessionStore.get(session_id);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      // Check access permission
      const { userId, roles: userRoles } = SessionUtils.extractUserFromCall(call);
      if (userId !== session.data.userId && !userRoles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      await this.sessionStore.delete(session_id);

      // Log session deletion
      await logSecurityEvent(SecurityEventType.SESSION_DELETED, {
        resource: `session:${session_id}`,
        userId: session.data.userId,
        result: 'success',
      });

      callback(null, { success: true });
    } catch (error) {
      const grpcError = {
        code: grpc.status.INTERNAL,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      callback(grpcError);
    }
  }
}
