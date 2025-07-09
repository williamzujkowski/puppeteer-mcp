/**
 * Error tracking and analytics with NIST compliance
 * @module core/errors/error-tracking
 * @nist au-3 "Content of Audit Records"
 * @nist au-4 "Audit Storage Capacity"
 * @nist au-9 "Protection of Audit Information"
 * @nist si-11 "Error handling"
 */

import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { EnhancedAppError } from './enhanced-app-error.js';
import { ErrorCategory, ErrorSeverity } from './error-context.js';
import { SerializedError, ErrorSerializer } from './error-serialization.js';

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

/**
 * In-memory error tracking storage (for development/testing)
 */
export class InMemoryErrorTrackingStorage implements ErrorTrackingStorage {
  private entries: Map<string, ErrorTrackingEntry> = new Map();

  async store(entry: ErrorTrackingEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async get(id: string): Promise<ErrorTrackingEntry | null> {
    return this.entries.get(id) || null;
  }

  async getByFingerprint(fingerprint: string, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    return Array.from(this.entries.values())
      .filter(entry => entry.fingerprint === fingerprint && entry.timestamp >= cutoff);
  }

  async getMetrics(timeWindow: number): Promise<ErrorMetrics> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const recentEntries = Array.from(this.entries.values())
      .filter(entry => entry.timestamp >= cutoff);

    const byCategory: Record<ErrorCategory, number> = Object.values(ErrorCategory)
      .reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {} as Record<ErrorCategory, number>);

    const bySeverity: Record<ErrorSeverity, number> = Object.values(ErrorSeverity)
      .reduce((acc, sev) => ({ ...acc, [sev]: 0 }), {} as Record<ErrorSeverity, number>);

    const byErrorCode: Record<string, number> = {};
    const byTimeWindow: Record<string, number> = {};

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let successfulRetries = 0;
    let totalRetries = 0;

    for (const entry of recentEntries) {
      byCategory[entry.error.category]++;
      bySeverity[entry.error.severity]++;
      byErrorCode[entry.error.errorCode] = (byErrorCode[entry.error.errorCode] || 0) + 1;

      const hourKey = new Date(entry.timestamp).toISOString().substring(0, 13);
      byTimeWindow[hourKey] = (byTimeWindow[hourKey] || 0) + 1;

      if (entry.resolved && entry.resolutionTime) {
        totalResolutionTime += entry.resolutionTime;
        resolvedCount++;
      }

      totalRetries += entry.retryAttempts;
      if (entry.successfulRetry) {
        successfulRetries++;
      }
    }

    const topErrors = Object.entries(byErrorCode)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([errorCode, count]) => {
        const lastEntry = recentEntries
          .filter(e => e.error.errorCode === errorCode)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
        return {
          errorCode,
          count,
          lastOccurrence: lastEntry?.timestamp || new Date(),
        };
      });

    return {
      total: recentEntries.length,
      byCategory,
      bySeverity,
      byErrorCode,
      byTimeWindow,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      retrySuccessRate: totalRetries > 0 ? successfulRetries / totalRetries : 0,
      topErrors,
    };
  }

  async getByCategory(category: ErrorCategory, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    return Array.from(this.entries.values())
      .filter(entry => entry.error.category === category && entry.timestamp >= cutoff);
  }

  async getBySeverity(severity: ErrorSeverity, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    return Array.from(this.entries.values())
      .filter(entry => entry.error.severity === severity && entry.timestamp >= cutoff);
  }

  async getByErrorCode(errorCode: string, timeWindow: number): Promise<ErrorTrackingEntry[]> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    return Array.from(this.entries.values())
      .filter(entry => entry.error.errorCode === errorCode && entry.timestamp >= cutoff);
  }

  async getByCorrelationGroup(group: string): Promise<ErrorTrackingEntry[]> {
    return Array.from(this.entries.values())
      .filter(entry => entry.correlationGroup === group);
  }

  async updateEntry(id: string, updates: Partial<ErrorTrackingEntry>): Promise<void> {
    const existing = this.entries.get(id);
    if (existing) {
      this.entries.set(id, { ...existing, ...updates });
    }
  }

  async cleanup(maxAge: number): Promise<void> {
    const cutoff = new Date(Date.now() - maxAge * 60 * 1000);
    for (const [id, entry] of this.entries.entries()) {
      if (entry.timestamp < cutoff) {
        this.entries.delete(id);
      }
    }
  }
}

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
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
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
        version: process.env.npm_package_version || '1.0.0',
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
      error.context.operation || '',
      error.context.resource || '',
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

/**
 * Error analytics utilities
 */
export class ErrorAnalytics {
  private tracker: ErrorTracker;

  constructor(tracker: ErrorTracker) {
    this.tracker = tracker;
  }

  /**
   * Generate error trend analysis
   */
  async getTrendAnalysis(timeWindow = 1440): Promise<{
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercentage: number;
    periods: Array<{
      start: Date;
      end: Date;
      count: number;
    }>;
  }> {
    const metrics = await this.tracker.getMetrics(timeWindow);
    const halfWindow = Math.floor(timeWindow / 2);
    const firstHalfMetrics = await this.tracker.getMetrics(halfWindow);
    
    const firstHalfCount = firstHalfMetrics.total;
    const secondHalfCount = metrics.total - firstHalfCount;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let changePercentage = 0;
    
    if (firstHalfCount > 0) {
      changePercentage = ((secondHalfCount - firstHalfCount) / firstHalfCount) * 100;
      
      if (changePercentage > 10) {
        trend = 'increasing';
      } else if (changePercentage < -10) {
        trend = 'decreasing';
      }
    }
    
    const now = new Date();
    const periods = [
      {
        start: new Date(now.getTime() - timeWindow * 60 * 1000),
        end: new Date(now.getTime() - halfWindow * 60 * 1000),
        count: firstHalfCount,
      },
      {
        start: new Date(now.getTime() - halfWindow * 60 * 1000),
        end: now,
        count: secondHalfCount,
      },
    ];
    
    return {
      trend,
      changePercentage,
      periods,
    };
  }

  /**
   * Get error health score (0-100)
   */
  async getHealthScore(timeWindow = 1440): Promise<number> {
    const metrics = await this.tracker.getMetrics(timeWindow);
    
    // Score based on error count, severity distribution, and resolution rate
    let score = 100;
    
    // Penalize for high error counts
    if (metrics.total > 100) {
      score -= Math.min(50, (metrics.total - 100) / 10);
    }
    
    // Penalize for high severity errors
    const criticalWeight = metrics.bySeverity[ErrorSeverity.CRITICAL] * 10;
    const highWeight = metrics.bySeverity[ErrorSeverity.HIGH] * 5;
    const mediumWeight = metrics.bySeverity[ErrorSeverity.MEDIUM] * 2;
    
    const severityPenalty = Math.min(30, (criticalWeight + highWeight + mediumWeight) / 10);
    score -= severityPenalty;
    
    // Bonus for high retry success rate
    if (metrics.retrySuccessRate > 0.8) {
      score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }
}

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
  patternConfig?: ErrorPatternConfig
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