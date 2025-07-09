/**
 * Monitoring, reporting, and escalation types for the error system
 * @module core/errors/monitoring-types
 */

import { ErrorCategory, ErrorSeverity } from './error-context.js';
import { AnyError } from './base-types.js';

/**
 * Error reporting configuration type
 */
export interface ErrorReportingConfig {
  enabled: boolean;
  endpoints: {
    webhook?: string;
    email?: string;
    slack?: string;
    teams?: string;
  };
  filters: {
    categories?: ErrorCategory[];
    severities?: ErrorSeverity[];
    errorCodes?: string[];
    excludeOperational?: boolean;
  };
  throttling: {
    maxReportsPerHour: number;
    duplicateWindow: number; // in minutes
  };
  templates: {
    subject: string;
    body: string;
  };
}

/**
 * Error escalation rule type
 */
export interface ErrorEscalationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    categories?: ErrorCategory[];
    severities?: ErrorSeverity[];
    errorCodes?: string[];
    count?: number;
    timeWindow?: number; // in minutes
    userImpact?: 'single' | 'multiple' | 'system-wide';
  };
  actions: Array<{
    type: 'notify' | 'create_incident' | 'auto_resolve' | 'throttle';
    config: Record<string, unknown>;
    delay?: number; // in minutes
  }>;
  priority: number;
}

/**
 * Error monitoring configuration type
 */
export interface ErrorMonitoringConfig {
  enabled: boolean;
  intervals: {
    collection: number; // in seconds
    aggregation: number; // in seconds
    reporting: number; // in seconds
  };
  thresholds: {
    [key in ErrorCategory]: {
      warning: number;
      critical: number;
      timeWindow: number; // in minutes
    };
  };
  alerting: {
    enabled: boolean;
    channels: string[];
    throttling: {
      maxAlertsPerHour: number;
      duplicateWindow: number; // in minutes
    };
  };
  retention: {
    rawData: number; // in days
    aggregatedData: number; // in days
    auditLogs: number; // in days
  };
}

/**
 * Error cache configuration type
 */
export interface ErrorCacheConfig {
  enabled: boolean;
  ttl: number; // in seconds
  maxSize: number;
  strategy: 'lru' | 'lfu' | 'fifo';
  keyGenerator: (error: AnyError) => string;
  serializer: (error: AnyError) => string;
  deserializer: (serialized: string) => AnyError;
}

/**
 * Error queue configuration type
 */
export interface ErrorQueueConfig {
  enabled: boolean;
  maxSize: number;
  batchSize: number;
  flushInterval: number; // in milliseconds
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    initialDelay: number;
    maxDelay: number;
  };
  deadLetterQueue: {
    enabled: boolean;
    maxSize: number;
    retention: number; // in days
  };
}
