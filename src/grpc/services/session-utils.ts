/**
 * gRPC Session utility functions
 * @module grpc/services/session-utils
 * @nist ac-3 "Access enforcement"
 */

import * as grpc from '@grpc/grpc-js';
import type { Session } from '../../store/session-store.interface.js';
import type { SessionProto } from '../types/session.types.js';

/**
 * Session utility functions
 */
export class SessionUtils {
  /**
   * Map internal session to proto format
   */
  static mapSessionToProto(session: Session): SessionProto {
    return {
      id: session.id,
      user_id: session.userId,
      username: session.username,
      roles: session.roles,
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
  static extractUserFromCall<TRequest, TResponse>(call: grpc.ServerUnaryCall<TRequest, TResponse>): { userId: string; roles: string[] } {
    const metadata = call.metadata;
    const userId = metadata.get('user-id')?.[0] ?? '';
    const rolesStr = metadata.get('user-roles')?.[0] ?? '';
    const roles = (rolesStr !== null && rolesStr !== undefined && rolesStr !== '') ? rolesStr.split(',') : [];
    return { userId, roles };
  }
  
  /**
   * Build session updates object
   */
  static buildSessionUpdates(
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