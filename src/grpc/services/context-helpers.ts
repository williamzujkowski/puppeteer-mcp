/**
 * Helper functions for context service
 * @module grpc/services/context-helpers
 */

import { AppError } from '../../core/errors/app-error.js';

/**
 * Context filter interface
 */
export interface ContextFilter {
  types?: string[];
  statuses?: string[];
}

/**
 * Validate context type
 */
export function validateContextType(type: string): void {
  const validTypes = ['browser', 'api', 'database', 'custom'];
  if (!validTypes.includes(type)) {
    throw new AppError(
      `Invalid context type: ${type}. Must be one of: ${validTypes.join(', ')}`,
      400,
    );
  }
}

/**
 * Check context access permissions
 */
export function checkContextAccess(
  context: { userId: string },
  requestUserId?: string,
  requestUserRoles?: string[],
): void {
  // Admin users can access any context
  if (requestUserRoles?.includes('admin') === true) {
    return;
  }

  // Regular users can only access their own contexts
  if (context.userId !== requestUserId) {
    throw new AppError('Access denied to context', 403);
  }
}

/**
 * Validate required field
 */
export function validateRequiredField(value: unknown, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new AppError(`${fieldName} is required`, 400);
  }
}

/**
 * Apply field updates to context
 */
export function applyFieldUpdates(
  context: Record<string, unknown>,
  updates: {
    config?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
  updateMask?: { paths?: string[] },
): void {
  const allowedFields = updateMask?.paths ?? ['config', 'metadata'];

  if (allowedFields.includes('config') && updates.config) {
    context.config = { ...(context.config as Record<string, unknown>), ...updates.config };
  }

  if (allowedFields.includes('metadata') && updates.metadata) {
    context.metadata = { ...(context.metadata as Record<string, unknown>), ...updates.metadata };
  }

  context.updatedAt = Date.now();
}

/**
 * Check if context should be included based on filter
 */
export function shouldIncludeContext(
  context: { type: string; status: string },
  filter?: ContextFilter,
): boolean {
  if (!filter) {
    return true;
  }

  if (filter.types && filter.types.length > 0) {
    if (!filter.types.includes(context.type)) {
      return false;
    }
  }

  if (filter.statuses && filter.statuses.length > 0) {
    if (!filter.statuses.includes(context.status)) {
      return false;
    }
  }

  return true;
}

/**
 * Convert timestamp to proto format
 */
export function toProtoTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Parse pagination parameters
 */
export function parsePagination(pagination?: { page_token?: string; page_size?: number }): {
  pageSize: number;
  offset: number;
} {
  const pageSize = Math.min(Math.max(pagination?.page_size ?? 20, 1), 100);
  const offset =
    pagination?.page_token !== undefined && pagination.page_token !== ''
      ? parseInt(pagination.page_token, 10) || 0
      : 0;
  return { pageSize, offset };
}

/**
 * Create pagination response
 */
export function createPaginationResponse(
  totalCount: number,
  offset: number,
  pageSize: number,
  returnedCount: number,
): { next_page_token?: string; total_count: number } {
  return {
    next_page_token: offset + returnedCount < totalCount ? String(offset + pageSize) : undefined,
    total_count: totalCount,
  };
}

/**
 * Validate command execution context
 */
export function validateCommandContext(context: { type: string; status: string }): void {
  if (context.type !== 'browser' && context.type !== 'api') {
    throw new AppError(`Context type '${context.type}' does not support command execution`, 400);
  }

  if (context.status !== 'CONTEXT_STATUS_ACTIVE') {
    throw new AppError('Context is not active', 400);
  }
}
