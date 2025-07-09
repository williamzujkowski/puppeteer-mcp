/**
 * Session instrumentation module exports
 * @module telemetry/instrumentations/session
 * @nist au-2 "Audit events"
 * @nist ac-12 "Session termination"
 */

// Main instrumentation function
export { instrumentSessionStore } from './session-instrumentation.js';

// Activity span creation utility
export { createSessionActivitySpan } from './session-metrics.js';

// Types
export type {
  InstrumentationContext,
  SpanWrapper,
  OperationResult,
  SessionAttributes,
  MetricsLabels,
} from './types.js';

// Individual instrumentation functions (for advanced usage)
export { instrumentCreate } from './session-create.js';
export { instrumentGet } from './session-get.js';
export { instrumentExists } from './session-exists.js';
export { instrumentGetByUserId } from './session-list.js';
export { instrumentUpdate } from './session-modify.js';
export { instrumentTouch } from './session-touch.js';
export { instrumentDelete } from './session-delete.js';
export { instrumentDeleteExpired } from './session-cleanup.js';

// Metrics utilities
export {
  recordSessionDuration,
  recordSessionCreated,
  recordSessionDestroyed,
  recordBulkSessionDestroyed,
} from './session-metrics.js';