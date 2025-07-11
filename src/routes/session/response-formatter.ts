/**
 * Session response formatting utilities
 * @module routes/session/response-formatter
 * @nist au-2 "Audit events"
 */

import type { Session } from '../../store/session-store.interface.js';

/**
 * Format session data for API response
 * @nist au-2 "Audit events"
 */
export function formatSessionResponse(session: Session, currentSessionId?: string) {
  return {
    id: session.id,
    userId: session.data.userId,
    username: session.data.username,
    roles: session.data.roles,
    createdAt: session.data.createdAt,
    expiresAt: session.data.expiresAt,
    lastAccessedAt: session.lastAccessedAt,
    isCurrent: session.id === currentSessionId,
  };
}

/**
 * Format minimal session data for listing
 * @nist au-2 "Audit events"
 */
export function formatSessionListItem(session: Session, currentSessionId?: string) {
  return {
    id: session.id,
    createdAt: session.data.createdAt,
    expiresAt: session.data.expiresAt,
    lastAccessedAt: session.lastAccessedAt,
    isCurrent: session.id === currentSessionId,
  };
}

/**
 * Format successful response
 */
export function formatSuccessResponse<T = unknown>(data?: T, message?: string) {
  return {
    success: true,
    ...(message && { message }),
    ...(data !== undefined && { data }),
  };
}

/**
 * Format error response
 */
export function formatErrorResponse(message: string, code?: string) {
  return {
    success: false,
    error: {
      message,
      ...(code && { code }),
    },
  };
}
