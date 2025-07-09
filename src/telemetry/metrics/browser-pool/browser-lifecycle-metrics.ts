/**
 * Browser lifecycle metrics for browser pool
 * @module telemetry/metrics/browser-pool/browser-lifecycle-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { Counter, Histogram, UpDownCounter, Meter } from '@opentelemetry/api';
import type { BrowserCloseReason } from './types.js';

/**
 * Browser lifecycle metrics
 */
export class BrowserLifecycleMetrics {
  readonly browserLaunched: Counter;
  readonly browserClosed: Counter;
  readonly browserCrashed: Counter;
  readonly browserLaunchDuration: Histogram;
  readonly browserLifetime: Histogram;
  readonly activeBrowsers: UpDownCounter;

  constructor(meter: Meter) {
    // Initialize browser lifecycle metrics
    this.browserLaunched = meter.createCounter('browser_launched_total', {
      description: 'Total number of browsers launched',
      unit: '1',
    });
    
    this.browserClosed = meter.createCounter('browser_closed_total', {
      description: 'Total number of browsers closed',
      unit: '1',
    });
    
    this.browserCrashed = meter.createCounter('browser_crashed_total', {
      description: 'Total number of browser crashes',
      unit: '1',
    });
    
    this.browserLaunchDuration = meter.createHistogram('browser_launch_duration_ms', {
      description: 'Browser launch duration in milliseconds',
      unit: 'ms',
    });
    
    this.browserLifetime = meter.createHistogram('browser_lifetime_seconds', {
      description: 'Browser lifetime in seconds',
      unit: 's',
    });
    
    this.activeBrowsers = meter.createUpDownCounter('browser_active', {
      description: 'Number of active browsers',
      unit: '1',
    });
  }

  /**
   * Record browser launch
   */
  recordBrowserLaunch(duration: number, success: boolean): void {
    const labels = {
      success: success.toString(),
    };
    
    this.browserLaunched.add(1, labels);
    this.browserLaunchDuration.record(duration, labels);
    
    if (success) {
      this.activeBrowsers.add(1);
    }
  }

  /**
   * Record browser close
   */
  recordBrowserClose(lifetime: number, reason: BrowserCloseReason): void {
    const labels = {
      reason,
    };
    
    this.browserClosed.add(1, labels);
    this.browserLifetime.record(lifetime / 1000, labels); // Convert to seconds
    this.activeBrowsers.add(-1);
    
    if (reason === 'crash') {
      this.browserCrashed.add(1);
    }
  }
}