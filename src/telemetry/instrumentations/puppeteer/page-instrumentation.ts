/**
 * Page lifecycle instrumentation (create, navigate, close)
 * @module telemetry/instrumentations/puppeteer/page-instrumentation
 * @nist au-2 "Audit events"
 */

import { SpanKind } from '@opentelemetry/api';
import type { Page } from 'puppeteer';
import {
  createSpan,
  withSpanContext,
  finishSpan,
  finishSpanWithAttributes,
} from './trace-manager.js';
import {
  createPageAttributes,
  extractGotoAttributes,
  addResponseAttributes,
  addLifetimeAttributes,
} from './span-attributes.js';
import { createErrorHandler } from './error-instrumentation.js';
import { PuppeteerMetricsCollector } from './metrics-collector.js';
import type { InstrumentedPage, InstrumentationContext, GotoOptions } from './types.js';

/**
 * Page instrumentation class
 */
export class PageInstrumentation {
  private metricsCollector: PuppeteerMetricsCollector;
  private errorHandler: ReturnType<typeof createErrorHandler>;

  constructor(private context: InstrumentationContext) {
    this.metricsCollector = new PuppeteerMetricsCollector(context.metrics);
    this.errorHandler = createErrorHandler(context);
  }

  /**
   * Instrument page instance with telemetry
   */
  instrumentPage(page: Page): InstrumentedPage {
    const instrumentedPage = page as InstrumentedPage;
    instrumentedPage.__instrumentation = this.context;
    instrumentedPage.__creationTime = Date.now();

    this.instrumentNavigation(page);
    this.instrumentLifecycle(page);

    return instrumentedPage;
  }

  /**
   * Instrument page navigation methods
   */
  private instrumentNavigation(page: Page): void {
    const originalGoto = page.goto.bind(page);
    const originalReload = page.reload.bind(page);
    const originalGoBack = page.goBack?.bind(page);
    const originalGoForward = page.goForward?.bind(page);

    // Instrument goto
    page.goto = async (url: string, options?: GotoOptions) => {
      const span = createSpan(
        'page.goto',
        createPageAttributes('goto', extractGotoAttributes(url, options)),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        const response = await withSpanContext(span, async () => {
          return originalGoto(url, options);
        });

        const duration = Date.now() - startTime;

        // Add response attributes if available
        if (response) {
          span.setAttributes(addResponseAttributes(response));
        }

        this.metricsCollector.recordPageLifecycle('goto', duration, true, { url });
        finishSpan(span, startTime, true);

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordPageLifecycle('goto', duration, false, { url });

        // Handle timeout errors specifically
        if (error instanceof Error && error.name === 'TimeoutError') {
          this.metricsCollector.recordError('timeout', 'navigation');
        }

        this.errorHandler(span, error as Error, 'page.goto', { url });
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };

    // Instrument reload
    if (originalReload) {
      page.reload = async (options?: any) => {
        const span = createSpan('page.reload', createPageAttributes('reload'), SpanKind.CLIENT);

        const startTime = Date.now();

        try {
          const response = await withSpanContext(span, async () => {
            return originalReload(options);
          });

          if (response) {
            span.setAttributes(addResponseAttributes(response));
          }

          finishSpan(span, startTime, true);
          return response;
        } catch (error) {
          this.errorHandler(span, error as Error, 'page.reload');
          finishSpan(span, startTime, false, error as Error);
          throw error;
        }
      };
    }

    // Instrument goBack
    if (originalGoBack) {
      page.goBack = async (options?: any) => {
        const span = createSpan(
          'page.goBack',
          createPageAttributes('goto', { 'navigation.direction': 'back' }),
          SpanKind.CLIENT,
        );

        const startTime = Date.now();

        try {
          const response = await withSpanContext(span, async () => {
            return originalGoBack(options);
          });

          if (response) {
            span.setAttributes(addResponseAttributes(response));
          }

          finishSpan(span, startTime, true);
          return response;
        } catch (error) {
          this.errorHandler(span, error as Error, 'page.goBack');
          finishSpan(span, startTime, false, error as Error);
          throw error;
        }
      };
    }

    // Instrument goForward
    if (originalGoForward) {
      page.goForward = async (options?: any) => {
        const span = createSpan(
          'page.goForward',
          createPageAttributes('goto', { 'navigation.direction': 'forward' }),
          SpanKind.CLIENT,
        );

        const startTime = Date.now();

        try {
          const response = await withSpanContext(span, async () => {
            return originalGoForward(options);
          });

          if (response) {
            span.setAttributes(addResponseAttributes(response));
          }

          finishSpan(span, startTime, true);
          return response;
        } catch (error) {
          this.errorHandler(span, error as Error, 'page.goForward');
          finishSpan(span, startTime, false, error as Error);
          throw error;
        }
      };
    }
  }

  /**
   * Instrument page lifecycle methods
   */
  private instrumentLifecycle(page: Page): void {
    const originalClose = page.close.bind(page);
    const creationTime = Date.now();

    // Instrument close
    page.close = async (options?: any) => {
      const span = createSpan(
        'page.close',
        createPageAttributes('close', addLifetimeAttributes(creationTime)),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();
      const lifetime = Date.now() - creationTime;

      try {
        await withSpanContext(span, async () => {
          return originalClose(options);
        });

        this.metricsCollector.recordPageLifecycle('close', Date.now() - startTime, true, {
          lifetime,
        });

        finishSpanWithAttributes(span, startTime, true, {
          'page.lifetime': lifetime,
        });
      } catch (error) {
        this.errorHandler(span, error as Error, 'page.close');
        this.errorHandler(span, error as Error, 'page.close');
        finishSpanWithAttributes(span, startTime, false, {
          'page.lifetime': lifetime,
        });
        throw error;
      }
    };

    // Add event listeners for page lifecycle events
    this.addPageEventListeners(page);
  }

  /**
   * Add event listeners for page lifecycle events
   */
  private addPageEventListeners(page: Page): void {
    // Track page crashes
    page.on('error', (error: Error) => {
      const span = createSpan('page.error', createPageAttributes('error'));
      this.errorHandler(span, error, 'page.error');
      span.end();
    });

    // Track page load events
    page.on('load', () => {
      const span = createSpan('page.load', createPageAttributes('load'));
      finishSpan(span, Date.now(), true);
    });

    // Track DOM content loaded
    page.on('domcontentloaded', () => {
      const span = createSpan('page.domcontentloaded', createPageAttributes('domcontentloaded'));
      finishSpan(span, Date.now(), true);
    });

    // Track console events
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const span = createSpan('page.console.error', createPageAttributes('console'));
        span.setAttributes({
          'console.message': msg.text(),
          'console.type': msg.type(),
        });
        span.end();
      }
    });

    // Track page crashes
    page.on('pageerror', (error: Error) => {
      const span = createSpan('page.pageerror', createPageAttributes('pageerror'));
      this.errorHandler(span, error, 'page.pageerror');
      span.end();
    });
  }
}

/**
 * Create page instrumentation instance
 */
export function createPageInstrumentation(context: InstrumentationContext): PageInstrumentation {
  return new PageInstrumentation(context);
}

/**
 * Instrument page instance
 */
export function instrumentPage(page: Page, context: InstrumentationContext): InstrumentedPage {
  const instrumentation = createPageInstrumentation(context);
  return instrumentation.instrumentPage(page);
}
