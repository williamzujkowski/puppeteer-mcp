/**
 * gRPC Session utility functions
 * @module grpc/services/session-utils
 * @nist ac-3 "Access enforcement"
 */

import * as grpc from '@grpc/grpc-js';
import type { Session, SessionData } from '../../store/session-store.interface.js';
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
      user_id: session.data.userId,
      username: session.data.username,
      roles: session.data.roles,
      data: session.data.metadata ?? {},
      created_at: session.data.createdAt,
      updated_at: session.lastAccessedAt,
      expires_at: session.data.expiresAt,
      last_accessed_at: session.lastAccessedAt,
    };
  }
  
  /**
   * Extract user info from gRPC call metadata
   */
  static extractUserFromCall<TRequest, TResponse>(call: grpc.ServerUnaryCall<TRequest, TResponse>): { userId: string; roles: string[] } {
    const metadata = call.metadata;
    const userIdValue = metadata.get('user-id')?.[0];
    const userId = typeof userIdValue === 'string' ? userIdValue : '';
    const rolesValue = metadata.get('user-roles')?.[0];
    const rolesStr = typeof rolesValue === 'string' ? rolesValue : '';
    const roles = rolesStr !== '' ? rolesStr.split(',') : [];
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
  ): Partial<SessionData> {
    const updates: Partial<SessionData> = {};
    
    if (data) {
      updates.metadata = { ...session.data.metadata, ...data };
    }
    
    if (extendTtl === true && ttlSeconds !== null && ttlSeconds !== undefined && ttlSeconds !== 0) {
      const newExpiresAt = new Date(Date.now() + ttlSeconds * 1000);
      updates.expiresAt = newExpiresAt.toISOString();
    }
    
    return updates;
  }
}