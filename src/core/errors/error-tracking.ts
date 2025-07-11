/**
 * Error tracking and analytics with NIST compliance - Main exports
 * @module core/errors/error-tracking
 * @nist au-3 "Content of Audit Records"
 * @nist au-4 "Audit Storage Capacity"
 * @nist au-9 "Protection of Audit Information"
 * @nist si-11 "Error handling"
 */

// Re-export interfaces and types
export { ErrorTrackingEvent } from './error-tracking-interfaces.js';
export type {
  ErrorMetrics,
  ErrorTrackingEntry,
  ErrorPatternConfig,
  ErrorTrackingStorage,
} from './error-tracking-interfaces.js';

// Re-export storage implementations
export { InMemoryErrorTrackingStorage } from './error-tracking-storage.js';

// Re-export main tracker
export { ErrorTracker } from './error-tracker.js';

// Re-export analytics
export { ErrorAnalytics } from './error-analytics.js';

// Re-export factory functions
export {
  defaultErrorTracker,
  initializeErrorTracker,
  getErrorTracker,
} from './error-tracking-factory.js';
