/**
 * Error pattern checking and correlation logic
 * @module core/errors/tracking/pattern-checker
 * @nist au-3 "Content of Audit Records"
 */

import { EventEmitter } from 'events';
import { Logger } from 'pino';
import {
  ErrorTrackingStorage,
  ErrorTrackingEntry,
  ErrorPatternConfig,
  ErrorTrackingEvent,
  ThresholdExceededData,
  CorrelationFoundData,
} from './types.js';
import { FingerprintGenerator } from './fingerprint-generator.js';

/**
 * Handles error pattern detection and correlation
 */
export class PatternChecker {
  constructor(
    private storage: ErrorTrackingStorage,
    private patternConfig: ErrorPatternConfig,
    private logger: Logger,
    private eventEmitter: EventEmitter,
  ) {}

  /**
   * Check for error patterns and correlations
   */
  async checkPatterns(entry: ErrorTrackingEntry): Promise<void> {
    if (!this.patternConfig.enabled) {
      return;
    }

    await Promise.all([this.checkCategoryThresholds(entry), this.checkCorrelationRules(entry)]);
  }

  /**
   * Check if category thresholds are exceeded
   */
  private async checkCategoryThresholds(entry: ErrorTrackingEntry): Promise<void> {
    const categoryThreshold = this.patternConfig.thresholds[entry.error.category];
    if (categoryThreshold === undefined) {
      return;
    }

    try {
      const recentErrors = await this.storage.getByCategory(
        entry.error.category,
        categoryThreshold.timeWindow,
      );

      if (recentErrors.length >= categoryThreshold.count) {
        const data: ThresholdExceededData = {
          category: entry.error.category,
          count: recentErrors.length,
          threshold: categoryThreshold.count,
          timeWindow: categoryThreshold.timeWindow,
        };

        this.eventEmitter.emit(ErrorTrackingEvent.ERROR_THRESHOLD_EXCEEDED, data);
      }
    } catch (error) {
      this.logger.error(
        {
          error,
          category: entry.error.category,
        },
        'Failed to check category threshold',
      );
    }
  }

  /**
   * Check correlation rules for error patterns
   */
  private async checkCorrelationRules(entry: ErrorTrackingEntry): Promise<void> {
    for (const rule of this.patternConfig.correlationRules) {
      if (!rule.pattern.test(entry.error.errorCode)) {
        continue;
      }

      try {
        const correlatedErrors = await this.storage.getByErrorCode(
          entry.error.errorCode,
          rule.timeWindow,
        );

        if (correlatedErrors.length >= rule.threshold) {
          const correlationGroup = FingerprintGenerator.generateCorrelationGroup(rule.name);

          // Update all correlated errors with the correlation group
          await this.updateCorrelatedErrors(correlatedErrors, correlationGroup);

          const data: CorrelationFoundData = {
            rule: rule.name,
            pattern: rule.pattern.source,
            errorCode: entry.error.errorCode,
            count: correlatedErrors.length,
            correlationGroup,
          };

          this.eventEmitter.emit(ErrorTrackingEvent.ERROR_CORRELATION_FOUND, data);
        }
      } catch (error) {
        this.logger.error(
          {
            error,
            rule: rule.name,
            errorCode: entry.error.errorCode,
          },
          'Failed to check correlation rule',
        );
      }
    }
  }

  /**
   * Update correlated errors with correlation group
   */
  private async updateCorrelatedErrors(
    errors: ErrorTrackingEntry[],
    correlationGroup: string,
  ): Promise<void> {
    const updatePromises = errors.map((error) =>
      this.storage.updateEntry(error.id, { correlationGroup }),
    );

    await Promise.all(updatePromises);
  }
}
