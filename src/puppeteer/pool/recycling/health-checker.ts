/**
 * Browser health monitoring and assessment
 * @module puppeteer/pool/recycling/health-checker
 * @nist si-4 "Information system monitoring"
 */

import { createLogger } from '../../../utils/logger.js';
import type { BrowserHealthMetrics } from './types.js';

const logger = createLogger('browser-health-checker');

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  responsive: boolean;
  responseTimeMs?: number;
  errors?: string[];
  warnings?: string[];
}

/**
 * Browser health checker
 * @nist si-4 "Information system monitoring"
 */
export class BrowserHealthChecker {
  private healthMetrics: Map<string, BrowserHealthMetrics> = new Map();

  /**
   * Update health metrics for a browser
   */
  updateHealthMetrics(browserId: string, healthResult: HealthCheckResult): void {
    const existing = this.healthMetrics.get(browserId);
    const metrics = this.buildHealthMetrics(browserId, healthResult, existing);
    this.healthMetrics.set(browserId, metrics);

    logger.debug(
      {
        browserId,
        overallHealth: metrics.overallHealth,
        consecutiveFailures: metrics.consecutiveFailures,
        failureRate: metrics.failureRate,
      },
      'Health metrics updated'
    );
  }

  /**
   * Get health metrics for a browser
   */
  getHealthMetrics(browserId: string): BrowserHealthMetrics | undefined {
    return this.healthMetrics.get(browserId);
  }

  /**
   * Get all health metrics
   */
  getAllHealthMetrics(): Map<string, BrowserHealthMetrics> {
    return new Map(this.healthMetrics);
  }

  /**
   * Clear health metrics for a browser
   */
  clearHealthMetrics(browserId: string): void {
    this.healthMetrics.delete(browserId);
  }

  /**
   * Check if browser is healthy based on metrics
   */
  isBrowserHealthy(browserId: string, healthThreshold: number): boolean {
    const metrics = this.healthMetrics.get(browserId);
    if (!metrics) {
      return true; // Assume healthy if no metrics yet
    }

    return metrics.overallHealth >= healthThreshold;
  }

  /**
   * Calculate overall health score
   * @private
   */
  private calculateOverallHealth(
    result: HealthCheckResult, 
    existing?: BrowserHealthMetrics
  ): number {
    let score = 100;

    // Base health from result
    if (!result.healthy) {
      score -= 50;
    }

    // Responsiveness penalty
    if (!result.responsive) {
      score -= 30;
    }

    // Error penalty
    if (result.errors && result.errors.length > 0) {
      score -= Math.min(20, result.errors.length * 5);
    }

    // Historical penalty
    if (existing) {
      // Consecutive failures penalty
      if (existing.consecutiveFailures > 0) {
        score -= Math.min(20, existing.consecutiveFailures * 5);
      }

      // High failure rate penalty
      if (existing.failureRate > 10) {
        score -= Math.min(15, existing.failureRate);
      }
    }

    return Math.max(0, score);
  }

  /**
   * Calculate stability score
   * @private
   */
  private calculateStability(
    result: HealthCheckResult,
    existing?: BrowserHealthMetrics
  ): number {
    let score = existing?.stability ?? 100;

    // Adjust based on health result
    if (!result.healthy) {
      score = Math.max(0, score - 10);
    } else if (score < 100) {
      score = Math.min(100, score + 5);
    }

    // Error impact
    if (result.errors && result.errors.length > 0) {
      score = Math.max(0, score - result.errors.length * 2);
    }

    return score;
  }

  /**
   * Calculate performance score
   * @private
   */
  private calculatePerformance(
    result: HealthCheckResult,
    existing?: BrowserHealthMetrics
  ): number {
    let score = existing?.performance ?? 100;

    // Response time impact
    if (result.responseTimeMs !== undefined && result.responseTimeMs !== null) {
      if (result.responseTimeMs > 5000) {
        score = Math.max(0, score - 20);
      } else if (result.responseTimeMs > 2000) {
        score = Math.max(0, score - 10);
      } else if (result.responseTimeMs < 500) {
        score = Math.min(100, score + 5);
      }
    }

    return score;
  }

  /**
   * Calculate average response time
   * @private
   */
  private calculateAvgResponseTime(
    result: HealthCheckResult,
    existing?: BrowserHealthMetrics
  ): number {
    if (result.responseTimeMs === undefined || result.responseTimeMs === null) {
      return existing?.avgResponseTime ?? 0;
    }

    if (!existing || existing.totalHealthChecks === 0) {
      return result.responseTimeMs;
    }

    // Weighted average with more weight on recent measurements
    const weight = 0.3; // 30% weight for new measurement
    return existing.avgResponseTime * (1 - weight) + result.responseTimeMs * weight;
  }

  /**
   * Build health metrics object
   * @private
   */
  private buildHealthMetrics(
    browserId: string,
    healthResult: HealthCheckResult,
    existing?: BrowserHealthMetrics
  ): BrowserHealthMetrics {
    const counts = this.calculateCounts(healthResult, existing);
    
    const metrics: BrowserHealthMetrics = {
      browserId,
      overallHealth: this.calculateOverallHealth(healthResult, existing),
      responsiveness: healthResult.responsive ? 100 : 0,
      stability: this.calculateStability(healthResult, existing),
      performance: this.calculatePerformance(healthResult, existing),
      lastHealthCheck: new Date(),
      consecutiveFailures: counts.consecutiveFailures,
      totalHealthChecks: counts.totalHealthChecks,
      failureRate: this.calculateFailureRate(
        counts.consecutiveFailures,
        existing?.errorCount ?? 0,
        counts.totalHealthChecks
      ),
      avgResponseTime: this.calculateAvgResponseTime(healthResult, existing),
      errorCount: counts.errorCount,
      warningCount: counts.warningCount,
    };

    return metrics;
  }

  /**
   * Calculate counts
   * @private
   */
  private calculateCounts(
    healthResult: HealthCheckResult,
    existing?: BrowserHealthMetrics
  ): {
    consecutiveFailures: number;
    totalHealthChecks: number;
    errorCount: number;
    warningCount: number;
  } {
    const existingFailures = existing?.consecutiveFailures ?? 0;
    const existingTotal = existing?.totalHealthChecks ?? 0;
    const existingErrors = existing?.errorCount ?? 0;
    const existingWarnings = existing?.warningCount ?? 0;
    const newErrors = healthResult.errors?.length ?? 0;
    const newWarnings = healthResult.warnings?.length ?? 0;
    
    return {
      consecutiveFailures: healthResult.healthy ? 0 : existingFailures + 1,
      totalHealthChecks: existingTotal + 1,
      errorCount: existingErrors + newErrors,
      warningCount: existingWarnings + newWarnings,
    };
  }

  /**
   * Calculate failure rate
   * @private
   */
  private calculateFailureRate(
    consecutiveFailures: number,
    errorCount: number,
    totalHealthChecks: number
  ): number {
    if (totalHealthChecks === 0) {
      return 0;
    }
    const failures = consecutiveFailures + errorCount;
    return (failures / totalHealthChecks) * 100;
  }
}