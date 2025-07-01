/**
 * gRPC Session list and batch operations
 * @module grpc/services/session-list
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';
import type { Session } from '../../types/session.js';
import { AppError } from '../../core/errors/app-error.js';
import { SessionUtils } from './session-utils.js';
import type {
  ListSessionsRequest,
  ListSessionsResponse,
} from '../types/session.types.js';

/**
 * Session list and batch operations
 * @nist ac-3 "Access enforcement"
 */
export class SessionList {
  constructor(
    _logger: pino.Logger,
    private sessionStore: SessionStore
  ) {}

  /**
   * List sessions with filtering
   * @nist ac-3 "Access enforcement"
   */
  async listSessions(
    call: grpc.ServerUnaryCall<ListSessionsRequest, ListSessionsResponse>,
    callback: grpc.sendUnaryData<ListSessionsResponse>
  ): Promise<void> {
    try {
      const { user_id, session_ids, active_only, page_size, page_token } = call.request;

      // Check access permission
      const { userId, roles } = SessionUtils.extractUserFromCall(call);
      if (!this.hasListAccess(roles, user_id ?? '', userId)) {
        throw new AppError('Access denied', 403);
      }

      const sessions = await this.getFilteredSessions(user_id ?? '', session_ids, active_only);
      const response = this.buildListResponse(sessions, { page_size, page_token });

      callback(null, response);
    } catch (error) {
      const grpcError = {
        code: grpc.status.INTERNAL,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      callback(grpcError);
    }
  }

  private hasListAccess(roles: string[], requestedUserId: string, currentUserId: string): boolean {
    return roles.includes('admin') || requestedUserId === currentUserId;
  }

  private async getFilteredSessions(userId: string, sessionIds?: string[], activeOnly?: boolean): Promise<Session[]> {
    // TODO: Implement proper list method in SessionStore interface
    // For now, get by userId and filter client-side
    const userSessions = await this.sessionStore.getByUserId(userId);
    const filteredSessions = userSessions.filter(session => {
      if (sessionIds && sessionIds.length > 0 && !sessionIds.includes(session.id)) {
        return false;
      }
      if (activeOnly === true && new Date(session.data.expiresAt).getTime() < Date.now()) {
        return false;
      }
      return true;
    });
    
    return filteredSessions;
  }

  private getOffsetFromToken(pageToken: string | undefined): number {
    return pageToken !== undefined && pageToken !== '' ? parseInt(pageToken, 10) : 0;
  }

  private buildListResponse(sessions: Session[], pagination: Partial<ListSessionsRequest>): ListSessionsResponse {
    const pageSize = pagination?.page_size ?? 20;
    const currentOffset = this.getOffsetFromToken(pagination?.page_token);
    const paginatedSessions = sessions.slice(currentOffset, currentOffset + pageSize);
    const hasMore = currentOffset + pageSize < sessions.length;
    
    return {
      sessions: paginatedSessions.map(s => SessionUtils.mapSessionToProto(s)),
      next_page_token: hasMore ? String(currentOffset + pageSize) : undefined,
      total_count: sessions.length
    };
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
          const { userId, roles } = SessionUtils.extractUserFromCall(call);
          if (userId === session.data.userId || roles.includes('admin')) {
            sessions.push(SessionUtils.mapSessionToProto(session));
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
        total_count: sessions.length
      });
    } catch (error) {
      const grpcError = {
        code: grpc.status.INTERNAL,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      callback(grpcError);
    }
  }
}