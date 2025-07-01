/**
 * Helper functions for Context service to reduce complexity
 * @module grpc/services/context-helpers
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import { AppError } from '../../core/errors/app-error.js';
import type { Context } from './context.service.js';

/**
 * Validate context type
 */
export function validateContextType(type: string): void {
  const validTypes = [
    'CONTEXT_TYPE_BROWSER',
    'CONTEXT_TYPE_SHELL',
    'CONTEXT_TYPE_DOCKER',
    'CONTEXT_TYPE_KUBERNETES'
  ];
  
  if (!validTypes.includes(type)) {
    throw new AppError('Invalid context type', 400);
  }
}

/**
 * Check if user has access to context
 */
export function checkContextAccess(
  context: Context,
  userId?: string,
  roles?: string[]
): void {
  if (context.userId !== userId && roles?.includes('admin') !== true) {
    throw new AppError('Access denied', 403);
  }
}

/**
 * Validate required fields
 */
export function validateRequiredField(
  value: unknown,
  fieldName: string
): void {
  if (value === null || value === undefined || value === '') {
    throw new AppError(`${fieldName} is required`, 400);
  }
}

/**
 * Apply field updates based on update mask
 */
export function applyFieldUpdates(
  target: Record<string, unknown>,
  updates: Record<string, unknown> | undefined,
  fieldName: string,
  updateMask?: { paths: string[] }
): void {
  if (!updates) {
    return;
  }

  const shouldUpdate = !updateMask?.paths || 
                      updateMask.paths.length === 0 || 
                      updateMask.paths.includes(fieldName);

  if (shouldUpdate) {
    Object.assign(target, updates);
  }
}

/**
 * Filter context based on criteria
 */
export interface ContextFilter {
  types?: string[];
  statuses?: string[];
  created_after?: { seconds: number };
  created_before?: { seconds: number };
}

export function shouldIncludeContext(
  context: Context,
  filter?: ContextFilter
): boolean {
  if (!filter) {
    return true;
  }

  return checkTypeFilter(context, filter) &&
         checkStatusFilter(context, filter) &&
         checkCreatedAfterFilter(context, filter) &&
         checkCreatedBeforeFilter(context, filter);
}

/**
 * Check if context matches type filter
 */
function checkTypeFilter(context: Context, filter: ContextFilter): boolean {
  if (filter.types && filter.types.length > 0 && !filter.types.includes(context.type)) {
    return false;
  }
  return true;
}

/**
 * Check if context matches status filter
 */
function checkStatusFilter(context: Context, filter: ContextFilter): boolean {
  if (filter.statuses && filter.statuses.length > 0 && !filter.statuses.includes(context.status)) {
    return false;
  }
  return true;
}

/**
 * Check if context was created after filter date
 */
function checkCreatedAfterFilter(context: Context, filter: ContextFilter): boolean {
  if (filter.created_after && context.createdAt < filter.created_after.seconds * 1000) {
    return false;
  }
  return true;
}

/**
 * Check if context was created before filter date
 */
function checkCreatedBeforeFilter(context: Context, filter: ContextFilter): boolean {
  if (filter.created_before && context.createdAt > filter.created_before.seconds * 1000) {
    return false;
  }
  return true;
}

/**
 * Validate command execution context
 */
export function validateCommandContext(context: Context): void {
  const commandEnabledTypes = ['CONTEXT_TYPE_SHELL', 'CONTEXT_TYPE_DOCKER'];
  
  if (!commandEnabledTypes.includes(context.type)) {
    throw new AppError(
      'Context type does not support command execution',
      400
    );
  }
}

/**
 * Convert timestamp to proto format
 */
export function toProtoTimestamp(timestamp: number): { seconds: number; nanos: number } {
  return {
    seconds: Math.floor(timestamp / 1000),
    nanos: (timestamp % 1000) * 1000000,
  };
}

/**
 * Parse pagination parameters
 */
export interface PaginationParams {
  pageSize: number;
  offset: number;
}

export function parsePagination(pagination?: {
  page_size?: number;
  page_token?: string;
}): PaginationParams {
  const pageSize = pagination?.page_size ?? 20;
  const offset = (pagination?.page_token ?? '') !== '' ? parseInt(pagination?.page_token ?? '0') : 0;
  
  return { pageSize, offset };
}

/**
 * Create pagination response
 */
export interface PaginationResponse {
  next_page_token?: string;
  total_size: number;
}

export function createPaginationResponse(
  totalSize: number,
  currentPage: number,
  pageSize: number,
  itemsReturned: number
): PaginationResponse {
  return {
    next_page_token: itemsReturned === pageSize 
      ? String(currentPage + pageSize)
      : undefined,
    total_size: totalSize,
  };
}