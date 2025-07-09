/**
 * Error tracking entry builder
 * @module core/errors/tracking/entry-builder
 * @nist au-3 "Content of Audit Records"
 */

import { ErrorCategory } from '../error-context.js';
import { ErrorSerializer } from '../error-serialization.js';
import { EnhancedAppError } from '../enhanced-app-error.js';
import { ErrorTrackingEntry, ErrorContext, ErrorEnvironment } from './types.js';
import { FingerprintGenerator } from './fingerprint-generator.js';

/**
 * Default error pattern configuration
 */
export const DEFAULT_PATTERN_CONFIG = {
  enabled: true,
  windowSize: 60,
  thresholds: {
    [ErrorCategory.SECURITY]: { count: 5, timeWindow: 15 },
    [ErrorCategory.AUTHENTICATION]: { count: 10, timeWindow: 30 },
    [ErrorCategory.AUTHORIZATION]: { count: 15, timeWindow: 30 },
    [ErrorCategory.SYSTEM]: { count: 20, timeWindow: 30 },
    [ErrorCategory.DATABASE]: { count: 25, timeWindow: 30 },
    [ErrorCategory.NETWORK]: { count: 30, timeWindow: 30 },
    [ErrorCategory.BROWSER]: { count: 40, timeWindow: 30 },
    [ErrorCategory.EXTERNAL_SERVICE]: { count: 50, timeWindow: 30 },
    [ErrorCategory.RESOURCE]: { count: 30, timeWindow: 30 },
    [ErrorCategory.VALIDATION]: { count: 100, timeWindow: 30 },
    [ErrorCategory.CONFIGURATION]: { count: 10, timeWindow: 30 },
    [ErrorCategory.BUSINESS_LOGIC]: { count: 50, timeWindow: 30 },
    [ErrorCategory.PERFORMANCE]: { count: 30, timeWindow: 30 },
    [ErrorCategory.RATE_LIMIT]: { count: 200, timeWindow: 30 },
    [ErrorCategory.SESSION]: { count: 15, timeWindow: 30 },
  },
  correlationRules: [
    {
      name: 'cascading_failures',
      pattern: /TIMEOUT|UNAVAILABLE|EXHAUSTED/,
      timeWindow: 15,
      threshold: 3,
    },
    {
      name: 'auth_attacks',
      pattern: /AUTH_|SECURITY_|INVALID_TOKEN/,
      timeWindow: 10,
      threshold: 5,
    },
  ],
};

/**
 * Builds error tracking entries
 */
export class EntryBuilder {
  /**
   * Create a tracking entry from error and context
   */
  static createTrackingEntry(
    error: Error | EnhancedAppError,
    context: ErrorContext,
    entryId: string,
    timestamp: Date,
  ): ErrorTrackingEntry {
    const serialized = ErrorSerializer.serialize(error, {
      requestId: context.requestId,
      userId: context.userId,
      includeStack: false,
      includeTechnicalDetails: true,
      includeRetryConfig: true,
      sanitizeSensitiveData: true,
    });

    const environment: ErrorEnvironment = {
      nodeVersion: process.version,
      platform: process.platform,
      service: 'puppeteer-mcp',
      version: process.env.npm_package_version ?? '1.0.0',
    };

    return {
      id: entryId,
      timestamp,
      error: serialized,
      resolved: false,
      retryAttempts: 0,
      successfulRetry: false,
      fingerprint: FingerprintGenerator.generateFingerprint(serialized),
      environment,
      context,
      tags: {
        ...serialized.tags,
        severity: serialized.severity,
        category: serialized.category,
      },
    };
  }
}
