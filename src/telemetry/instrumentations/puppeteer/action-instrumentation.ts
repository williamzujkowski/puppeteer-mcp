/**
 * Browser action instrumentation (click, type, screenshot)
 * @module telemetry/instrumentations/puppeteer/action-instrumentation
 * @nist au-2 "Audit events"
 */

import { SpanKind } from '@opentelemetry/api';
import type { Page } from 'puppeteer';
import { createSpan, withSpanContext, finishSpan } from './trace-manager.js';
import {
  createPageAttributes,
  extractScreenshotAttributes,
  extractPdfAttributes,
  extractEvaluationAttributes,
} from './span-attributes.js';
import { createErrorHandler } from './error-instrumentation.js';
import { PuppeteerMetricsCollector } from './metrics-collector.js';
import type { InstrumentationContext, ScreenshotOptions, PdfOptions } from './types.js';

/**
 * Action instrumentation class
 */
export class ActionInstrumentation {
  private metricsCollector: PuppeteerMetricsCollector;
  private errorHandler: ReturnType<typeof createErrorHandler>;

  constructor(private context: InstrumentationContext) {
    this.metricsCollector = new PuppeteerMetricsCollector(context.metrics);
    this.errorHandler = createErrorHandler(context);
  }

  /**
   * Instrument page actions
   */
  instrumentPageActions(page: Page): void {
    this.instrumentInteractionMethods(page);
    this.instrumentEvaluationMethods(page);
    this.instrumentCaptureMethods(page);
    this.instrumentFormMethods(page);
  }

  /**
   * Instrument interaction methods (click, hover, focus, etc.)
   */
  private instrumentInteractionMethods(page: Page): void {
    const originalClick = page.click.bind(page);
    const originalHover = page.hover.bind(page);
    const originalFocus = page.focus.bind(page);
    const originalType = page.type.bind(page);

    // Instrument click
    page.click = async (selector: string, options?: Record<string, unknown>): Promise<void> => {
      const span = createSpan(
        'page.click',
        createPageAttributes('click', {
          'interaction.selector': selector,
          'interaction.button': options?.button ?? 'left',
          'interaction.click_count': options?.clickCount ?? 1,
        }),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        await withSpanContext(span, async () => {
          return originalClick(selector, options);
        });

        finishSpan(span, startTime, true);
      } catch (error) {
        this.errorHandler(span, error as Error, 'page.click', { selector });
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };

    // Instrument hover
    page.hover = async (selector: string) => {
      const span = createSpan(
        'page.hover',
        createPageAttributes('hover', {
          'interaction.selector': selector,
        }),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        await withSpanContext(span, async () => {
          return originalHover(selector);
        });

        finishSpan(span, startTime, true);
      } catch (error) {
        this.errorHandler(span, error as Error, 'page.hover', { selector });
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };

    // Instrument focus
    page.focus = async (selector: string) => {
      const span = createSpan(
        'page.focus',
        createPageAttributes('focus', {
          'interaction.selector': selector,
        }),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        await withSpanContext(span, async () => {
          return originalFocus(selector);
        });

        finishSpan(span, startTime, true);
      } catch (error) {
        this.errorHandler(span, error as Error, 'page.focus', { selector });
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };

    // Instrument type
    page.type = async (
      selector: string,
      text: string,
      options?: Record<string, unknown>,
    ): Promise<void> => {
      const span = createSpan(
        'page.type',
        createPageAttributes('type', {
          'interaction.selector': selector,
          'interaction.text_length': text.length,
          'interaction.delay': options?.delay ?? 0,
        }),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        await withSpanContext(span, async () => {
          return originalType(selector, text, options);
        });

        finishSpan(span, startTime, true);
      } catch (error) {
        this.errorHandler(span, error as Error, 'page.type', { selector });
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };
  }

  /**
   * Instrument evaluation methods
   */
  private instrumentEvaluationMethods(page: Page): void {
    const originalEvaluate = page.evaluate.bind(page);
    const originalEvaluateHandle = page.evaluateHandle.bind(page);

    // Instrument evaluate
    page.evaluate = async <T>(
      pageFunction: (...args: unknown[]) => T,
      ...args: unknown[]
    ): Promise<T> => {
      const span = createSpan(
        'page.evaluate',
        createPageAttributes('evaluate', extractEvaluationAttributes(pageFunction, args)),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        const result = await withSpanContext(span, async () => {
          return (await originalEvaluate(pageFunction, ...args)) as T;
        });

        const duration = Date.now() - startTime;
        this.metricsCollector.recordBrowserAction('evaluate', duration, true);

        finishSpan(span, startTime, true);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordBrowserAction('evaluate', duration, false);
        this.errorHandler(span, error as Error, 'page.evaluate');
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };

    // Instrument evaluateHandle
    page.evaluateHandle = async <T>(
      pageFunction: (...args: unknown[]) => T,
      ...args: unknown[]
    ): Promise<unknown> => {
      const span = createSpan(
        'page.evaluateHandle',
        createPageAttributes('evaluate', {
          ...extractEvaluationAttributes(pageFunction, args),
          'evaluation.returns_handle': true,
        }),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        const result = await withSpanContext(span, () => {
          return originalEvaluateHandle(pageFunction, ...args);
        });

        finishSpan(span, startTime, true);
        return result;
      } catch (error) {
        this.errorHandler(span, error as Error, 'page.evaluateHandle');
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };
  }

  /**
   * Instrument capture methods (screenshot, PDF)
   */
  private instrumentCaptureMethods(page: Page): void {
    const originalScreenshot = page.screenshot.bind(page);
    const originalPdf = page.pdf.bind(page);

    // Instrument screenshot
    page.screenshot = async (options?: ScreenshotOptions) => {
      const format = options?.type ?? 'png';
      const span = createSpan(
        'page.screenshot',
        createPageAttributes('screenshot', extractScreenshotAttributes(options)),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        const result = await withSpanContext(span, async () => {
          return originalScreenshot(options);
        });

        const duration = Date.now() - startTime;
        this.metricsCollector.recordBrowserAction('screenshot', duration, true, format);

        finishSpan(span, startTime, true);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordBrowserAction('screenshot', duration, false, format);
        this.errorHandler(span, error as Error, 'page.screenshot');
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };

    // Instrument pdf
    page.pdf = async (options?: PdfOptions) => {
      const span = createSpan(
        'page.pdf',
        createPageAttributes('pdf', extractPdfAttributes(options)),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        const result = await withSpanContext(span, async () => {
          return originalPdf(options);
        });

        const duration = Date.now() - startTime;
        this.metricsCollector.recordBrowserAction('pdf', duration, true);

        finishSpan(span, startTime, true);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.metricsCollector.recordBrowserAction('pdf', duration, false);
        this.errorHandler(span, error as Error, 'page.pdf');
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };
  }

  /**
   * Instrument form methods
   */
  private instrumentFormMethods(page: Page): void {
    const originalSelect = page.select.bind(page);

    // Instrument select
    page.select = async (selector: string, ...values: string[]) => {
      const span = createSpan(
        'page.select',
        createPageAttributes('select', {
          'interaction.selector': selector,
          'interaction.values_count': values.length,
        }),
        SpanKind.CLIENT,
      );

      const startTime = Date.now();

      try {
        const result = await withSpanContext(span, async () => {
          return originalSelect(selector, ...values);
        });

        finishSpan(span, startTime, true);
        return result;
      } catch (error) {
        this.errorHandler(span, error as Error, 'page.select', { selector });
        finishSpan(span, startTime, false, error as Error);
        throw error;
      }
    };
  }
}

/**
 * Create action instrumentation instance
 */
export function createActionInstrumentation(
  context: InstrumentationContext,
): ActionInstrumentation {
  return new ActionInstrumentation(context);
}

/**
 * Instrument page actions
 */
export function instrumentPageActions(page: Page, context: InstrumentationContext): void {
  const instrumentation = createActionInstrumentation(context);
  instrumentation.instrumentPageActions(page);
}
