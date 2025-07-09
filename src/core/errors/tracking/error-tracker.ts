/**
 * Main error tracking coordinator
 * @module core/errors/tracking/error-tracker
 * @nist au-3 "Content of Audit Records"
 * @nist si-11 "Error handling"
 */

import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { EnhancedAppError } from '../enhanced-app-error.js';
import { ErrorCategory, ErrorSeverity } from '../error-context.js';
import {
  ErrorTrackingStorage,
  ErrorTrackingEntry,
  ErrorPatternConfig,
  ErrorContext,
  ErrorMetrics,
} from './types.js';
import { PatternChecker } from './pattern-checker.js';
import { FingerprintGenerator } from './fingerprint-generator.js';
import { MetricsProvider } from './metrics-provider.js';
import { CleanupManager } from './cleanup-manager.js';
import { EntryBuilder, DEFAULT_PATTERN_CONFIG } from './entry-builder.js';
import { StorageOperations } from './storage-operations.js';

/**
 * Error tracking and analytics service
 */
export class ErrorTracker extends EventEmitter {
  private storage: ErrorTrackingStorage;
  private logger: Logger;
  private patternChecker: PatternChecker;
  private metricsProvider: MetricsProvider;
  private cleanupManager: CleanupManager;
  private storageOperations: StorageOperations;
  private isEnabled: boolean;

  constructor(
    storage: ErrorTrackingStorage,
    logger: Logger,
    patternConfig: ErrorPatternConfig = DEFAULT_PATTERN_CONFIG,
  ) {
    super();
    this.storage = storage;
    this.logger = logger;
    this.isEnabled = true;

    this.patternChecker = new PatternChecker(storage, patternConfig, logger, this);
    this.metricsProvider = new MetricsProvider(storage);
    this.cleanupManager = new CleanupManager(storage, logger);
    this.storageOperations = new StorageOperations(storage, logger, this);
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
  async trackError(error: Error | EnhancedAppError, context: ErrorContext = {}): Promise<string> {
    if (!this.isEnabled) {
      return '';
    }

    const entryId = FingerprintGenerator.generateId();
    const timestamp = new Date();
    const entry = EntryBuilder.createTrackingEntry(error, context, entryId, timestamp);

    try {
      await this.storageOperations.storeEntry(entry);

      this.logSecurityEvent(entry);
      await this.patternChecker.checkPatterns(entry);

      return entryId;
    } catch (trackingError) {
      this.logger.error(
        {
          error: trackingError,
          originalError: error.message,
          requestId: context.requestId,
        },
        'Failed to track error',
      );
      return '';
    }
  }

  /**
   * Mark an error as resolved
   */
  async resolveError(
    entryId: string,
    resolutionTime?: number,
    successfulRetry = false,
  ): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.storageOperations.resolveError(entryId, resolutionTime, successfulRetry);
  }

  /**
   * Record a retry attempt
   */
  async recordRetryAttempt(entryId: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.storageOperations.recordRetryAttempt(entryId);
  }

  /**
   * Get error metrics
   */
  async getMetrics(timeWindow = 1440): Promise<ErrorMetrics> {
    return this.metricsProvider.getMetrics(timeWindow);
  }

  /**
   * Get errors by category
   */
  async getErrorsByCategory(
    category: ErrorCategory,
    timeWindow = 1440,
  ): Promise<ErrorTrackingEntry[]> {
    return this.metricsProvider.getErrorsByCategory(category, timeWindow);
  }

  /**
   * Get errors by severity
   */
  async getErrorsBySeverity(
    severity: ErrorSeverity,
    timeWindow = 1440,
  ): Promise<ErrorTrackingEntry[]> {
    return this.metricsProvider.getErrorsBySeverity(severity, timeWindow);
  }

  /**
   * Get error details
   */
  async getErrorDetails(entryId: string): Promise<ErrorTrackingEntry | null> {
    return this.metricsProvider.getErrorDetails(entryId);
  }

  /**
   * Log security events for NIST compliance
   */
  private logSecurityEvent(entry: ErrorTrackingEntry): void {
    if (entry.error.category === ErrorCategory.SECURITY) {
      this.logger.error(
        {
          event: 'security_error',
          errorCode: entry.error.errorCode,
          severity: entry.error.severity,
          userId: entry.context.userId,
          ipAddress: entry.context.ipAddress,
          requestId: entry.context.requestId,
          timestamp: entry.timestamp.toISOString(),
          fingerprint: entry.fingerprint,
        },
        'Security error tracked',
      );
    }
  }

  /**
   * Stop cleanup operations
   */
  destroy(): void {
    this.cleanupManager.stop();
  }
}
