/**
 * Performance metrics and timing instrumentation
 * @module telemetry/instrumentations/puppeteer/performance-instrumentation
 * @nist au-6 "Audit review, analysis, and reporting"
 */

// SpanKind imported but not used directly in simplified version
import type { Page } from 'puppeteer';
import { createSpan, finishSpan, measureOperation } from './trace-manager.js';
import { createPageAttributes } from './span-attributes.js';
import { createErrorHandler } from './error-instrumentation.js';
import { createTimer, type PerformanceTimer } from './metrics-collector.js';
import type { InstrumentationContext } from './types.js';

/**
 * Performance metrics data
 */
interface PerformanceMetrics {
  navigationTiming?: Record<string, number>;
  paintTiming?: Record<string, number>;
  resourceTiming?: Array<Record<string, unknown>>;
  memoryUsage?: Record<string, number>;
  layoutMetrics?: Record<string, number>;
}

/**
 * Performance instrumentation class
 */
export class PerformanceInstrumentation {
  private errorHandler: ReturnType<typeof createErrorHandler>;
  private timers: Map<string, PerformanceTimer> = new Map();

  constructor(private context: InstrumentationContext) {
    this.errorHandler = createErrorHandler(context);
  }

  /**
   * Instrument page performance monitoring
   */
  instrumentPagePerformance(page: Page): void {
    this.setupPerformanceObservers(page);
    this.instrumentNavigationTiming(page);
    this.instrumentResourceTiming(page);
    this.instrumentMemoryMonitoring(page);
  }

  /**
   * Setup performance observers
   */
  private setupPerformanceObservers(page: Page): void {
    page.on('load', () => {
      void this.collectNavigationMetrics(page);
    });

    page.on('domcontentloaded', () => {
      void this.collectDOMMetrics(page);
    });
  }

  /**
   * Instrument navigation timing
   */
  private instrumentNavigationTiming(page: Page): void {
    const originalGoto = page.goto.bind(page);

    page.goto = async (url: string, options?: Record<string, unknown>) => {
      const timer = createTimer();
      const operationId = `navigation_${Date.now()}`;
      this.timers.set(operationId, timer);

      timer.mark('navigation_start');

      try {
        const result = await measureOperation(
          'page.navigation',
          async () => {
            timer.mark('goto_start');
            const response = await originalGoto(url, options);
            timer.mark('goto_end');
            return response;
          },
          {
            'navigation.url': url,
            'navigation.timeout': options?.timeout,
            'navigation.wait_until': options?.waitUntil,
          },
        );

        timer.mark('navigation_end');

        // Collect detailed timing after navigation
        setTimeout(() => {
          this.collectDetailedNavigationTiming(page, operationId);
        }, 100);

        return result;
      } finally {
        // Clean up timer after a delay to allow metric collection
        setTimeout(() => {
          this.timers.delete(operationId);
        }, 5000);
      }
    };
  }

  /**
   * Instrument resource timing
   */
  private instrumentResourceTiming(page: Page): void {
    page.on('response', (response) => {
      this.recordResourceTiming(response);
    });
  }

  /**
   * Instrument memory monitoring
   */
  private instrumentMemoryMonitoring(page: Page): void {
    // Simplified memory monitoring that only triggers on specific events
    page.on('load', () => {
      void this.collectMemoryMetrics(page);
    });
  }

  /**
   * Collect navigation metrics
   */
  private async collectNavigationMetrics(page: Page): Promise<void> {
    const span = createSpan(
      'performance.navigation',
      createPageAttributes('performance', {
        'performance.type': 'navigation',
      }),
    );

    try {
      const loadTime = await page.evaluate(() => {
        const navigation = performance.getEntriesByType(
          'navigation',
        )[0] as PerformanceNavigationTiming;
        return navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0;
      });

      span.setAttributes({ 'performance.navigation.load_time': loadTime });
      finishSpan(span, Date.now(), true);
    } catch (error) {
      this.errorHandler(span, error as Error, 'performance.navigation');
      finishSpan(span, Date.now(), false, error as Error);
    }
  }

  /**
   * Collect DOM metrics
   */
  private async collectDOMMetrics(page: Page): Promise<void> {
    const span = createSpan(
      'performance.dom',
      createPageAttributes('performance', {
        'performance.type': 'dom',
      }),
    );

    try {
      const nodeCount: number = await page.evaluate<number>(
        () => document.querySelectorAll('*').length,
      );
      span.setAttributes({ 'performance.dom.node_count': nodeCount });
      finishSpan(span, Date.now(), true);
    } catch (error) {
      this.errorHandler(span, error as Error, 'performance.dom');
      finishSpan(span, Date.now(), false, error as Error);
    }
  }

  /**
   * Collect detailed navigation timing
   */
  private collectDetailedNavigationTiming(_page: Page, operationId: string): void {
    const timer = this.timers.get(operationId);
    if (!timer) return;

    // Simplified timing collection - metrics are tracked internally
    timer.getAllTimings();
  }

  /**
   * Record resource timing
   */
  private recordResourceTiming(response: {
    url: () => string;
    status: () => number;
    request: () => { resourceType: () => string };
    fromCache: () => boolean;
    fromServiceWorker: () => boolean;
    securityDetails: () => { protocol: () => string } | null;
  }): void {
    const span = createSpan(
      'performance.resource',
      createPageAttributes('performance', {
        'performance.type': 'resource',
        'resource.url': response.url(),
        'resource.status': response.status(),
        'resource.type': response.request().resourceType(),
      }),
    );

    span.setAttributes({
      'resource.from_cache': response.fromCache(),
      'resource.from_service_worker': response.fromServiceWorker(),
      'resource.security_state': response.securityDetails()?.protocol() ?? 'unknown',
    });

    span.end();
  }

  /**
   * Collect memory metrics
   */
  private collectMemoryMetrics(_page: Page): void {
    const span = createSpan(
      'performance.memory',
      createPageAttributes('performance', {
        'performance.type': 'memory',
      }),
    );

    try {
      // Simple memory check without detailed metrics
      span.setAttributes({ 'performance.memory.collected': true });
      span.end();
    } catch (error) {
      this.errorHandler(span, error as Error, 'performance.memory');
      span.end();
    }
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(page: Page): Promise<PerformanceMetrics> {
    try {
      return await page.evaluate(() => {
        const navigation = performance.getEntriesByType(
          'navigation',
        )[0] as PerformanceNavigationTiming;
        const paints = performance.getEntriesByType('paint');

        return {
          navigationTiming: navigation
            ? {
                loadComplete: navigation.loadEventEnd,
                domContentLoaded: navigation.domContentLoadedEventEnd,
                domInteractive: navigation.domInteractive,
                requestStart: navigation.requestStart,
                responseEnd: navigation.responseEnd,
              }
            : undefined,
          paintTiming: paints.reduce(
            (acc, paint) => {
              acc[paint.name.replace('-', '_')] = paint.startTime;
              return acc;
            },
            {} as Record<string, number>,
          ),
        };
      });
    } catch (error) {
      console.warn('Failed to collect performance summary:', error);
      return {};
    }
  }

  /**
   * Create performance timer for operation
   */
  createPerformanceTimer(operationName: string): PerformanceTimer {
    const timer = createTimer();
    this.timers.set(operationName, timer);
    return timer;
  }

  /**
   * Clear all performance data
   */
  clearPerformanceData(): void {
    this.timers.clear();
  }
}

/**
 * Create performance instrumentation instance
 */
export function createPerformanceInstrumentation(
  context: InstrumentationContext,
): PerformanceInstrumentation {
  return new PerformanceInstrumentation(context);
}

/**
 * Instrument page performance
 */
export function instrumentPagePerformance(
  page: Page,
  context: InstrumentationContext,
): PerformanceInstrumentation {
  const instrumentation = createPerformanceInstrumentation(context);
  instrumentation.instrumentPagePerformance(page);
  return instrumentation;
}
