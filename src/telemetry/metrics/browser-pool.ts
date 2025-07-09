/**
 * Browser pool metrics collection
 * @module telemetry/metrics/browser-pool
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { 
  Counter, 
  Histogram, 
  UpDownCounter, 
  ObservableGauge,
  Meter,
} from '@opentelemetry/api';
import { getMeter } from '../index.js';
import type { BrowserPool } from '../../puppeteer/pool/browser-pool.js';

/**
 * Browser pool metrics
 */
export class BrowserPoolMetrics {
  private meter: Meter;
  
  // Browser lifecycle metrics
  readonly browserLaunched: Counter;
  readonly browserClosed: Counter;
  readonly browserCrashed: Counter;
  readonly browserLaunchDuration: Histogram;
  readonly browserLifetime: Histogram;
  readonly activeBrowsers: UpDownCounter;
  
  // Page lifecycle metrics
  readonly pageCreated: Counter;
  readonly pageClosed: Counter;
  readonly pageNavigated: Counter;
  readonly pageCreationDuration: Histogram;
  readonly pageLifetime: Histogram;
  readonly activePages: UpDownCounter;
  
  // Pool management metrics
  readonly poolAcquisitions: Counter;
  readonly poolReleases: Counter;
  readonly poolAcquisitionDuration: Histogram;
  readonly poolQueueLength: ObservableGauge;
  readonly poolUtilization: ObservableGauge;
  
  // Resource metrics
  readonly memoryUsage: ObservableGauge;
  readonly cpuUsage: ObservableGauge;
  readonly networkBandwidth: Histogram;
  
  // Error metrics
  readonly navigationErrors: Counter;
  readonly evaluationErrors: Counter;
  readonly timeoutErrors: Counter;
  readonly poolExhaustedErrors: Counter;
  
  // Performance metrics
  readonly javascriptExecutionTime: Histogram;
  readonly screenshotDuration: Histogram;
  readonly pdfGenerationDuration: Histogram;
  
  constructor(
    private browserPool?: BrowserPool,
    meterName: string = 'puppeteer-mcp-browser-pool',
  ) {
    this.meter = getMeter(meterName);
    
    // Initialize browser lifecycle metrics
    this.browserLaunched = this.meter.createCounter('browser_launched_total', {
      description: 'Total number of browsers launched',
      unit: '1',
    });
    
    this.browserClosed = this.meter.createCounter('browser_closed_total', {
      description: 'Total number of browsers closed',
      unit: '1',
    });
    
    this.browserCrashed = this.meter.createCounter('browser_crashed_total', {
      description: 'Total number of browser crashes',
      unit: '1',
    });
    
    this.browserLaunchDuration = this.meter.createHistogram('browser_launch_duration_ms', {
      description: 'Browser launch duration in milliseconds',
      unit: 'ms',
    });
    
    this.browserLifetime = this.meter.createHistogram('browser_lifetime_seconds', {
      description: 'Browser lifetime in seconds',
      unit: 's',
    });
    
    this.activeBrowsers = this.meter.createUpDownCounter('browser_active', {
      description: 'Number of active browsers',
      unit: '1',
    });
    
    // Initialize page lifecycle metrics
    this.pageCreated = this.meter.createCounter('page_created_total', {
      description: 'Total number of pages created',
      unit: '1',
    });
    
    this.pageClosed = this.meter.createCounter('page_closed_total', {
      description: 'Total number of pages closed',
      unit: '1',
    });
    
    this.pageNavigated = this.meter.createCounter('page_navigated_total', {
      description: 'Total number of page navigations',
      unit: '1',
    });
    
    this.pageCreationDuration = this.meter.createHistogram('page_creation_duration_ms', {
      description: 'Page creation duration in milliseconds',
      unit: 'ms',
    });
    
    this.pageLifetime = this.meter.createHistogram('page_lifetime_seconds', {
      description: 'Page lifetime in seconds',
      unit: 's',
    });
    
    this.activePages = this.meter.createUpDownCounter('page_active', {
      description: 'Number of active pages',
      unit: '1',
    });
    
    // Initialize pool management metrics
    this.poolAcquisitions = this.meter.createCounter('pool_acquisitions_total', {
      description: 'Total number of browser acquisitions from pool',
      unit: '1',
    });
    
    this.poolReleases = this.meter.createCounter('pool_releases_total', {
      description: 'Total number of browser releases to pool',
      unit: '1',
    });
    
    this.poolAcquisitionDuration = this.meter.createHistogram('pool_acquisition_duration_ms', {
      description: 'Time to acquire browser from pool in milliseconds',
      unit: 'ms',
    });
    
    // Observable gauges for pool state
    this.poolQueueLength = this.meter.createObservableGauge('pool_queue_length', {
      description: 'Number of requests waiting in queue',
      unit: '1',
    }, (result: any) => {
      if (this.browserPool) {
        const metrics = this.getPoolMetrics();
        result.observe(metrics.queueLength);
      }
    });
    
    this.poolUtilization = this.meter.createObservableGauge('pool_utilization_ratio', {
      description: 'Pool utilization ratio (0-1)',
      unit: '1',
    }, (result: any) => {
      if (this.browserPool) {
        const metrics = this.getPoolMetrics();
        result.observe(metrics.utilizationPercentage / 100);
      }
    });
    
    // Initialize resource metrics
    this.memoryUsage = this.meter.createObservableGauge('browser_memory_usage_bytes', {
      description: 'Total memory usage by browsers in bytes',
      unit: 'By',
    }, (result: any) => {
      if (this.browserPool) {
        const metrics = this.getPoolMetrics();
        result.observe(metrics.memoryUsage);
      }
    });
    
    this.cpuUsage = this.meter.createObservableGauge('browser_cpu_usage_percent', {
      description: 'CPU usage percentage by browsers',
      unit: '1',
    }, (result: any) => {
      if (this.browserPool) {
        const metrics = this.getPoolMetrics();
        result.observe(metrics.cpuUsage);
      }
    });
    
    this.networkBandwidth = this.meter.createHistogram('browser_network_bandwidth_bytes', {
      description: 'Network bandwidth used by browsers in bytes',
      unit: 'By',
    });
    
    // Initialize error metrics
    this.navigationErrors = this.meter.createCounter('browser_navigation_errors_total', {
      description: 'Total number of navigation errors',
      unit: '1',
    });
    
    this.evaluationErrors = this.meter.createCounter('browser_evaluation_errors_total', {
      description: 'Total number of JavaScript evaluation errors',
      unit: '1',
    });
    
    this.timeoutErrors = this.meter.createCounter('browser_timeout_errors_total', {
      description: 'Total number of timeout errors',
      unit: '1',
    });
    
    this.poolExhaustedErrors = this.meter.createCounter('pool_exhausted_errors_total', {
      description: 'Total number of pool exhaustion errors',
      unit: '1',
    });
    
    // Initialize performance metrics
    this.javascriptExecutionTime = this.meter.createHistogram('browser_js_execution_duration_ms', {
      description: 'JavaScript execution time in milliseconds',
      unit: 'ms',
    });
    
    this.screenshotDuration = this.meter.createHistogram('browser_screenshot_duration_ms', {
      description: 'Screenshot capture duration in milliseconds',
      unit: 'ms',
    });
    
    this.pdfGenerationDuration = this.meter.createHistogram('browser_pdf_generation_duration_ms', {
      description: 'PDF generation duration in milliseconds',
      unit: 'ms',
    });
  }
  
  /**
   * Get pool metrics from browser pool
   */
  private getPoolMetrics(): any {
    if (!this.browserPool) {
      return {
        queueLength: 0,
        utilizationPercentage: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      };
    }
    
    return (this.browserPool as any).getExtendedMetrics();
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
  recordBrowserClose(lifetime: number, reason: 'normal' | 'crash' | 'timeout'): void {
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
  recordPageNavigation(url: string, _duration: number, success: boolean): void {
    const labels = {
      success: success.toString(),
      domain: new URL(url).hostname,
    };
    
    this.pageNavigated.add(1, labels);
    
    if (!success) {
      this.navigationErrors.add(1, labels);
    }
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
    
    if (!success) {
      this.poolExhaustedErrors.add(1);
    }
  }
  
  /**
   * Record pool release
   */
  recordPoolRelease(): void {
    this.poolReleases.add(1);
  }
  
  /**
   * Record JavaScript execution
   */
  recordJavaScriptExecution(duration: number, success: boolean): void {
    const labels = {
      success: success.toString(),
    };
    
    this.javascriptExecutionTime.record(duration, labels);
    
    if (!success) {
      this.evaluationErrors.add(1);
    }
  }
  
  /**
   * Record screenshot capture
   */
  recordScreenshot(duration: number, format: 'png' | 'jpeg' | 'webp', success: boolean): void {
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
  
  /**
   * Record timeout error
   */
  recordTimeoutError(operation: string): void {
    this.timeoutErrors.add(1, { operation });
  }
  
  /**
   * Record network usage
   */
  recordNetworkUsage(bytes: number, direction: 'upload' | 'download'): void {
    this.networkBandwidth.record(bytes, { direction });
  }
}

/**
 * Create browser pool metrics with pool instance
 */
export function createBrowserPoolMetrics(browserPool: BrowserPool): BrowserPoolMetrics {
  return new BrowserPoolMetrics(browserPool);
}