/**
 * Error tracking factory and default instances
 * @module core/errors/error-tracking-factory
 * @nist au-3 "Content of Audit Records"
 */

import { Logger } from 'pino';
import { ErrorTracker } from './error-tracker.js';
import { ErrorTrackingStorage, ErrorPatternConfig } from './error-tracking-interfaces.js';

/**
 * Default error tracker instance
 */
export let defaultErrorTracker: ErrorTracker | null = null;

/**
 * Initialize default error tracker
 */
export function initializeErrorTracker(
  storage: ErrorTrackingStorage,
  logger: Logger,
  patternConfig?: ErrorPatternConfig,
): ErrorTracker {
  defaultErrorTracker = new ErrorTracker(storage, logger, patternConfig);
  return defaultErrorTracker;
}

/**
 * Get default error tracker
 */
export function getErrorTracker(): ErrorTracker {
  if (!defaultErrorTracker) {
    throw new Error('Error tracker not initialized. Call initializeErrorTracker first.');
  }
  return defaultErrorTracker;
}
