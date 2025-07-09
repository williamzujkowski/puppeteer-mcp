/**
 * System-level types for error handling - middleware, registry, pipeline, and system configuration
 * @module core/errors/system-types
 */

import { AnyError, ErrorHandler, ErrorTransformer, ErrorValidationResult } from './base-types.js';
import {
  ErrorMonitoringConfig,
  ErrorReportingConfig,
  ErrorCacheConfig,
  ErrorQueueConfig,
} from './monitoring-types.js';

/**
 * Error middleware context type
 */
export interface ErrorMiddlewareContext {
  request: {
    id: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    query: Record<string, unknown>;
    params: Record<string, unknown>;
    body?: unknown;
    user?: {
      id: string;
      roles: string[];
      permissions: string[];
    };
    session?: {
      id: string;
      data: Record<string, unknown>;
    };
  };
  response: {
    statusCode?: number;
    headers?: Record<string, string>;
    duration?: number;
  };
  error: AnyError;
  metadata: {
    timestamp: Date;
    environment: string;
    service: string;
    version: string;
    deployment: string;
  };
}

/**
 * Error handler registry type
 */
export interface ErrorHandlerRegistry {
  handlers: Map<string, ErrorHandler>;
  register(key: string, handler: ErrorHandler): void;
  unregister(key: string): boolean;
  get(key: string): ErrorHandler | undefined;
  has(key: string): boolean;
  clear(): void;
  list(): string[];
}

/**
 * Error transformation pipeline type
 */
export interface ErrorTransformationPipeline {
  transformers: ErrorTransformer[];
  add(transformer: ErrorTransformer): void;
  remove(transformer: ErrorTransformer): boolean;
  clear(): void;
  process(error: AnyError): AnyError;
}

/**
 * Error validation pipeline type
 */
export interface ErrorValidationPipeline {
  validators: Array<(error: AnyError) => ErrorValidationResult>;
  add(validator: (error: AnyError) => ErrorValidationResult): void;
  remove(validator: (error: AnyError) => ErrorValidationResult): boolean;
  clear(): void;
  validate(error: AnyError): ErrorValidationResult;
}

/**
 * Error system configuration type
 */
export interface ErrorSystemConfig {
  tracking: {
    enabled: boolean;
    storage: 'memory' | 'file' | 'database';
    config: Record<string, unknown>;
  };
  recovery: {
    enabled: boolean;
    maxAttempts: number;
    strategies: string[];
    config: Record<string, unknown>;
  };
  serialization: {
    includeStack: boolean;
    includeDetails: boolean;
    sanitizeSensitive: boolean;
    formats: ('rest' | 'grpc' | 'websocket' | 'mcp')[];
  };
  monitoring: ErrorMonitoringConfig;
  reporting: ErrorReportingConfig;
  caching: ErrorCacheConfig;
  queueing: ErrorQueueConfig;
  middleware: {
    enabled: boolean;
    order: number;
    config: Record<string, unknown>;
  };
}
