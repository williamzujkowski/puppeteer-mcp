/**
 * Error analytics utilities
 * @module core/errors/error-analytics
 * @nist au-3 "Content of Audit Records"
 */

import { ErrorSeverity } from './error-context.js';
import { ErrorTracker } from './error-tracker.js';

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
