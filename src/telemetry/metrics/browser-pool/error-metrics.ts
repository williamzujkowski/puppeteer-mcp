/**
 * Error tracking metrics for browser pool
 * @module telemetry/metrics/browser-pool/error-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { Counter, Meter } from '@opentelemetry/api';

/**
 * Error tracking metrics
 */
export class ErrorMetrics {
  readonly navigationErrors: Counter;
  readonly evaluationErrors: Counter;
  readonly timeoutErrors: Counter;
  readonly poolExhaustedErrors: Counter;

  constructor(meter: Meter) {
    // Initialize error metrics
    this.navigationErrors = meter.createCounter('browser_navigation_errors_total', {
      description: 'Total number of navigation errors',
      unit: '1',
    });
    
    this.evaluationErrors = meter.createCounter('browser_evaluation_errors_total', {
      description: 'Total number of JavaScript evaluation errors',
      unit: '1',
    });
    
    this.timeoutErrors = meter.createCounter('browser_timeout_errors_total', {
      description: 'Total number of timeout errors',
      unit: '1',
    });
    
    this.poolExhaustedErrors = meter.createCounter('pool_exhausted_errors_total', {
      description: 'Total number of pool exhaustion errors',
      unit: '1',
    });
  }

  /**
   * Record navigation error
   */
  recordNavigationError(url: string): void {
    const labels = {
      domain: new URL(url).hostname,
    };
    
    this.navigationErrors.add(1, labels);
  }

  /**
   * Record evaluation error
   */
  recordEvaluationError(): void {
    this.evaluationErrors.add(1);
  }

  /**
   * Record timeout error
   */
  recordTimeoutError(operation: string): void {
    this.timeoutErrors.add(1, { operation });
  }

  /**
   * Record pool exhausted error
   */
  recordPoolExhaustedError(): void {
    this.poolExhaustedErrors.add(1);
  }
}