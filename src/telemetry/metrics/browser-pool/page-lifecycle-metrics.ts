/**
 * Page lifecycle metrics for browser pool
 * @module telemetry/metrics/browser-pool/page-lifecycle-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { Counter, Histogram, UpDownCounter, Meter } from '@opentelemetry/api';

/**
 * Page lifecycle metrics
 */
export class PageLifecycleMetrics {
  readonly pageCreated: Counter;
  readonly pageClosed: Counter;
  readonly pageNavigated: Counter;
  readonly pageCreationDuration: Histogram;
  readonly pageLifetime: Histogram;
  readonly activePages: UpDownCounter;

  constructor(meter: Meter) {
    // Initialize page lifecycle metrics
    this.pageCreated = meter.createCounter('page_created_total', {
      description: 'Total number of pages created',
      unit: '1',
    });
    
    this.pageClosed = meter.createCounter('page_closed_total', {
      description: 'Total number of pages closed',
      unit: '1',
    });
    
    this.pageNavigated = meter.createCounter('page_navigated_total', {
      description: 'Total number of page navigations',
      unit: '1',
    });
    
    this.pageCreationDuration = meter.createHistogram('page_creation_duration_ms', {
      description: 'Page creation duration in milliseconds',
      unit: 'ms',
    });
    
    this.pageLifetime = meter.createHistogram('page_lifetime_seconds', {
      description: 'Page lifetime in seconds',
      unit: 's',
    });
    
    this.activePages = meter.createUpDownCounter('page_active', {
      description: 'Number of active pages',
      unit: '1',
    });
  }

  /**
   * Record page creation
   */
  recordPageCreation(duration: number, success: boolean): void {
    const labels = {
      success: success.toString(),
    };
    
    this.pageCreated.add(1, labels);
    this.pageCreationDuration.record(duration, labels);
    
    if (success) {
      this.activePages.add(1);
    }
  }

  /**
   * Record page close
   */
  recordPageClose(lifetime: number): void {
    this.pageClosed.add(1);
    this.pageLifetime.record(lifetime / 1000); // Convert to seconds
    this.activePages.add(-1);
  }

  /**
   * Record page navigation
   */
  recordPageNavigation(url: string, success: boolean): void {
    const labels = {
      success: success.toString(),
      domain: new URL(url).hostname,
    };
    
    this.pageNavigated.add(1, labels);
  }
}