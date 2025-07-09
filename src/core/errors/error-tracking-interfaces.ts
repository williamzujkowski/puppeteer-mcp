/**
 * Error tracking interfaces and types
 * @module core/errors/error-tracking-interfaces
 * @nist au-3 "Content of Audit Records"
 */

import { ErrorCategory, ErrorSeverity } from './error-context.js';
import { SerializedError } from './error-serialization.js';

/**
 * Error tracking event types
 */
export enum ErrorTrackingEvent {
  ERROR_OCCURRED = 'error_occurred',
  ERROR_RESOLVED = 'error_resolved',
  ERROR_PATTERN_DETECTED = 'error_pattern_detected',
  ERROR_THRESHOLD_EXCEEDED = 'error_threshold_exceeded',
  ERROR_CORRELATION_FOUND = 'error_correlation_found',
}

/**
 * Error metrics interface
 */
export interface ErrorMetrics {
  total: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  byErrorCode: Record<string, number>;
  byTimeWindow: Record<string, number>;
  averageResolutionTime: number;
  retrySuccessRate: number;
  topErrors: Array<{
    errorCode: string;
    count: number;
    lastOccurrence: Date;
  }>;
}

/**
 * Error tracking entry
 */
export interface ErrorTrackingEntry {
  id: string;
  timestamp: Date;
  error: SerializedError;
  resolved: boolean;
  resolvedAt?: Date;
  resolutionTime?: number;
  retryAttempts: number;
  lastRetryAt?: Date;
  successfulRetry: boolean;
  correlationGroup?: string;
  fingerprint: string;
  environment: {
    nodeVersion: string;
    platform: string;
    service: string;
    version: string;
  };
  context: {
    requestId?: string;
    userId?: string;
    sessionId?: string;
    endpoint?: string;
    method?: string;
    userAgent?: string;
    ipAddress?: string;
  };
  tags: Record<string, string>;
}

/**
 * Error pattern detection configuration
 */
export interface ErrorPatternConfig {
  enabled: boolean;
  windowSize: number; // in minutes
  thresholds: {
    [key in ErrorCategory]: {
      count: number;
      timeWindow: number; // in minutes
    };
  };
  correlationRules: Array<{
    name: string;
    pattern: RegExp;
    timeWindow: number; // in minutes
    threshold: number;
  }>;
}

/**
 * Error tracking storage interface
 */
export interface ErrorTrackingStorage {
  store(entry: ErrorTrackingEntry): Promise<void>;
  get(id: string): Promise<ErrorTrackingEntry | null>;
  getByFingerprint(fingerprint: string, timeWindow: number): Promise<ErrorTrackingEntry[]>;
  getMetrics(timeWindow: number): Promise<ErrorMetrics>;
  getByCategory(category: ErrorCategory, timeWindow: number): Promise<ErrorTrackingEntry[]>;
  getBySeverity(severity: ErrorSeverity, timeWindow: number): Promise<ErrorTrackingEntry[]>;
  getByErrorCode(errorCode: string, timeWindow: number): Promise<ErrorTrackingEntry[]>;
  getByCorrelationGroup(group: string): Promise<ErrorTrackingEntry[]>;
  updateEntry(id: string, updates: Partial<ErrorTrackingEntry>): Promise<void>;
  cleanup(maxAge: number): Promise<void>;
}