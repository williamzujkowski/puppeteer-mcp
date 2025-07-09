/**
 * Shared types for error tracking modules
 * @module core/errors/tracking/types
 * @nist au-3 "Content of Audit Records"
 */

import { ErrorCategory, ErrorSeverity } from '../error-context.js';
import { SerializedError } from '../serialization-interfaces.js';

/**
 * Error tracking context information
 */
export interface ErrorContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Error environment information
 */
export interface ErrorEnvironment {
  nodeVersion: string;
  platform: string;
  service: string;
  version: string;
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
  environment: ErrorEnvironment;
  context: ErrorContext;
  tags: Record<string, string>;
}

/**
 * Error pattern threshold configuration
 */
export interface ErrorThreshold {
  count: number;
  timeWindow: number; // in minutes
}

/**
 * Error correlation rule
 */
export interface ErrorCorrelationRule {
  name: string;
  pattern: RegExp;
  timeWindow: number; // in minutes
  threshold: number;
}

/**
 * Error pattern detection configuration
 */
export interface ErrorPatternConfig {
  enabled: boolean;
  windowSize: number; // in minutes
  thresholds: {
    [key in ErrorCategory]: ErrorThreshold;
  };
  correlationRules: ErrorCorrelationRule[];
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
 * Threshold exceeded event data
 */
export interface ThresholdExceededData {
  category: ErrorCategory;
  count: number;
  threshold: number;
  timeWindow: number;
}

/**
 * Correlation found event data
 */
export interface CorrelationFoundData {
  rule: string;
  pattern: string;
  errorCode: string;
  count: number;
  correlationGroup: string;
}
