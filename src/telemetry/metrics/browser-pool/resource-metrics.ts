/**
 * Resource usage metrics for browser pool
 * @module telemetry/metrics/browser-pool/resource-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { Histogram, ObservableGauge, Meter, ObservableResult } from '@opentelemetry/api';
import type { BrowserPoolProvider, NetworkDirection } from './types.js';

/**
 * Resource usage metrics
 */
export class ResourceMetrics {
  readonly memoryUsage: ObservableGauge;
  readonly cpuUsage: ObservableGauge;
  readonly networkBandwidth: Histogram;

  constructor(meter: Meter, browserPoolProvider: BrowserPoolProvider) {
    // Initialize resource metrics
    this.memoryUsage = meter.createObservableGauge('browser_memory_usage_bytes', {
      description: 'Total memory usage by browsers in bytes',
      unit: 'By',
    });

    this.cpuUsage = meter.createObservableGauge('browser_cpu_usage_percent', {
      description: 'CPU usage percentage by browsers',
      unit: '1',
    });

    this.networkBandwidth = meter.createHistogram('browser_network_bandwidth_bytes', {
      description: 'Network bandwidth used by browsers in bytes',
      unit: 'By',
    });

    // Add callbacks for observable gauges
    this.memoryUsage.addCallback((result: ObservableResult) => {
      const metrics = browserPoolProvider.getPoolMetrics();
      result.observe(metrics.memoryUsage);
    });

    this.cpuUsage.addCallback((result: ObservableResult) => {
      const metrics = browserPoolProvider.getPoolMetrics();
      result.observe(metrics.cpuUsage);
    });
  }

  /**
   * Record network usage
   */
  recordNetworkUsage(bytes: number, direction: NetworkDirection): void {
    this.networkBandwidth.record(bytes, { direction });
  }
}
