/**
 * Main Puppeteer instrumentation coordinator
 * @module telemetry/instrumentations/puppeteer/puppeteer-instrumentation
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { Browser, Page, BrowserContext } from 'puppeteer';
import { getTracer } from '../../index.js';
import type { BrowserPoolMetrics } from '../../metrics/browser-pool.js';
import { BrowserInstrumentation, createBrowserInstrumentation } from './browser-instrumentation.js';
import { PageInstrumentation, createPageInstrumentation } from './page-instrumentation.js';
import { ActionInstrumentation, createActionInstrumentation } from './action-instrumentation.js';
import { NetworkInstrumentation, createNetworkInstrumentation } from './network-instrumentation.js';
import {
  PerformanceInstrumentation,
  createPerformanceInstrumentation,
} from './performance-instrumentation.js';
import { setupGlobalErrorHandler } from './error-instrumentation.js';
import { type PerformanceTimer } from './metrics-collector.js';
import type {
  InstrumentedBrowser,
  InstrumentedPage,
  InstrumentedBrowserContext,
  InstrumentationContext,
  BrowserFactory,
} from './types.js';

/**
 * Main Puppeteer instrumentation coordinator
 */
export class PuppeteerInstrumentation {
  private browserInstrumentation: BrowserInstrumentation;
  private pageInstrumentation: PageInstrumentation;
  private actionInstrumentation: ActionInstrumentation;
  private networkInstrumentation: NetworkInstrumentation;
  private performanceInstrumentation: PerformanceInstrumentation;
  private context: InstrumentationContext;

  constructor(metrics?: BrowserPoolMetrics) {
    this.context = {
      metrics,
      tracer: getTracer('puppeteer'),
    };

    this.browserInstrumentation = createBrowserInstrumentation(this.context);
    this.pageInstrumentation = createPageInstrumentation(this.context);
    this.actionInstrumentation = createActionInstrumentation(this.context);
    this.networkInstrumentation = createNetworkInstrumentation(this.context);
    this.performanceInstrumentation = createPerformanceInstrumentation(this.context);

    // Setup global error handling
    setupGlobalErrorHandler(this.context);
  }

  /**
   * Instrument browser instance with full telemetry
   */
  instrumentBrowser(browser: Browser): InstrumentedBrowser {
    const instrumentedBrowser = this.browserInstrumentation.instrumentBrowser(browser);

    // Override newPage to also instrument the returned page
    const originalNewPage = instrumentedBrowser.newPage.bind(instrumentedBrowser);
    instrumentedBrowser.newPage = async () => {
      const page = await originalNewPage();
      return this.instrumentPage(page);
    };

    return instrumentedBrowser;
  }

  /**
   * Instrument page instance with full telemetry
   */
  instrumentPage(page: Page): InstrumentedPage {
    // Apply all instrumentations to the page
    const instrumentedPage = this.pageInstrumentation.instrumentPage(page);

    // Add action instrumentation
    this.actionInstrumentation.instrumentPageActions(instrumentedPage);

    // Add network instrumentation
    this.networkInstrumentation.instrumentNetworkEvents(instrumentedPage);

    // Add performance instrumentation
    this.performanceInstrumentation.instrumentPagePerformance(instrumentedPage);

    return instrumentedPage;
  }

  /**
   * Instrument browser context with telemetry
   */
  instrumentBrowserContext(browserContext: BrowserContext): InstrumentedBrowserContext {
    const instrumentedContext =
      this.browserInstrumentation.instrumentBrowserContext(browserContext);

    // Override newPage to also instrument the returned page
    const originalNewPage = instrumentedContext.newPage.bind(instrumentedContext);
    instrumentedContext.newPage = async () => {
      const page = await originalNewPage();
      return this.instrumentPage(page);
    };

    return instrumentedContext;
  }

  /**
   * Create fully instrumented browser
   */
  async createInstrumentedBrowser(browserFactory: BrowserFactory): Promise<InstrumentedBrowser> {
    const browser = await this.browserInstrumentation.createInstrumentedBrowser(browserFactory);
    return this.instrumentBrowser(browser);
  }

  /**
   * Get instrumentation context
   */
  getContext(): InstrumentationContext {
    return this.context;
  }

  /**
   * Get performance summary for a page
   */
  async getPagePerformanceSummary(page: Page): Promise<Record<string, any>> {
    return this.performanceInstrumentation.getPerformanceSummary(page);
  }

  /**
   * Get network statistics for a page
   */
  getPageNetworkStats(): Record<string, number> {
    return this.networkInstrumentation.getNetworkStats();
  }

  /**
   * Clear all telemetry data
   */
  clearTelemetryData(): void {
    this.networkInstrumentation.clearNetworkData();
    this.performanceInstrumentation.clearPerformanceData();
  }

  /**
   * Enable request interception for detailed network monitoring
   */
  async enableDetailedNetworkMonitoring(page: Page): Promise<void> {
    await this.networkInstrumentation.enableRequestInterception(page);
  }

  /**
   * Create performance timer
   */
  createPerformanceTimer(operationName: string): PerformanceTimer {
    return this.performanceInstrumentation.createPerformanceTimer(operationName);
  }
}

/**
 * Create Puppeteer instrumentation instance
 */
export function createPuppeteerInstrumentation(
  metrics?: BrowserPoolMetrics,
): PuppeteerInstrumentation {
  return new PuppeteerInstrumentation(metrics);
}

/**
 * Instrument browser instance (convenience function)
 */
export function instrumentBrowser(
  browser: Browser,
  metrics?: BrowserPoolMetrics,
): InstrumentedBrowser {
  const instrumentation = createPuppeteerInstrumentation(metrics);
  return instrumentation.instrumentBrowser(browser);
}

/**
 * Instrument page instance (convenience function)
 */
export function instrumentPage(page: Page, metrics?: BrowserPoolMetrics): InstrumentedPage {
  const instrumentation = createPuppeteerInstrumentation(metrics);
  return instrumentation.instrumentPage(page);
}

/**
 * Instrument browser context (convenience function)
 */
export function instrumentBrowserContext(
  browserContext: BrowserContext,
  metrics?: BrowserPoolMetrics,
): InstrumentedBrowserContext {
  const instrumentation = createPuppeteerInstrumentation(metrics);
  return instrumentation.instrumentBrowserContext(browserContext);
}

/**
 * Create instrumented browser (convenience function)
 */
export function createInstrumentedBrowser(
  browserFactory: BrowserFactory,
  metrics?: BrowserPoolMetrics,
): Promise<InstrumentedBrowser> {
  const instrumentation = createPuppeteerInstrumentation(metrics);
  return instrumentation.createInstrumentedBrowser(browserFactory);
}
