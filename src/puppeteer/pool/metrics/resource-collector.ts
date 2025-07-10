/**
 * Resource metrics collector for browser pool
 * @module puppeteer/pool/metrics/resource-collector
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import { BaseMetricCollector } from './base-collector.js';
import {
  MetricEventType,
} from './types.js';
import type {
  ResourceMetrics,
  AggregatedResourceMetrics,
  MetricCollector,
  MetricDataPoint,
} from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('resource-collector');

/**
 * Collects resource utilization metrics
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */
export class ResourceMetricsCollector
  extends BaseMetricCollector
  implements MetricCollector<AggregatedResourceMetrics>
{
  private resourceMetrics: Map<string, ResourceMetrics> = new Map();
  private utilizationHistory: MetricDataPoint[] = [];

  /**
   * Update resource usage for a browser
   * @nist si-4 "Information system monitoring"
   */
  updateResourceUsage(
    browserId: string,
    cpuUsage: number,
    memoryUsage: number
  ): void {
    const metrics: ResourceMetrics = {
      browserId,
      cpuUsage,
      memoryUsage,
      timestamp: new Date(),
    };

    this.resourceMetrics.set(browserId, metrics);

    logger.debug(
      { browserId, cpuUsage, memoryUsage },
      'Resource usage updated'
    );

    this.notify({
      type: MetricEventType.RESOURCE_UPDATED,
      timestamp: new Date(),
      data: { browserId, cpuUsage, memoryUsage },
    });
  }

  /**
   * Remove resource metrics for a browser
   */
  removeBrowserMetrics(browserId: string): void {
    this.resourceMetrics.delete(browserId);
    logger.debug({ browserId }, 'Browser resource metrics removed');
  }

  /**
   * Record current utilization percentage
   * @nist si-4 "Information system monitoring"
   */
  recordUtilization(utilization: number): void {
    this.addTimeSeriesDataPoint(this.utilizationHistory, utilization);

    logger.debug({ utilization }, 'Utilization recorded');

    this.notify({
      type: MetricEventType.UTILIZATION_RECORDED,
      timestamp: new Date(),
      data: { utilization },
    });
  }

  /**
   * Get utilization history
   */
  getUtilizationHistory(): MetricDataPoint[] {
    return [...this.utilizationHistory];
  }

  /**
   * Get current resource metrics for all browsers
   */
  getCurrentResourceMetrics(): ResourceMetrics[] {
    return Array.from(this.resourceMetrics.values());
  }

  /**
   * Collect aggregated resource metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  collect(): AggregatedResourceMetrics {
    const activeMetrics = Array.from(this.resourceMetrics.values());

    const totalCpu = activeMetrics.reduce((sum, m) => sum + m.cpuUsage, 0);
    const totalMemory = activeMetrics.reduce(
      (sum, m) => sum + m.memoryUsage,
      0
    );
    const count = activeMetrics.length;

    return {
      totalCpuUsage: totalCpu,
      totalMemoryUsage: totalMemory,
      avgCpuPerBrowser: count > 0 ? totalCpu / count : 0,
      avgMemoryPerBrowser: count > 0 ? totalMemory / count : 0,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.resourceMetrics.clear();
    this.utilizationHistory = [];

    logger.info('Resource metrics reset');
  }
}