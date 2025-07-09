/**
 * Performance metrics for browser pool
 * @module telemetry/metrics/browser-pool/performance-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { Histogram, Meter } from '@opentelemetry/api';
import type { ScreenshotFormat } from './types.js';

/**
 * Performance metrics
 */
export class PerformanceMetrics {
  readonly javascriptExecutionTime: Histogram;
  readonly screenshotDuration: Histogram;
  readonly pdfGenerationDuration: Histogram;

  constructor(meter: Meter) {
    // Initialize performance metrics
    this.javascriptExecutionTime = meter.createHistogram('browser_js_execution_duration_ms', {
      description: 'JavaScript execution time in milliseconds',
      unit: 'ms',
    });
    
    this.screenshotDuration = meter.createHistogram('browser_screenshot_duration_ms', {
      description: 'Screenshot capture duration in milliseconds',
      unit: 'ms',
    });
    
    this.pdfGenerationDuration = meter.createHistogram('browser_pdf_generation_duration_ms', {
      description: 'PDF generation duration in milliseconds',
      unit: 'ms',
    });
  }

  /**
   * Record JavaScript execution
   */
  recordJavaScriptExecution(duration: number, success: boolean): void {
    const labels = {
      success: success.toString(),
    };
    
    this.javascriptExecutionTime.record(duration, labels);
  }

  /**
   * Record screenshot capture
   */
  recordScreenshot(duration: number, format: ScreenshotFormat, success: boolean): void {
    const labels = {
      format,
      success: success.toString(),
    };
    
    this.screenshotDuration.record(duration, labels);
  }

  /**
   * Record PDF generation
   */
  recordPdfGeneration(duration: number, success: boolean): void {
    const labels = {
      success: success.toString(),
    };
    
    this.pdfGenerationDuration.record(duration, labels);
  }
}