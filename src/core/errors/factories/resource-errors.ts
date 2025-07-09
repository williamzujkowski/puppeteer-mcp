/**
 * Resource error factories
 * @module core/errors/factories/resource-errors
 * @nist si-11 "Error handling"
 */

import { ResourceDomainError } from '../domain-errors.js';
import type { RequestContext } from './types.js';

/**
 * Resource error factory methods
 */
export const resourceErrors = {
  memoryExhausted: (
    currentUsage: number,
    maxLimit: number,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): ResourceDomainError =>
    new ResourceDomainError(
      'Memory limit exceeded',
      'RESOURCE_MEMORY_EXHAUSTED',
      { resourceType: 'memory', currentUsage, maxLimit, unit: 'MB' },
      context?.requestId ?? defaultContext?.requestId
    ),

  cpuExhausted: (
    currentUsage: number,
    maxLimit: number,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): ResourceDomainError =>
    new ResourceDomainError(
      'CPU limit exceeded',
      'RESOURCE_CPU_EXHAUSTED',
      { resourceType: 'cpu', currentUsage, maxLimit, unit: 'percent' },
      context?.requestId ?? defaultContext?.requestId
    ),

  connectionPoolExhausted: (
    poolSize: number,
    activeConnections: number,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): ResourceDomainError =>
    new ResourceDomainError(
      'Connection pool exhausted',
      'RESOURCE_CONNECTION_POOL_EXHAUSTED',
      { resourceType: 'connection_pool', poolSize, activeConnections },
      context?.requestId ?? defaultContext?.requestId
    ),

  diskSpaceExhausted: (
    available: number,
    required: number,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): ResourceDomainError =>
    new ResourceDomainError(
      'Insufficient disk space',
      'RESOURCE_DISK_SPACE_EXHAUSTED',
      { resourceType: 'disk', currentUsage: available, maxLimit: required, unit: 'GB' },
      context?.requestId ?? defaultContext?.requestId
    ),

  fileHandleExhausted: (
    currentUsage: number,
    maxLimit: number,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): ResourceDomainError =>
    new ResourceDomainError(
      'File handle limit exceeded',
      'RESOURCE_FILE_HANDLE_EXHAUSTED',
      { resourceType: 'file_handles', currentUsage, maxLimit },
      context?.requestId ?? defaultContext?.requestId
    ),
};