/**
 * gRPC Session service type definitions
 * @module grpc/types/session
 */

import type { Session } from '../../store/session-store.interface.js';

// Request types
export interface CreateSessionRequest {
  user_id: string;
  username: string;
  roles?: string[];
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ttl_seconds?: number;
}

export interface GetSessionRequest {
  session_id: string;
}

export interface UpdateSessionRequest {
  session_id: string;
  data?: Record<string, unknown>;
  extend_ttl?: boolean;
  ttl_seconds?: number;
}

export interface DeleteSessionRequest {
  session_id: string;
}

export interface RefreshSessionRequest {
  refresh_token: string;
}

export interface ListSessionsRequest {
  user_id?: string;
  active_only?: boolean;
  page_size?: number;
  page_token?: string;
}

// Response types
export interface SessionProto {
  id: string;
  user_id: string;
  username: string;
  roles: string[];
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  expires_at: string;
  last_accessed_at: string;
}

export interface CreateSessionResponse {
  session: SessionProto;
  access_token: string;
  refresh_token: string;
}

export interface GetSessionResponse {
  session: SessionProto;
}

export interface UpdateSessionResponse {
  session: SessionProto;
}

export interface DeleteSessionResponse {
  success: boolean;
}

export interface RefreshSessionResponse {
  access_token: string;
  refresh_token: string;
  session: SessionProto;
}

export interface ListSessionsResponse {
  sessions: SessionProto[];
  next_page_token?: string;
  total_count: number;
}

// Helper type for mapping Session to SessionProto
export type SessionMapper = (session: Session) => SessionProto;