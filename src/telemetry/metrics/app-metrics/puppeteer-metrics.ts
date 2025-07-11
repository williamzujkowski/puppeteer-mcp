/**
 * Puppeteer metrics module
 * @module telemetry/metrics/app-metrics/puppeteer-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { Meter } from '@opentelemetry/api';
import { PuppeteerMetrics, ErrorLabels, ApiCallLabels } from './types.js';

/**
 * Puppeteer metrics implementation
 */
export class PuppeteerMetricsImpl implements PuppeteerMetrics {
  public readonly meter: Meter;
  public readonly errorsTotal;
  public readonly unhandledExceptions;
  public readonly validationErrors;
  public readonly apiCallsTotal;
  public readonly apiCallDuration;
  public readonly apiRateLimitHits;

  constructor(meter: Meter) {
    this.meter = meter;

    this.errorsTotal = meter.createCounter('errors_total', {
      description: 'Total number of errors',
      unit: '1',
    });

    this.unhandledExceptions = meter.createCounter('unhandled_exceptions_total', {
      description: 'Total number of unhandled exceptions',
      unit: '1',
    });

    this.validationErrors = meter.createCounter('validation_errors_total', {
      description: 'Total number of validation errors',
      unit: '1',
    });

    this.apiCallsTotal = meter.createCounter('api_calls_total', {
      description: 'Total number of API calls',
      unit: '1',
    });

    this.apiCallDuration = meter.createHistogram('api_call_duration_ms', {
      description: 'API call duration in milliseconds',
      unit: 'ms',
    });

    this.apiRateLimitHits = meter.createCounter('api_rate_limit_hits_total', {
      description: 'Total number of rate limit hits',
      unit: '1',
    });
  }

  /**
   * Record error
   */
  recordError(type: string, category: string, handled: boolean = true): void {
    const labels: ErrorLabels = {
      type,
      category,
      handled: handled.toString(),
    };

    this.errorsTotal.add(1, labels);

    if (!handled) {
      this.unhandledExceptions.add(1, labels);
    }
  }

  /**
   * Record validation error
   */
  recordValidationError(field: string, errorType: string, validator: string): void {
    this.validationErrors.add(1, {
      field,
      error_type: errorType,
      validator,
    });
  }

  /**
   * Record API call
   */
  recordApiCall(endpoint: string, method: string, duration: number, success: boolean): void {
    const labels: ApiCallLabels = {
      endpoint,
      method,
      success: success.toString(),
    };

    this.apiCallsTotal.add(1, labels);
    this.apiCallDuration.record(duration, labels);
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(endpoint: string, limit: number, remaining: number): void {
    this.apiRateLimitHits.add(1, {
      endpoint,
      limit: limit.toString(),
      remaining: remaining.toString(),
    });
  }

  /**
   * Record browser operation
   */
  recordBrowserOperation(operation: string, duration: number, success: boolean): void {
    const browserOperationCounter = this.meter.createCounter('browser_operations_total', {
      description: 'Total number of browser operations',
      unit: '1',
    });

    const browserOperationDuration = this.meter.createHistogram('browser_operation_duration_ms', {
      description: 'Browser operation duration in milliseconds',
      unit: 'ms',
    });

    const labels = {
      operation,
      success: success.toString(),
    };

    browserOperationCounter.add(1, labels);
    browserOperationDuration.record(duration, labels);
  }
}
