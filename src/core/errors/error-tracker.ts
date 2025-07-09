/**
 * Error tracking service (re-export from modular structure)
 * @module core/errors/error-tracker
 * @nist au-3 "Content of Audit Records"
 * @nist si-11 "Error handling"
 */

export { ErrorTracker } from './tracking/index.js';
export type {
  ErrorTrackingEntry,
  ErrorTrackingStorage,
  ErrorPatternConfig,
  ErrorMetrics,
} from './tracking/types.js';
export { ErrorTrackingEvent } from './tracking/types.js';
