/**
 * Shared types for error factories
 * @module core/errors/factories/types
 */

/**
 * Request context for error creation
 */
export interface RequestContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}
