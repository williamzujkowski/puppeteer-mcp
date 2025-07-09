/**
 * Pool management metrics for browser pool
 * @module telemetry/metrics/browser-pool/pool-management-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { Counter, Histogram, ObservableGauge, Meter, ObservableResult } from '@opentelemetry/api';
import type { BrowserPoolProvider } from './types.js';

/**
 * Pool management metrics
 */
export class PoolManagementMetrics {
  readonly poolAcquisitions: Counter;
  readonly poolReleases: Counter;
  readonly poolAcquisitionDuration: Histogram;
  readonly poolQueueLength: ObservableGauge;
  readonly poolUtilization: ObservableGauge;

  constructor(meter: Meter, browserPoolProvider: BrowserPoolProvider) {
    // Initialize pool management metrics
    this.poolAcquisitions = meter.createCounter('pool_acquisitions_total', {
      description: 'Total number of browser acquisitions from pool',
      unit: '1',
    });
    
    this.poolReleases = meter.createCounter('pool_releases_total', {
      description: 'Total number of browser releases to pool',
      unit: '1',
    });
    
    this.poolAcquisitionDuration = meter.createHistogram('pool_acquisition_duration_ms', {
      description: 'Time to acquire browser from pool in milliseconds',
      unit: 'ms',
    });
    
    // Observable gauges for pool state
    this.poolQueueLength = meter.createObservableGauge('pool_queue_length', {
      description: 'Number of requests waiting in queue',
      unit: '1',
    });
    
    this.poolUtilization = meter.createObservableGauge('pool_utilization_ratio', {
      description: 'Pool utilization ratio (0-1)',
      unit: '1',
    });
    
    // Add callbacks for observable gauges
    this.poolQueueLength.addCallback((result: ObservableResult) => {
      const metrics = browserPoolProvider.getPoolMetrics();
      result.observe(metrics.queueLength);
    });
    
    this.poolUtilization.addCallback((result: ObservableResult) => {
      const metrics = browserPoolProvider.getPoolMetrics();
      result.observe(metrics.utilizationPercentage / 100);
    });
  }

  /**
   * Record pool acquisition
   */
  recordPoolAcquisition(duration: number, success: boolean): void {
    const labels = {
      success: success.toString(),
    };
    
    this.poolAcquisitions.add(1, labels);
    this.poolAcquisitionDuration.record(duration, labels);
  }

  /**
   * Record pool release
   */
  recordPoolRelease(): void {
    this.poolReleases.add(1);
  }
}