/**
 * Shared types for session instrumentation
 * @module telemetry/instrumentations/session/types
 */

import type { Span, Tracer } from '@opentelemetry/api';
import type { SessionStore } from '../../../store/session-store.interface.js';

/**
 * Common instrumentation context
 */
export interface InstrumentationContext {
  /** OpenTelemetry tracer instance */
  tracer: Tracer;
  /** Original session store instance */
  store: SessionStore;
}

/**
 * Span wrapper for consistent error handling
 */
export interface SpanWrapper {
  /** The OpenTelemetry span */
  span: Span;
  /** Execute operation within span context */
  execute<T>(operation: () => Promise<T>): Promise<T>;
}

/**
 * Operation result with telemetry data
 */
export interface OperationResult<T = unknown> {
  /** Operation result */
  result: T;
  /** Operation success status */
  success: boolean;
  /** Error if operation failed */
  error?: Error;
}

/**
 * Session operation attributes
 */
export interface SessionAttributes {
  /** Session ID */
  'session.id'?: string;
  /** User ID */
  'session.user_id'?: string;
  /** Operation type */
  'session.operation': string;
  /** Whether session was found */
  'session.found'?: boolean;
  /** Whether session exists */
  'session.exists'?: boolean;
  /** Whether operation was successful */
  'session.success'?: boolean;
  /** Additional custom attributes */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Metrics labels for session operations
 */
export interface MetricsLabels {
  /** User ID for user-specific metrics */
  user_id?: string;
  /** Operation reason (e.g., 'cleanup', 'expired') */
  reason?: string;
  /** Operation type */
  operation?: string;
  /** Index signature for compatibility with OpenTelemetry Attributes */
  [key: string]: string | number | boolean | undefined;
}
