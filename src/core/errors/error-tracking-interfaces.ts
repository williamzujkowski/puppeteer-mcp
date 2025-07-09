/**
 * Error tracking interfaces and types (re-export from modular structure)
 * @module core/errors/error-tracking-interfaces
 * @nist au-3 "Content of Audit Records"
 */

export {
  ErrorTrackingEvent,
  type ErrorMetrics,
  type ErrorTrackingEntry,
  type ErrorPatternConfig,
  type ErrorTrackingStorage,
  type ErrorThreshold,
  type ErrorCorrelationRule,
  type ErrorContext,
  type ErrorEnvironment,
  type ThresholdExceededData,
  type CorrelationFoundData,
} from './tracking/types.js';
