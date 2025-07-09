/**
 * Utility types for error handling - converted from namespace to ES modules
 * @module core/errors/utility-types
 */

import { AnyError } from './base-types.js';
import { ErrorContext } from './error-context.js';
import { ErrorResolution } from './resolution-types.js';

/**
 * Error with context utility type
 */
export type ErrorWithContext<T extends AnyError = AnyError> = T & {
  context: ErrorContext;
};

/**
 * Error with metadata utility type
 */
export type ErrorWithMetadata<T extends AnyError = AnyError> = T & {
  metadata: Record<string, unknown>;
};

/**
 * Error with recovery information utility type
 */
export type ErrorWithRecovery<T extends AnyError = AnyError> = T & {
  recovery: {
    attempts: number;
    lastAttempt: Date;
    nextAttempt?: Date;
    strategy?: string;
  };
};

/**
 * Error with resolution information utility type
 */
export type ErrorWithResolution<T extends AnyError = AnyError> = T & {
  resolution: ErrorResolution;
};

/**
 * Maybe error utility type
 */
export type MaybeError<T> = T | Error;

/**
 * Error result utility type for Result pattern
 */
export type ErrorResult<T> = { success: true; data: T } | { success: false; error: AnyError };

/**
 * Async error result utility type
 */
export type AsyncErrorResult<T> = Promise<ErrorResult<T>>;

/**
 * Error callback utility type
 */
export type ErrorCallback<T = void> = (error: AnyError | null, result?: T) => void;

/**
 * Async error callback utility type
 */
export type AsyncErrorCallback<T = void> = (error: AnyError | null, result?: T) => Promise<void>;

/**
 * Error or value utility type
 */
export type ErrorOrValue<T> = T | AnyError;

/**
 * Maybe error or value utility type
 */
export type MaybeErrorOrValue<T> = T | AnyError | null | undefined;
