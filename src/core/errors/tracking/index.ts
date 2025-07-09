/**
 * Error tracking module exports
 * @module core/errors/tracking
 * @nist au-3 "Content of Audit Records"
 * @nist si-11 "Error handling"
 */

export { ErrorTracker } from './error-tracker.js';
export type {
  ErrorTrackingEntry,
  ErrorTrackingStorage,
  ErrorPatternConfig,
  ErrorMetrics,
  ErrorContext,
  ErrorEnvironment,
  ErrorThreshold,
  ErrorCorrelationRule,
  ThresholdExceededData,
  CorrelationFoundData,
} from './types.js';
export { ErrorTrackingEvent } from './types.js';
export { PatternChecker } from './pattern-checker.js';
export { FingerprintGenerator } from './fingerprint-generator.js';
export { MetricsProvider } from './metrics-provider.js';
export { CleanupManager } from './cleanup-manager.js';
export { EntryBuilder, DEFAULT_PATTERN_CONFIG } from './entry-builder.js';
export { StorageOperations } from './storage-operations.js';
