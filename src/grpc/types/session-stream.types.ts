/**
 * gRPC Session streaming type definitions
 * @module grpc/types/session-stream
 */

// Stream request types
export interface StreamSessionEventsRequest {
  user_id?: string;
  session_ids?: string[];
  event_types?: string[];
}

export interface ValidateSessionRequest {
  session_id?: string;
  access_token?: string;
}

// Stream response types
export interface SessionEvent {
  id: string;
  type: string;
  session_id: string;
  user_id: string;
  timestamp: string;
  data: Record<string, unknown>;
  session?: {
    id: string;
    user_id: string;
    username: string;
    roles: string[];
    data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    expires_at: string;
    last_accessed_at: string;
  };
}

export interface ValidateSessionResponse {
  valid: boolean;
  session?: {
    id: string;
    user_id: string;
    username: string;
    roles: string[];
    data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    expires_at: string;
    last_accessed_at: string;
  };
  error?: {
    code: string;
    message: string;
  };
}
