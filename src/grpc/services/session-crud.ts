/**
 * gRPC Session basic CRUD operations
 * @module grpc/services/session-crud
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import type { SessionStore } from '../../store/session-store.interface.js';
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
    private sessionStore: SessionStore
  ) {}

  /**
   * Create a new session
   * @nist ac-2 "Account management"
   * @nist au-3 "Content of audit records"
   * @evidence code, test
   */
  async createSession(
    call: grpc.ServerUnaryCall<CreateSessionRequest, CreateSessionResponse>,
    callback: grpc.sendUnaryData<CreateSessionResponse>
  ): Promise<void> {
    try {
      const { user_id, username, roles, data, ttl_seconds } = call.request;

      // Validate required fields
      if (!user_id || !username) {
        throw new AppError('User ID and username are required', 400);
      }

      // Create session
      const sessionId = uuidv4();
      const expiresAt = Date.now() + (ttl_seconds ?? 3600) * 1000; // Default 1 hour

      const session = await this.sessionStore.create({
        id: sessionId,
        userId: user_id,
        username,
        roles: roles ?? [],
        data: data ?? {},
        expiresAt,
      });

      // Generate tokens
      const { accessToken, refreshToken } = await generateTokens({
        sessionId: session.id,
        userId: session.userId,
        username: session.username,
        roles: session.roles,
      });

      // Log session creation
      await logSecurityEvent(SecurityEventType.SESSION_CREATED, {
        sessionId: session.id,
        userId: session.userId,
        username: session.username,
        result: 'success',
        metadata: {
          roles: session.roles,
          expiresAt: new Date(session.expiresAt).toISOString(),
        },
      });

      // Return response
      callback(null, {
        session: SessionUtils.mapSessionToProto(session),
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch (error) {
      this.logger.error('Error creating session:', error);
      const grpcError = {
        code: grpc.status.INTERNAL,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      callback(grpcError);
    }
  }

  /**
   * Get session details
   * @nist ac-3 "Access enforcement"
   */
  async getSession(
    call: grpc.ServerUnaryCall<GetSessionRequest, GetSessionResponse>,
    callback: grpc.sendUnaryData<GetSessionResponse>
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
      if (userId !== session.userId && !userRoles.includes('admin')) {
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
    callback: grpc.sendUnaryData<UpdateSessionResponse>
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
      if (userId !== session.userId && !userRoles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      // Apply updates
      const updates = SessionUtils.buildSessionUpdates(session, data, extend_ttl, ttl_seconds);
      const updatedSession = await this.sessionStore.update(session_id, updates);

      // Log session update
      await logSecurityEvent(SecurityEventType.SESSION_UPDATED, {
        sessionId: session_id,
        userId: session.userId,
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
    callback: grpc.sendUnaryData<DeleteSessionResponse>
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
      if (userId !== session.userId && !userRoles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      await this.sessionStore.delete(session_id);

      // Log session deletion
      await logSecurityEvent(SecurityEventType.SESSION_DELETED, {
        sessionId: session_id,
        userId: session.userId,
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