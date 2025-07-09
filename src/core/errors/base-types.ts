/**
 * Base TypeScript types for the error system
 * @module core/errors/base-types
 */

import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { EnhancedAppError } from './enhanced-app-error.js';
import {
  RestErrorResponse,
  GrpcErrorResponse,
  WebSocketErrorResponse,
  McpErrorResponse,
} from './serialization-interfaces.js';

/**
 * Union type for all error types
 */
export type AnyError = Error | AppError | EnhancedAppError | ZodError;

/**
 * Union type for all error response formats
 */
export type ErrorResponse =
  | RestErrorResponse
  | GrpcErrorResponse
  | WebSocketErrorResponse
  | McpErrorResponse;

/**
 * Error factory function type - fixed to avoid 'any'
 */
export type ErrorFactory<T extends EnhancedAppError> = (...args: unknown[]) => T;

/**
 * Error handler function type
 */
export type ErrorHandler<T = void> = (
  error: AnyError,
  context?: Record<string, unknown>,
) => T | Promise<T>;

/**
 * Error mapper function type
 */
export type ErrorMapper<TInput, TOutput> = (input: TInput) => TOutput;

/**
 * Error predicate function type
 */
export type ErrorPredicate<T extends AnyError = AnyError> = (error: T) => boolean;

/**
 * Error transformer function type
 */
export type ErrorTransformer<T extends AnyError = AnyError> = (error: T) => T;

/**
 * Error validation result type
 */
export interface ErrorValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Error event type
 */
export interface ErrorEvent {
  type: 'error' | 'warning' | 'info';
  timestamp: Date;
  source: string;
  message: string;
  data?: Record<string, unknown>;
  error?: AnyError;
  context?: Record<string, unknown>;
}

/**
 * Error event listener type
 */
export type ErrorEventListener = (event: ErrorEvent) => void | Promise<void>;

/**
 * Error event emitter interface
 */
export interface ErrorEventEmitter {
  on(event: string, listener: ErrorEventListener): void;
  off(event: string, listener: ErrorEventListener): void;
  emit(event: string, data: ErrorEvent): void;
  once(event: string, listener: ErrorEventListener): void;
  removeAllListeners(event?: string): void;
  listenerCount(event: string): number;
}

/**
 * Error plugin interface
 */
export interface ErrorPlugin {
  name: string;
  version: string;
  enabled: boolean;
  install(systemConfig: Record<string, unknown>): void | Promise<void>;
  uninstall(): void | Promise<void>;
  configure(config: Record<string, unknown>): void | Promise<void>;
  getStatus(): {
    installed: boolean;
    configured: boolean;
    healthy: boolean;
    metadata: Record<string, unknown>;
  };
}
