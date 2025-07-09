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
    _currentUsage: number,
    _maxLimit: number,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): ResourceDomainError =>
    new ResourceDomainError({
      message: 'Memory limit exceeded',
      errorCode: 'RESOURCE_MEMORY_EXHAUSTED',
      resourceInfo: { resourceType: 'memory' },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  cpuExhausted: (
    _currentUsage: number,
    _maxLimit: number,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): ResourceDomainError =>
    new ResourceDomainError({
      message: 'CPU limit exceeded',
      errorCode: 'RESOURCE_CPU_EXHAUSTED',
      resourceInfo: { resourceType: 'cpu' },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  connectionPoolExhausted: (
    _poolSize: number,
    _activeConnections: number,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): ResourceDomainError =>
    new ResourceDomainError({
      message: 'Connection pool exhausted',
      errorCode: 'RESOURCE_CONNECTION_POOL_EXHAUSTED',
      resourceInfo: { resourceType: 'connection_pool' },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  diskSpaceExhausted: (
    _available: number,
    _required: number,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): ResourceDomainError =>
    new ResourceDomainError({
      message: 'Insufficient disk space',
      errorCode: 'RESOURCE_DISK_SPACE_EXHAUSTED',
      resourceInfo: { resourceType: 'disk' },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  fileHandleExhausted: (
    _currentUsage: number,
    _maxLimit: number,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): ResourceDomainError =>
    new ResourceDomainError({
      message: 'File handle limit exceeded',
      errorCode: 'RESOURCE_FILE_HANDLE_EXHAUSTED',
      resourceInfo: { resourceType: 'file_handles' },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),
};
