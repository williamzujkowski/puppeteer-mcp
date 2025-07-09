/**
 * Error tracking service
 * @module core/errors/error-tracker
 * @nist au-3 "Content of Audit Records"
 * @nist si-11 "Error handling"
 */

import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { EnhancedAppError } from './enhanced-app-error.js';
import { ErrorCategory, ErrorSeverity } from './error-context.js';
import { ErrorSerializer } from './error-serialization.js';
import { SerializedError } from './serialization-interfaces.js';
import {
  ErrorTrackingEvent,
  ErrorTrackingStorage,
  ErrorTrackingEntry,
  ErrorPatternConfig,
  ErrorMetrics,
} from './error-tracking-interfaces.js';

/**
 * Error tracking and analytics service
 */
export class ErrorTracker extends EventEmitter {
  private storage: ErrorTrackingStorage;
  private logger: Logger;
  private patternConfig: ErrorPatternConfig;
  private isEnabled: boolean;

  constructor(
    storage: ErrorTrackingStorage,
    logger: Logger,
    patternConfig: ErrorPatternConfig = {
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
    }
  ) {
    super();
    this.storage = storage;
    this.logger = logger;
    this.patternConfig = patternConfig;
    this.isEnabled = true;

    // Set up periodic cleanup
    setInterval(() => void this.cleanup(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Enable error tracking
   */
  enable(): void {
    this.isEnabled = true;
    this.logger.info('Error tracking enabled');
  }

  /**
   * Disable error tracking
   */
  disable(): void {
    this.isEnabled = false;
    this.logger.info('Error tracking disabled');
  }

  /**
   * Track an error occurrence
   * @nist au-3 "Content of Audit Records"
   */
  async trackError(
    error: Error | EnhancedAppError,
    context: {
      requestId?: string;
      userId?: string;
      sessionId?: string;
      endpoint?: string;
      method?: string;
      userAgent?: string;
      ipAddress?: string;
    } = {}
  ): Promise<string> {
    if (!this.isEnabled) {
      return '';
    }

    const entryId = this.generateId();
    const timestamp = new Date();
    const serialized = ErrorSerializer.serialize(error, {
      requestId: context.requestId,
      userId: context.userId,
      includeStack: false,
      includeTechnicalDetails: true,
      includeRetryConfig: true,
      sanitizeSensitiveData: true,
    });

    const entry: ErrorTrackingEntry = {
      id: entryId,
      timestamp,
      error: serialized,
      resolved: false,
      retryAttempts: 0,
      successfulRetry: false,
      fingerprint: this.generateFingerprint(serialized),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        service: 'puppeteer-mcp',
        version: process.env.npm_package_version ?? '1.0.0',
      },
      context,
      tags: {
        ...serialized.tags,
        severity: serialized.severity,
        category: serialized.category,
      },
    };

    try {
      await this.storage.store(entry);
      
      // Emit tracking event
      this.emit(ErrorTrackingEvent.ERROR_OCCURRED, entry);

      // Log security event for NIST compliance
      if (serialized.category === ErrorCategory.SECURITY) {
        this.logger.error({
          event: 'security_error',
          errorCode: serialized.errorCode,
          severity: serialized.severity,
          userId: context.userId,
          ipAddress: context.ipAddress,
          requestId: context.requestId,
          timestamp: timestamp.toISOString(),
          fingerprint: entry.fingerprint,
        }, 'Security error tracked');
      }

      // Check for error patterns
      if (this.patternConfig.enabled) {
        await this.checkErrorPatterns(entry);
      }

      return entryId;
    } catch (trackingError) {
      this.logger.error({
        error: trackingError,
        originalError: error.message,
        requestId: context.requestId,
      }, 'Failed to track error');
      
      return '';
    }
  }

  /**
   * Mark an error as resolved
   */
  async resolveError(
    entryId: string,
    resolutionTime?: number,
    successfulRetry = false
  ): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    const resolvedAt = new Date();
    const updates: Partial<ErrorTrackingEntry> = {
      resolved: true,
      resolvedAt,
      resolutionTime,
      successfulRetry,
    };

    try {
      await this.storage.updateEntry(entryId, updates);
      
      const entry = await this.storage.get(entryId);
      if (entry) {
        this.emit(ErrorTrackingEvent.ERROR_RESOLVED, entry);
      }
    } catch (error) {
      this.logger.error({
        error,
        entryId,
      }, 'Failed to resolve error');
    }
  }

  /**
   * Record a retry attempt
   */
  async recordRetryAttempt(entryId: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      const entry = await this.storage.get(entryId);
      if (entry) {
        await this.storage.updateEntry(entryId, {
          retryAttempts: entry.retryAttempts + 1,
          lastRetryAt: new Date(),
        });
      }
    } catch (error) {
      this.logger.error({
        error,
        entryId,
      }, 'Failed to record retry attempt');
    }
  }

  /**
   * Get error metrics
   */
  async getMetrics(timeWindow = 1440): Promise<ErrorMetrics> {
    return this.storage.getMetrics(timeWindow);
  }

  /**
   * Get errors by category
   */
  async getErrorsByCategory(category: ErrorCategory, timeWindow = 1440): Promise<ErrorTrackingEntry[]> {
    return this.storage.getByCategory(category, timeWindow);
  }

  /**
   * Get errors by severity
   */
  async getErrorsBySeverity(severity: ErrorSeverity, timeWindow = 1440): Promise<ErrorTrackingEntry[]> {
    return this.storage.getBySeverity(severity, timeWindow);
  }

  /**
   * Get error details
   */
  async getErrorDetails(entryId: string): Promise<ErrorTrackingEntry | null> {
    return this.storage.get(entryId);
  }

  /**
   * Check for error patterns and correlations
   */
  private async checkErrorPatterns(entry: ErrorTrackingEntry): Promise<void> {
    // Check category thresholds
    const categoryThreshold = this.patternConfig.thresholds[entry.error.category];
    if (categoryThreshold) {
      const recentErrors = await this.storage.getByCategory(
        entry.error.category,
        categoryThreshold.timeWindow
      );

      if (recentErrors.length >= categoryThreshold.count) {
        this.emit(ErrorTrackingEvent.ERROR_THRESHOLD_EXCEEDED, {
          category: entry.error.category,
          count: recentErrors.length,
          threshold: categoryThreshold.count,
          timeWindow: categoryThreshold.timeWindow,
        });
      }
    }

    // Check correlation rules
    for (const rule of this.patternConfig.correlationRules) {
      if (rule.pattern.test(entry.error.errorCode)) {
        const correlatedErrors = await this.storage.getByErrorCode(
          entry.error.errorCode,
          rule.timeWindow
        );

        if (correlatedErrors.length >= rule.threshold) {
          const correlationGroup = `${rule.name}_${Date.now()}`;
          
          // Update all correlated errors
          for (const correlatedError of correlatedErrors) {
            await this.storage.updateEntry(correlatedError.id, {
              correlationGroup,
            });
          }

          this.emit(ErrorTrackingEvent.ERROR_CORRELATION_FOUND, {
            rule: rule.name,
            pattern: rule.pattern.source,
            errorCode: entry.error.errorCode,
            count: correlatedErrors.length,
            correlationGroup,
          });
        }
      }
    }
  }

  /**
   * Generate error fingerprint for deduplication
   */
  private generateFingerprint(error: SerializedError): string {
    const components = [
      error.errorCode,
      error.category,
      error.message,
      error.context.operation ?? '',
      error.context.resource ?? '',
    ];

    return Buffer.from(components.join('|')).toString('base64');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old entries
   */
  private async cleanup(): Promise<void> {
    try {
      const maxAge = 7 * 24 * 60; // 7 days in minutes
      await this.storage.cleanup(maxAge);
      
      this.logger.debug('Error tracking cleanup completed');
    } catch (error) {
      this.logger.error({
        error,
      }, 'Error tracking cleanup failed');
    }
  }
}