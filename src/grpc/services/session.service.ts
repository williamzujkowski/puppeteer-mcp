/**
 * gRPC Session service implementation
 * @module grpc/services/session
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import type { SessionStore, Session } from '../../store/session-store.interface.js';
import { generateTokens, verifyRefreshToken } from '../../auth/jwt.js';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionRequest,
  GetSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  DeleteSessionRequest,
  DeleteSessionResponse,
  RefreshSessionRequest,
  RefreshSessionResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  SessionProto,
} from '../types/session.types.js';
import type {
  StreamSessionEventsRequest,
  SessionEvent,
  ValidateSessionRequest,
  ValidateSessionResponse,
} from '../types/session-stream.types.js';

/**
 * Session service implementation
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 */
export class SessionServiceImpl {
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
        session: this.mapSessionToProto(session),
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
      const { userId, roles: userRoles } = this.extractUserFromCall(call);
      if (userId !== session.userId && !userRoles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      callback(null, {
        session: this.mapSessionToProto(session),
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
      const { userId, roles: userRoles } = this.extractUserFromCall(call);
      if (userId !== session.userId && !userRoles.includes('admin')) {
        throw new AppError('Access denied', 403);
      }

      // Apply updates
      const updates = this.buildSessionUpdates(session, data, extend_ttl, ttl_seconds);
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
        session: this.mapSessionToProto(updatedSession),
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
      const { userId, roles: userRoles } = this.extractUserFromCall(call);
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

  /**
   * List sessions with filtering
   * @nist ac-3 "Access enforcement"
   */
  async listSessions(
    call: grpc.ServerUnaryCall<ListSessionsRequest, ListSessionsResponse>,
    callback: grpc.sendUnaryData<ListSessionsResponse>
  ): Promise<void> {
    try {
      const { user_id, session_ids, filter, pagination } = call.request;

      // Check access permission
      const { userId, roles } = this.extractUserFromCall(call);
      if (!roles.includes('admin') && user_id !== userId) {
        throw new AppError('Access denied', 403);
      }

      const sessions = await this.sessionStore.list({
        userId: user_id,
        sessionIds: session_ids,
        ...filter,
        limit: pagination?.page_size ?? 20,
        offset: pagination?.page_token !== undefined && pagination.page_token !== '' ? parseInt(pagination.page_token, 10) : 0,
      });

      callback(null, {
        sessions: sessions.map(s => this.mapSessionToProto(s)),
        pagination: {
          next_page_token: sessions.length === (pagination?.page_size ?? 20) 
            ? String((pagination?.page_token !== undefined && pagination.page_token !== '' ? parseInt(pagination.page_token, 10) : 0) + sessions.length)
            : undefined,
        },
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
   * Batch get sessions
   * @nist ac-3 "Access enforcement"
   */
  async batchGetSessions(
    call: grpc.ServerUnaryCall<ListSessionsRequest, ListSessionsResponse>,
    callback: grpc.sendUnaryData<ListSessionsResponse>
  ): Promise<void> {
    try {
      const { session_ids } = call.request;

      if (session_ids === undefined || session_ids === null || session_ids.length === 0) {
        throw new AppError('Session IDs are required', 400);
      }

      const sessions = [];
      const notFound = [];

      for (const sessionId of session_ids) {
        const session = await this.sessionStore.get(sessionId);
        
        if (session) {
          // Check access permission
          const { userId, roles } = this.extractUserFromCall(call);
          if (userId === session.userId || roles.includes('admin')) {
            sessions.push(this.mapSessionToProto(session));
          } else {
            notFound.push(sessionId);
          }
        } else {
          notFound.push(sessionId);
        }
      }

      callback(null, {
        sessions,
        not_found: notFound,
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
   * Stream session events
   * @nist au-3 "Content of audit records"
   */
  streamSessionEvents(
    call: grpc.ServerWritableStream<StreamSessionEventsRequest, SessionEvent>
  ): void {
    try {
      const { user_id, session_ids, event_types } = call.request;

      // Check access permission
      const metadata = call.metadata;
      const userId = metadata.get('user-id')?.[0] ?? '';
      const rolesStr = metadata.get('user-roles')?.[0] ?? '';
      const roles = rolesStr !== '' ? rolesStr.split(',') : [];
      
      if (roles.includes('admin') !== true && user_id !== userId) {
        call.emit('error', new AppError('Access denied', 403));
        return;
      }

      // Set up event listener
      const eventHandler = (event: SessionEvent) => {
        // Filter events
        if (user_id !== undefined && user_id !== '' && event.user_id !== user_id) {
          return;
        }
        if (session_ids !== undefined && session_ids.length > 0 && !session_ids.includes(event.session_id)) {
          return;
        }
        if (event_types !== undefined && event_types.length > 0 && !event_types.includes(event.type)) {
          return;
        }

        // Send event to client
        call.write({
          id: uuidv4(),
          type: event.type,
          session_id: event.sessionId,
          user_id: event.userId,
          timestamp: new Date().toISOString(),
          data: event.data ?? {},
          session: event.session ? this.mapSessionToProto(event.session) : undefined,
        });
      };

      // Subscribe to events
      this.sessionStore.on('sessionEvent', eventHandler);

      // Clean up on stream end
      call.on('cancelled', () => {
        this.sessionStore.off('sessionEvent', eventHandler);
      });

      call.on('error', () => {
        this.sessionStore.off('sessionEvent', eventHandler);
      });
    } catch (error) {
      this.logger.error('Error in streamSessionEvents:', error);
      call.emit('error', error);
    }
  }

  /**
   * Refresh session token
   * @nist ia-2 "Identification and authentication"
   * @nist au-3 "Content of audit records"
   */
  async refreshSession(
    call: grpc.ServerUnaryCall<RefreshSessionRequest, RefreshSessionResponse>,
    callback: grpc.sendUnaryData<RefreshSessionResponse>
  ): Promise<void> {
    try {
      const { refresh_token } = call.request;

      if (!refresh_token) {
        throw new AppError('Refresh token is required', 400);
      }

      // Verify refresh token
      const payload = await verifyRefreshToken(refresh_token);
      
      if (!payload?.sessionId) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Get session
      const session = await this.sessionStore.get(payload.sessionId);
      
      if (!session) {
        throw new AppError('Session not found', 404);
      }

      // Check if session is still valid
      if (session.expiresAt < Date.now()) {
        throw new AppError('Session expired', 401);
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = await generateTokens({
        sessionId: session.id,
        userId: session.userId,
        username: session.username,
        roles: session.roles,
      });

      // Update session last accessed time
      await this.sessionStore.touch(session.id);

      // Log token refresh
      await logSecurityEvent(SecurityEventType.TOKEN_REFRESHED, {
        sessionId: session.id,
        userId: session.userId,
        result: 'success',
      });

      callback(null, {
        session: this.mapSessionToProto(session),
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
    callback: grpc.sendUnaryData<ValidateSessionResponse>
  ): Promise<void> {
    try {
      const { session_id, access_token } = call.request;

      if ((session_id === null || session_id === undefined || session_id === '') && (access_token === null || access_token === undefined || access_token === '')) {
        throw new AppError('Session ID or access token is required', 400);
      }

      let session;

      if (session_id !== null && session_id !== undefined && session_id !== '') {
        session = await this.sessionStore.get(session_id);
      } else if (access_token !== null && access_token !== undefined && access_token !== '') {
        // Verify token and get session
        const payload = await verifyAccessToken(access_token);
        if (payload?.sessionId) {
          session = await this.sessionStore.get(payload.sessionId);
        }
      }

      if (!session) {
        callback(null, {
          valid: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
          },
        });
        return;
      }

      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        callback(null, {
          valid: false,
          session: this.mapSessionToProto(session),
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session has expired',
          },
        });
        return;
      }

      // Session is valid
      callback(null, {
        valid: true,
        session: this.mapSessionToProto(session),
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
   * Map internal session to proto format
   */
  private mapSessionToProto(session: Session): SessionProto {
    return {
      id: session.id,
      user_id: session.userId,
      username: session.username,
      roles: session.roles,
      data: session.data,
      data: session.data ?? {},
      created_at: new Date(session.createdAt).toISOString(),
      updated_at: new Date(session.updatedAt).toISOString(),
      expires_at: new Date(session.expiresAt).toISOString(),
      last_accessed_at: new Date(session.lastAccessedAt).toISOString(),
    };
  }
  
  /**
   * Extract user info from gRPC call metadata
   */
  private extractUserFromCall<TRequest, TResponse>(call: grpc.ServerUnaryCall<TRequest, TResponse>): { userId: string; roles: string[] } {
    const metadata = call.metadata;
    const userId = metadata.get('user-id')?.[0] ?? '';
    const rolesStr = metadata.get('user-roles')?.[0] ?? '';
    const roles = (rolesStr !== null && rolesStr !== undefined && rolesStr !== '') ? rolesStr.split(',') : [];
    return { userId, roles };
  }
  
  /**
   * Build session updates object
   */
  private buildSessionUpdates(
    session: Session,
    data?: Record<string, unknown>,
    extendTtl?: boolean,
    ttlSeconds?: number
  ): Partial<Session> {
    const updates: Partial<Session> = {};
    
    if (data) {
      updates.data = { ...session.data, ...data };
    }
    
    if (extendTtl === true && ttlSeconds !== null && ttlSeconds !== undefined && ttlSeconds !== 0) {
      updates.expiresAt = Date.now() + ttlSeconds * 1000;
    }
    
    return updates;
  }
}

// Import verifyAccessToken function

async function verifyAccessToken(token: string): Promise<{ sub: string; sessionId: string }> {
  const { verifyAccessToken: verify } = await import('../../auth/jwt.js');
  return verify(token);
}