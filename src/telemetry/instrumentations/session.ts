/**
 * Session management instrumentation for OpenTelemetry
 * @module telemetry/instrumentations/session
 * @nist au-2 "Audit events"
 * @nist ac-12 "Session termination"
 */

// Re-export from modular structure
export { instrumentSessionStore, createSessionActivitySpan } from './session/index.js';

// Re-export types for backwards compatibility
export type {
  InstrumentationContext,
  SpanWrapper,
  OperationResult,
  SessionAttributes,
  MetricsLabels,
} from './session/types.js';