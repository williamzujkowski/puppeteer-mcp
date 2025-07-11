/**
 * Metrics reporter for exporting and formatting metrics
 * @module puppeteer/pool/metrics/metrics-reporter
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist au-7 "Audit reduction and report generation"
 */

import type { ExtendedPoolMetrics, MetricObserver, MetricEvent } from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('metrics-reporter');

/**
 * Report format options
 */
export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
  PROMETHEUS = 'prometheus',
  SUMMARY = 'summary',
}

/**
 * Reporter configuration
 */
export interface ReporterConfig {
  format?: ReportFormat;
  includeTimeSeries?: boolean;
  includeMetadata?: boolean;
}

/**
 * Metrics reporter for various output formats
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist au-7 "Audit reduction and report generation"
 */
export class MetricsReporter implements MetricObserver {
  private readonly config: Required<ReporterConfig>;
  private readonly events: MetricEvent[] = [];
  private readonly maxEvents = 1000;

  constructor(config: ReporterConfig = {}) {
    this.config = {
      format: config.format ?? ReportFormat.JSON,
      includeTimeSeries: config.includeTimeSeries ?? false,
      includeMetadata: config.includeMetadata ?? true,
    };
  }

  /**
   * Update method for observer pattern
   */
  update(event: MetricEvent): void {
    this.events.push(event);

    // Limit event history
    while (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    logger.debug({ event }, 'Metric event recorded');
  }

  /**
   * Generate report in specified format
   * @nist au-7 "Audit reduction and report generation"
   */
  generateReport(metrics: ExtendedPoolMetrics): string {
    switch (this.config.format) {
      case ReportFormat.JSON:
        return this.toJSON(metrics);
      case ReportFormat.CSV:
        return this.toCSV(metrics);
      case ReportFormat.PROMETHEUS:
        return this.toPrometheus(metrics);
      case ReportFormat.SUMMARY:
        return this.toSummary(metrics);
      default:
        throw new Error(`Unsupported format: ${this.config.format as string}`);
    }
  }

  /**
   * Export metrics as JSON
   * @private
   */
  private toJSON(metrics: ExtendedPoolMetrics): string {
    const data: Record<string, unknown> = {
      ...metrics,
    };

    if (!this.config.includeTimeSeries) {
      delete data.timeSeries;
    }

    if (this.config.includeMetadata) {
      data._metadata = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        eventCount: this.events.length,
      };
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Export metrics as CSV
   * @private
   */
  private toCSV(metrics: ExtendedPoolMetrics): string {
    const rows: string[] = [];
    const timestamp = new Date().toISOString();

    // Header
    rows.push('timestamp,metric,value');

    // Pool metrics
    rows.push(`${timestamp},total_browsers,${metrics.totalBrowsers}`);
    rows.push(`${timestamp},active_browsers,${metrics.activeBrowsers}`);
    rows.push(`${timestamp},idle_browsers,${metrics.idleBrowsers}`);
    rows.push(`${timestamp},total_pages,${metrics.totalPages}`);
    rows.push(`${timestamp},active_pages,${metrics.activePages}`);
    rows.push(`${timestamp},browsers_created,${metrics.browsersCreated}`);
    rows.push(`${timestamp},browsers_destroyed,${metrics.browsersDestroyed}`);
    rows.push(`${timestamp},avg_browser_lifetime,${metrics.avgBrowserLifetime}`);
    rows.push(`${timestamp},utilization_percentage,${metrics.utilizationPercentage}`);

    // Queue metrics
    rows.push(`${timestamp},queue_length,${metrics.queue.queueLength}`);
    rows.push(`${timestamp},avg_wait_time,${metrics.queue.averageWaitTime}`);
    rows.push(`${timestamp},max_wait_time,${metrics.queue.maxWaitTime}`);

    // Error metrics
    rows.push(`${timestamp},total_errors,${metrics.errors.totalErrors}`);
    rows.push(`${timestamp},error_rate,${metrics.errors.errorRate}`);
    rows.push(`${timestamp},recovery_successes,${metrics.errors.recoverySuccesses}`);
    rows.push(`${timestamp},recovery_failures,${metrics.errors.recoveryFailures}`);

    // Performance metrics
    rows.push(`${timestamp},avg_page_creation_time,${metrics.avgPageCreationTime}`);
    rows.push(`${timestamp},avg_page_destruction_time,${metrics.avgPageDestructionTime}`);

    // Resource metrics
    rows.push(`${timestamp},total_cpu_usage,${metrics.resources.totalCpuUsage}`);
    rows.push(`${timestamp},total_memory_usage,${metrics.resources.totalMemoryUsage}`);
    rows.push(`${timestamp},avg_cpu_per_browser,${metrics.resources.avgCpuPerBrowser}`);
    rows.push(`${timestamp},avg_memory_per_browser,${metrics.resources.avgMemoryPerBrowser}`);

    return rows.join('\n');
  }

  /**
   * Export metrics in Prometheus format
   * @private
   */
  private toPrometheus(metrics: ExtendedPoolMetrics): string {
    const lines: string[] = [];
    const timestamp = Date.now();

    // Pool metrics
    lines.push(`# HELP browser_pool_total Total number of browsers in pool`);
    lines.push(`# TYPE browser_pool_total gauge`);
    lines.push(`browser_pool_total ${metrics.totalBrowsers} ${timestamp}`);

    lines.push(`# HELP browser_pool_active Number of active browsers`);
    lines.push(`# TYPE browser_pool_active gauge`);
    lines.push(`browser_pool_active ${metrics.activeBrowsers} ${timestamp}`);

    lines.push(`# HELP browser_pool_utilization Pool utilization percentage`);
    lines.push(`# TYPE browser_pool_utilization gauge`);
    lines.push(`browser_pool_utilization ${metrics.utilizationPercentage} ${timestamp}`);

    // Queue metrics
    lines.push(`# HELP browser_pool_queue_length Current queue length`);
    lines.push(`# TYPE browser_pool_queue_length gauge`);
    lines.push(`browser_pool_queue_length ${metrics.queue.queueLength} ${timestamp}`);

    lines.push(`# HELP browser_pool_queue_wait_time_avg Average queue wait time`);
    lines.push(`# TYPE browser_pool_queue_wait_time_avg gauge`);
    lines.push(`browser_pool_queue_wait_time_avg ${metrics.queue.averageWaitTime} ${timestamp}`);

    // Error metrics
    lines.push(`# HELP browser_pool_errors_total Total number of errors`);
    lines.push(`# TYPE browser_pool_errors_total counter`);
    lines.push(`browser_pool_errors_total ${metrics.errors.totalErrors} ${timestamp}`);

    lines.push(`# HELP browser_pool_error_rate Current error rate percentage`);
    lines.push(`# TYPE browser_pool_error_rate gauge`);
    lines.push(`browser_pool_error_rate ${metrics.errors.errorRate} ${timestamp}`);

    return lines.join('\n');
  }

  /**
   * Generate human-readable summary
   * @private
   */
  private toSummary(metrics: ExtendedPoolMetrics): string {
    const lines: string[] = [
      '=== Browser Pool Metrics Summary ===',
      '',
      `Pool Status:`,
      `  Total Browsers: ${metrics.totalBrowsers}`,
      `  Active: ${metrics.activeBrowsers}, Idle: ${metrics.idleBrowsers}`,
      `  Utilization: ${metrics.utilizationPercentage.toFixed(1)}%`,
      `  Total Pages: ${metrics.totalPages}`,
      '',
      `Lifecycle:`,
      `  Created: ${metrics.browsersCreated}`,
      `  Destroyed: ${metrics.browsersDestroyed}`,
      `  Avg Lifetime: ${metrics.avgBrowserLifetime.toFixed(0)}ms`,
      '',
      `Queue:`,
      `  Length: ${metrics.queue.queueLength}`,
      `  Avg Wait: ${metrics.queue.averageWaitTime.toFixed(0)}ms`,
      `  Max Wait: ${metrics.queue.maxWaitTime.toFixed(0)}ms`,
      '',
      `Performance:`,
      `  Avg Page Creation: ${metrics.avgPageCreationTime.toFixed(0)}ms`,
      `  Avg Page Destruction: ${metrics.avgPageDestructionTime.toFixed(0)}ms`,
      `  Health Check Success: ${metrics.healthCheck.successRate.toFixed(1)}%`,
      '',
      `Errors:`,
      `  Total: ${metrics.errors.totalErrors}`,
      `  Rate: ${metrics.errors.errorRate.toFixed(2)}%`,
      `  Recovery Success: ${metrics.errors.recoverySuccesses}`,
      `  Recovery Failed: ${metrics.errors.recoveryFailures}`,
      '',
      `Resources:`,
      `  Total CPU: ${metrics.resources.totalCpuUsage.toFixed(1)}%`,
      `  Total Memory: ${(metrics.resources.totalMemoryUsage / 1024 / 1024).toFixed(1)}MB`,
      `  Avg CPU/Browser: ${metrics.resources.avgCpuPerBrowser.toFixed(1)}%`,
      `  Avg Memory/Browser: ${(metrics.resources.avgMemoryPerBrowser / 1024 / 1024).toFixed(1)}MB`,
    ];

    if (metrics.errors.lastError) {
      lines.push(
        '',
        `Last Error:`,
        `  Type: ${metrics.errors.lastError.type}`,
        `  Time: ${metrics.errors.lastError.timestamp.toISOString()}`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 100): MetricEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Clear event history
   */
  clearEvents(): void {
    this.events.length = 0;
    logger.info('Event history cleared');
  }
}
