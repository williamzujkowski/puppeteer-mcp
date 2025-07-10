/**
 * Browser lifecycle instrumentation (launch, close, crash)
 * @module telemetry/instrumentations/puppeteer/browser-instrumentation
 * @nist au-2 "Audit events"
 */

import { SpanKind } from '@opentelemetry/api';
import type { Browser, BrowserContext } from 'puppeteer';
import {
  createSpan,
  withSpanContext,
  finishSpan,
  finishSpanWithAttributes,
} from './trace-manager.js';
import { createBrowserAttributes } from './span-attributes.js';
import { createErrorHandler } from './error-instrumentation.js';
import { PuppeteerMetricsCollector } from './metrics-collector.js';
import type {
  InstrumentedBrowser,
  InstrumentedBrowserContext,
  InstrumentationContext,
  BrowserFactory,
} from './types.js';

/**
 * Browser instrumentation class
 */
export class BrowserInstrumentation {
  private metricsCollector: PuppeteerMetricsCollector;
  private errorHandler: ReturnType<typeof createErrorHandler>;

  constructor(private context: InstrumentationContext) {
    this.metricsCollector = new PuppeteerMetricsCollector(context.metrics);
    this.errorHandler = createErrorHandler(context);
  }

  /**
   * Instrument browser instance with telemetry
   */
  instrumentBrowser(browser: Browser): InstrumentedBrowser {
    const instrumentedBrowser = browser as InstrumentedBrowser;
    instrumentedBrowser.__instrumentation = this.context;

    const launchTime = Date.now();
    const originalNewPage = browser.newPage.bind(browser);
    const originalNewContext = browser.createBrowserContext.bind(browser);
    const originalClose = browser.close.bind(browser);

    // Instrument newPage
    browser.newPage = async () => {
      const span = createSpan(
        'browser.newPage',
        createBrowserAttributes('newPage'),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        const page = await withSpanContext(span, async () => {
          return originalNewPage();
        });

        const duration = Date.now() - startTime;
        this.metricsCollector.recordBrowserLifecycle('newPage', duration, true);

        finishSpan(span, startTime, true);
        return page;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordBrowserLifecycle('newPage', duration, false);
        this.errorHandler(span, error as Error, 'browser.newPage');
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };

    // Instrument createBrowserContext
    browser.createBrowserContext = async (options?: any) => {
      const span = createSpan(
        'browser.createContext',
        createBrowserAttributes('createContext', {
          'browser.context.incognito': true,
        }),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        const browserContext = await withSpanContext(span, async () => {
          return originalNewContext(options);
        });

        finishSpan(span, startTime, true);
        return this.instrumentBrowserContext(browserContext);
      } catch (error) {
        this.errorHandler(span, error as Error, 'browser.createContext');
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };

    // Instrument close
    browser.close = async () => {
      const lifetime = Date.now() - launchTime;
      const span = createSpan('browser.close', createBrowserAttributes('close'), SpanKind.CLIENT);

      const startTime = Date.now();

      try {
        await withSpanContext(span, async () => {
          return originalClose();
        });

        this.metricsCollector.recordBrowserLifecycle('close', Date.now() - startTime, true, {
          lifetime,
        });

        finishSpanWithAttributes(span, startTime, true, {
          'browser.lifetime': lifetime,
        });
      } catch (error) {
        this.metricsCollector.recordBrowserLifecycle('close', Date.now() - startTime, false, {
          lifetime,
        });

        this.errorHandler(span, error as Error, 'browser.close');
        this.errorHandler(span, error as Error, 'browser.close');
        finishSpanWithAttributes(span, startTime, false, {
          'browser.lifetime': lifetime,
        });
        throw error;
      }
    };

    return instrumentedBrowser;
  }

  /**
   * Instrument browser context with telemetry
   */
  instrumentBrowserContext(browserContext: BrowserContext): InstrumentedBrowserContext {
    const instrumentedContext = browserContext as InstrumentedBrowserContext;
    instrumentedContext.__instrumentation = this.context;

    const originalNewPage = browserContext.newPage.bind(browserContext);
    const originalClose = browserContext.close.bind(browserContext);

    // Instrument newPage
    browserContext.newPage = async () => {
      const span = createSpan(
        'context.newPage',
        createBrowserAttributes('newPage', {
          'browser.context.type': 'incognito',
        }),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        const page = await withSpanContext(span, async () => {
          return originalNewPage();
        });

        const duration = Date.now() - startTime;
        this.metricsCollector.recordBrowserLifecycle('newPage', duration, true);

        finishSpan(span, startTime, true);
        return page;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordBrowserLifecycle('newPage', duration, false);
        this.errorHandler(span, error as Error, 'context.newPage');
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };

    // Instrument close
    browserContext.close = async () => {
      const span = createSpan(
        'context.close',
        createBrowserAttributes('close', {
          'browser.context.type': 'incognito',
        }),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        await withSpanContext(span, async () => {
          return originalClose();
        });

        finishSpan(span, startTime, true);
      } catch (error) {
        this.errorHandler(span, error as Error, 'context.close');
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };

    return instrumentedContext;
  }

  /**
   * Create instrumented browser with metrics
   */
  async createInstrumentedBrowser(browserFactory: BrowserFactory): Promise<InstrumentedBrowser> {
    const span = createSpan('browser.launch', createBrowserAttributes('launch'), SpanKind.CLIENT);

    const startTime = Date.now();

    try {
      const browser = await withSpanContext(span, async () => {
        return browserFactory();
      });

      const duration = Date.now() - startTime;
      this.metricsCollector.recordBrowserLifecycle('launch', duration, true);

      finishSpan(span, startTime, true);
      return this.instrumentBrowser(browser);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsCollector.recordBrowserLifecycle('launch', duration, false);
      this.errorHandler(span, error as Error, 'browser.launch');
      finishSpan(span, startTime, false, error as Error);
      throw error;
    }
  }
}

/**
 * Create browser instrumentation instance
 */
export function createBrowserInstrumentation(
  context: InstrumentationContext,
): BrowserInstrumentation {
  return new BrowserInstrumentation(context);
}

/**
 * Instrument browser instance
 */
export function instrumentBrowser(
  browser: Browser,
  context: InstrumentationContext,
): InstrumentedBrowser {
  const instrumentation = createBrowserInstrumentation(context);
  return instrumentation.instrumentBrowser(browser);
}

/**
 * Create instrumented browser
 */
export function createInstrumentedBrowser(
  browserFactory: BrowserFactory,
  context: InstrumentationContext,
): Promise<InstrumentedBrowser> {
  const instrumentation = createBrowserInstrumentation(context);
  return instrumentation.createInstrumentedBrowser(browserFactory);
}
