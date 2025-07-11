/**
 * Session type definitions
 * @module ws/websocket/session/types
 * @nist ac-3 "Access enforcement"
 */

/**
 * Session information
 */
export interface SessionInfo {
  sessionId: string;
  userId: string;
  connectionIds: Set<string>;
  createdAt: Date;
  lastActivity: Date;
  roles?: string[];
  permissions?: string[];
  scopes?: string[];
  metadata?: Record<string, unknown>;
  state: SessionState;
}

/**
 * Session states following State pattern
 */
export enum SessionState {
  CREATING = 'creating',
  ACTIVE = 'active',
  IDLE = 'idle',
  EXPIRING = 'expiring',
  TERMINATED = 'terminated',
}

/**
 * Session statistics
 */
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalUsers: number;
  averageConnectionsPerSession: number;
  sessionsPerUser: Array<{ userId: string; sessionCount: number }>;
  sessionsByState: Record<SessionState, number>;
}

/**
 * Session event types
 */
export type SessionEvent =
  | { type: 'created'; session: SessionInfo }
  | { type: 'updated'; session: SessionInfo; changes: Partial<SessionInfo> }
  | { type: 'terminated'; session: SessionInfo; reason: string }
  | { type: 'state-changed'; sessionId: string; from: SessionState; to: SessionState }
  | { type: 'connection-added'; sessionId: string; connectionId: string }
  | { type: 'connection-removed'; sessionId: string; connectionId: string }
  | { type: 'cleanup-completed'; count: number }
  | { type: 'limit-exceeded'; userId: string; limit: number };

/**
 * Session persistence data
 */
export interface SessionPersistenceData {
  sessionId: string;
  userId: string;
  connectionIds: string[];
  createdAt: string;
  lastActivity: string;
  roles?: string[];
  permissions?: string[];
  scopes?: string[];
  metadata?: Record<string, unknown>;
  state: SessionState;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  valid: boolean;
  reason?: string;
  sessionInfo?: SessionInfo;
}

/**
 * Session creation options
 */
export interface SessionCreationOptions {
  roles?: string[];
  permissions?: string[];
  scopes?: string[];
  metadata?: Record<string, unknown>;
  initialState?: SessionState;
}

/**
 * Session creation request
 */
export interface SessionCreationRequest {
  sessionId: string;
  userId: string;
  connectionId: string;
  options?: SessionCreationOptions;
}
