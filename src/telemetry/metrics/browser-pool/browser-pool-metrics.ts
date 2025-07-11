/**
 * Browser pool metrics coordinating class
 * @module telemetry/metrics/browser-pool/browser-pool-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { Meter } from '@opentelemetry/api';
import { getMeter } from '../../index.js';
import type { BrowserPool } from '../../../puppeteer/pool/browser-pool.js';
import type {
  BrowserPoolProvider,
  PoolMetrics,
  BrowserCloseReason,
  ScreenshotFormat,
  NetworkDirection,
} from './types.js';
import { BrowserLifecycleMetrics } from './browser-lifecycle-metrics.js';
import { PageLifecycleMetrics } from './page-lifecycle-metrics.js';
import { PoolManagementMetrics } from './pool-management-metrics.js';
import { ResourceMetrics } from './resource-metrics.js';
import { ErrorMetrics } from './error-metrics.js';
import { PerformanceMetrics } from './performance-metrics.js';

/**
 * Browser pool metrics coordinating class
 */
export class BrowserPoolMetrics implements BrowserPoolProvider {
  private meter: Meter;

  // Metric modules
  private browserLifecycle: BrowserLifecycleMetrics;
  private pageLifecycle: PageLifecycleMetrics;
  private poolManagement: PoolManagementMetrics;
  private resourceMetrics: ResourceMetrics;
  private errorMetrics: ErrorMetrics;
  private performanceMetrics: PerformanceMetrics;

  constructor(
    readonly browserPool?: BrowserPool,
    meterName: string = 'puppeteer-mcp-browser-pool',
  ) {
    this.meter = getMeter(meterName);

    // Initialize metric modules
    this.browserLifecycle = new BrowserLifecycleMetrics(this.meter);
    this.pageLifecycle = new PageLifecycleMetrics(this.meter);
    this.poolManagement = new PoolManagementMetrics(this.meter, this);
    this.resourceMetrics = new ResourceMetrics(this.meter, this);
    this.errorMetrics = new ErrorMetrics(this.meter);
    this.performanceMetrics = new PerformanceMetrics(this.meter);
  }

  /**
   * Get pool metrics from browser pool
   */
  getPoolMetrics(): PoolMetrics {
    if (!this.browserPool) {
      return {
        queueLength: 0,
        utilizationPercentage: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      };
    }

    // Type assertion needed as getExtendedMetrics is not in the base interface
    const poolWithMetrics = this.browserPool as unknown as { getExtendedMetrics(): PoolMetrics };
    return poolWithMetrics.getExtendedMetrics();
  }

  // Browser lifecycle methods
  recordBrowserLaunch(duration: number, success: boolean): void {
    this.browserLifecycle.recordBrowserLaunch(duration, success);
  }

  recordBrowserClose(lifetime: number, reason: BrowserCloseReason): void {
    this.browserLifecycle.recordBrowserClose(lifetime, reason);
  }

  // Page lifecycle methods
  recordPageCreation(duration: number, success: boolean): void {
    this.pageLifecycle.recordPageCreation(duration, success);
  }

  recordPageClose(lifetime: number): void {
    this.pageLifecycle.recordPageClose(lifetime);
  }

  recordPageNavigation(url: string, _duration: number, success: boolean): void {
    this.pageLifecycle.recordPageNavigation(url, success);

    if (!success) {
      this.errorMetrics.recordNavigationError(url);
    }
  }

  // Pool management methods
  recordPoolAcquisition(duration: number, success: boolean): void {
    this.poolManagement.recordPoolAcquisition(duration, success);

    if (!success) {
      this.errorMetrics.recordPoolExhaustedError();
    }
  }

  recordPoolRelease(): void {
    this.poolManagement.recordPoolRelease();
  }

  // Performance methods
  recordJavaScriptExecution(duration: number, success: boolean): void {
    this.performanceMetrics.recordJavaScriptExecution(duration, success);

    if (!success) {
      this.errorMetrics.recordEvaluationError();
    }
  }

  recordScreenshot(duration: number, format: ScreenshotFormat, success: boolean): void {
    this.performanceMetrics.recordScreenshot(duration, format, success);
  }

  recordPdfGeneration(duration: number, success: boolean): void {
    this.performanceMetrics.recordPdfGeneration(duration, success);
  }

  // Error methods
  recordTimeoutError(operation: string): void {
    this.errorMetrics.recordTimeoutError(operation);
  }

  // Resource methods
  recordNetworkUsage(bytes: number, direction: NetworkDirection): void {
    this.resourceMetrics.recordNetworkUsage(bytes, direction);
  }
}
