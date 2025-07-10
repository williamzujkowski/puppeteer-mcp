/**
 * Metrics collection and aggregation
 * @module telemetry/instrumentations/puppeteer/metrics-collector
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { BrowserPoolMetrics } from '../../metrics/browser-pool.js';
import type { PerformanceMetric, ErrorType, BrowserOperation, PageOperation } from './types.js';

/**
 * Metrics collector for Puppeteer operations
 */
export class PuppeteerMetricsCollector {
  constructor(private metrics?: BrowserPoolMetrics) {}

  /**
   * Record browser lifecycle metrics
   */
  recordBrowserLifecycle(
    operation: BrowserOperation,
    duration: number,
    success: boolean,
    additionalData?: Record<string, any>,
  ): void {
    if (!this.metrics) return;

    switch (operation) {
      case 'launch':
        this.metrics.recordBrowserLaunch(duration, success);
        break;
      case 'close':
        this.metrics.recordBrowserClose(
          additionalData?.lifetime ?? duration,
          success ? 'normal' : 'crash',
        );
        break;
      case 'newPage':
        this.metrics.recordPageCreation(duration, success);
        break;
    }
  }

  /**
   * Record page lifecycle metrics
   */
  recordPageLifecycle(
    operation: PageOperation,
    duration: number,
    success: boolean,
    additionalData?: Record<string, any>,
  ): void {
    if (!this.metrics) return;

    switch (operation) {
      case 'goto':
        this.metrics.recordPageNavigation(additionalData?.url ?? 'unknown', duration, success);
        break;
      case 'close':
        this.metrics.recordPageClose(additionalData?.lifetime ?? duration);
        break;
    }
  }

  /**
   * Record browser action metrics
   */
  recordBrowserAction(
    action: PageOperation,
    duration: number,
    success: boolean,
    format?: string,
  ): void {
    if (!this.metrics) return;

    switch (action) {
      case 'screenshot':
        this.metrics.recordScreenshot(duration, format ?? 'png', success);
        break;
      case 'pdf':
        this.metrics.recordPdfGeneration(duration, success);
        break;
      case 'evaluate':
        this.metrics.recordJavaScriptExecution(duration, success);
        break;
    }
  }

  /**
   * Record error metrics
   */
  recordError(errorType: ErrorType, operation: string, _message?: string): void {
    if (!this.metrics) return;

    switch (errorType) {
      case 'timeout':
        this.metrics.recordTimeoutError(operation);
        break;
      // Add more error type handling as needed
    }
  }

  /**
   * Record performance metrics
   */
  recordPerformance(
    _metric: PerformanceMetric,
    _value: number,
    _tags?: Record<string, string>,
  ): void {
    if (!this.metrics) return;

    // Custom performance recording logic
    // This would depend on the specific metrics infrastructure
  }

  /**
   * Record network metrics
   */
  recordNetwork(options: {
    url: string;
    method: string;
    statusCode?: number;
    duration?: number;
    requestSize?: number;
    responseSize?: number;
  }): void {
    if (!this.metrics) return;

    // Network metrics recording logic
    // This would typically integrate with network monitoring
    // Network metrics would be recorded here
    void options; // Prevent unused parameter warning
  }

  /**
   * Aggregate metrics for reporting
   */
  getAggregatedMetrics(): Record<string, any> {
    if (!this.metrics) return {};

    // Return aggregated metrics data
    return {
      timestamp: Date.now(),
      // Add specific metrics aggregation logic here
    };
  }
}

/**
 * Create metrics recorder function
 */
export function createMetricsRecorder(
  metrics?: BrowserPoolMetrics,
): (operation: string, duration: number, success: boolean, ...args: any[]) => void {
  const collector = new PuppeteerMetricsCollector(metrics);

  return (operation: string, duration: number, success: boolean, ...args: any[]): void => {
    try {
      // Parse operation to determine type and record appropriately
      if (operation.startsWith('browser.')) {
        const browserOp = operation.split('.')[1] as BrowserOperation;
        collector.recordBrowserLifecycle(browserOp, duration, success, args[0]);
      } else if (operation.startsWith('page.')) {
        const pageOp = operation.split('.')[1] as PageOperation;
        collector.recordPageLifecycle(pageOp, duration, success, args[0]);
      } else {
        // Generic action recording
        collector.recordBrowserAction(operation as PageOperation, duration, success, args[0]);
      }
    } catch (error) {
      // Fail silently for metrics - don't break the main operation
      console.warn('Failed to record metrics:', error);
    }
  };
}

/**
 * Performance timing helper
 */
export class PerformanceTimer {
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Mark a point in time
   */
  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  /**
   * Get duration from start
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get duration between marks
   */
  getDurationBetween(start: string, end: string): number {
    const startTime = this.marks.get(start);
    const endTime = this.marks.get(end);

    if (!startTime || !endTime) {
      throw new Error(`Mark not found: ${start} or ${end}`);
    }

    return endTime - startTime;
  }

  /**
   * Get all timing data
   */
  getAllTimings(): Record<string, number> {
    const timings: Record<string, number> = {
      total: this.getDuration(),
    };

    this.marks.forEach((time, name) => {
      // eslint-disable-next-line security/detect-object-injection
      timings[name] = time - this.startTime;
    });

    return timings;
  }
}

/**
 * Create performance timer
 */
export function createTimer(): PerformanceTimer {
  return new PerformanceTimer();
}
