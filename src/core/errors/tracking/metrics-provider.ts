/**
 * Error metrics and querying operations
 * @module core/errors/tracking/metrics-provider
 * @nist au-3 "Content of Audit Records"
 */

import { ErrorCategory, ErrorSeverity } from '../error-context.js';
import { ErrorTrackingStorage, ErrorTrackingEntry, ErrorMetrics } from './types.js';

/**
 * Provides error metrics and querying operations
 */
export class MetricsProvider {
  constructor(private storage: ErrorTrackingStorage) {}

  /**
   * Get error metrics for a time window
   */
  async getMetrics(timeWindow = 1440): Promise<ErrorMetrics> {
    return this.storage.getMetrics(timeWindow);
  }

  /**
   * Get errors by category
   */
  async getErrorsByCategory(
    category: ErrorCategory,
    timeWindow = 1440,
  ): Promise<ErrorTrackingEntry[]> {
    return this.storage.getByCategory(category, timeWindow);
  }

  /**
   * Get errors by severity
   */
  async getErrorsBySeverity(
    severity: ErrorSeverity,
    timeWindow = 1440,
  ): Promise<ErrorTrackingEntry[]> {
    return this.storage.getBySeverity(severity, timeWindow);
  }

  /**
   * Get error details by ID
   */
  async getErrorDetails(entryId: string): Promise<ErrorTrackingEntry | null> {
    return this.storage.get(entryId);
  }

  /**
   * Get errors by error code
   */
  async getErrorsByCode(errorCode: string, timeWindow = 1440): Promise<ErrorTrackingEntry[]> {
    return this.storage.getByErrorCode(errorCode, timeWindow);
  }

  /**
   * Get errors by correlation group
   */
  async getErrorsByCorrelationGroup(group: string): Promise<ErrorTrackingEntry[]> {
    return this.storage.getByCorrelationGroup(group);
  }

  /**
   * Get errors by fingerprint
   */
  async getErrorsByFingerprint(
    fingerprint: string,
    timeWindow = 1440,
  ): Promise<ErrorTrackingEntry[]> {
    return this.storage.getByFingerprint(fingerprint, timeWindow);
  }
}
