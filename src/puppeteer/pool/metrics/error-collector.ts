/**
 * Error metrics collector for browser pool
 * @module puppeteer/pool/metrics/error-collector
 * @nist au-3 "Content of audit records"
 * @nist au-5 "Response to audit processing failures"
 * @nist si-4 "Information system monitoring"
 */

import { BaseMetricCollector } from './base-collector.js';
import { MetricEventType } from './types.js';
import type { ErrorMetrics, MetricCollector, MetricDataPoint } from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('error-collector');

/**
 * Collects error and recovery metrics
 * @nist au-3 "Content of audit records"
 * @nist au-5 "Response to audit processing failures"
 */
export class ErrorMetricsCollector
  extends BaseMetricCollector
  implements MetricCollector<ErrorMetrics>
{
  private errorCount = 0;
  private recoverySuccesses = 0;
  private recoveryFailures = 0;
  private lastError?: { timestamp: Date; type: string; browserId?: string };
  private errorRateHistory: MetricDataPoint[] = [];
  private totalOperations = 0;

  /**
   * Record error occurrence
   * @nist au-3 "Content of audit records"
   * @nist au-5 "Response to audit processing failures"
   */
  recordError(type: string, browserId?: string): void {
    this.errorCount++;
    this.lastError = { timestamp: new Date(), type, browserId };
    this.recordErrorRate();

    logger.warn({ type, browserId }, 'Error recorded');

    this.notify({
      type: MetricEventType.ERROR_OCCURRED,
      timestamp: new Date(),
      data: { errorType: type, browserId, errorCount: this.errorCount },
    });
  }

  /**
   * Record recovery attempt result
   * @nist au-3 "Content of audit records"
   */
  recordRecovery(success: boolean, browserId: string): void {
    if (success) {
      this.recoverySuccesses++;
    } else {
      this.recoveryFailures++;
    }

    logger.info({ success, browserId }, 'Recovery attempt recorded');

    this.notify({
      type: MetricEventType.RECOVERY_ATTEMPTED,
      timestamp: new Date(),
      data: {
        success,
        browserId,
        recoverySuccesses: this.recoverySuccesses,
        recoveryFailures: this.recoveryFailures,
      },
    });
  }

  /**
   * Increment total operations count (for error rate calculation)
   */
  incrementOperations(count = 1): void {
    this.totalOperations += count;
  }

  /**
   * Get error rate history
   */
  getErrorRateHistory(): MetricDataPoint[] {
    return [...this.errorRateHistory];
  }

  /**
   * Collect error metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  collect(): ErrorMetrics {
    const errorRate = this.totalOperations > 0 ? (this.errorCount / this.totalOperations) * 100 : 0;

    return {
      totalErrors: this.errorCount,
      errorRate,
      recoverySuccesses: this.recoverySuccesses,
      recoveryFailures: this.recoveryFailures,
      lastError: this.lastError,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.errorCount = 0;
    this.recoverySuccesses = 0;
    this.recoveryFailures = 0;
    this.lastError = undefined;
    this.errorRateHistory = [];
    this.totalOperations = 0;

    logger.info('Error metrics reset');
  }

  /**
   * Record current error rate for time series
   * @private
   */
  private recordErrorRate(): void {
    const rate = this.totalOperations > 0 ? (this.errorCount / this.totalOperations) * 100 : 0;
    this.addTimeSeriesDataPoint(this.errorRateHistory, rate);
  }
}
