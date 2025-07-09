/**
 * Puppeteer instrumentation for OpenTelemetry
 * @module telemetry/instrumentations/puppeteer
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { Browser, Page, BrowserContext } from 'puppeteer';
import { getTracer } from '../index.js';
import { BrowserPoolMetrics } from '../metrics/browser-pool.js';
import { addSpanAttributes, createChildSpan } from '../context.js';

/**
 * Wrap browser instance with telemetry
 */
export function instrumentBrowser(browser: Browser, metrics?: BrowserPoolMetrics): Browser {
  const tracer = getTracer('puppeteer');
  const originalNewPage = browser.newPage.bind(browser);
  const originalNewContext = browser.createBrowserContext.bind(browser);
  const originalClose = browser.close.bind(browser);
  
  // Track browser launch time
  const launchTime = Date.now();
  
  // Instrument newPage
  browser.newPage = async function(): Promise<Page> {
    const span = tracer.startSpan('browser.newPage', {
      kind: SpanKind.CLIENT,
      attributes: {
        'browser.type': 'chromium',
        'browser.operation': 'newPage',
      },
    });
    
    const startTime = Date.now();
    
    try {
      const page = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalNewPage();
      });
      
      const duration = Date.now() - startTime;
      span.setStatus({ code: SpanStatusCode.OK });
      metrics?.recordPageCreation(duration, true);
      
      // Instrument the page
      return instrumentPage(page, metrics);
    } catch (error) {
      const duration = Date.now() - startTime;
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      metrics?.recordPageCreation(duration, false);
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Instrument createBrowserContext
  browser.createBrowserContext = async function(options?: any): Promise<BrowserContext> {
    const span = tracer.startSpan('browser.createContext', {
      kind: SpanKind.CLIENT,
      attributes: {
        'browser.type': 'chromium',
        'browser.operation': 'createContext',
        'browser.context.incognito': true,
      },
    });
    
    try {
      const browserContext = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalNewContext(options);
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      return instrumentBrowserContext(browserContext, metrics);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Instrument close
  browser.close = async function(): Promise<void> {
    const span = tracer.startSpan('browser.close', {
      kind: SpanKind.CLIENT,
      attributes: {
        'browser.type': 'chromium',
        'browser.operation': 'close',
      },
    });
    
    const lifetime = Date.now() - launchTime;
    
    try {
      await context.with(trace.setSpan(context.active(), span), async () => {
        return originalClose();
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      metrics?.recordBrowserClose(lifetime, 'normal');
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      metrics?.recordBrowserClose(lifetime, 'crash');
      throw error;
    } finally {
      span.end();
    }
  };
  
  return browser;
}

/**
 * Wrap browser context with telemetry
 */
export function instrumentBrowserContext(
  browserContext: BrowserContext,
  metrics?: BrowserPoolMetrics,
): BrowserContext {
  const tracer = getTracer('puppeteer');
  const originalNewPage = browserContext.newPage.bind(browserContext);
  const originalClose = browserContext.close.bind(browserContext);
  
  // Instrument newPage
  browserContext.newPage = async function(): Promise<Page> {
    const span = tracer.startSpan('context.newPage', {
      kind: SpanKind.CLIENT,
      attributes: {
        'browser.operation': 'newPage',
        'browser.context.type': 'incognito',
      },
    });
    
    const startTime = Date.now();
    
    try {
      const page = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalNewPage();
      });
      
      const duration = Date.now() - startTime;
      span.setStatus({ code: SpanStatusCode.OK });
      metrics?.recordPageCreation(duration, true);
      
      return instrumentPage(page, metrics);
    } catch (error) {
      const duration = Date.now() - startTime;
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      metrics?.recordPageCreation(duration, false);
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Instrument close
  browserContext.close = async function(): Promise<void> {
    const span = tracer.startSpan('context.close', {
      kind: SpanKind.CLIENT,
      attributes: {
        'browser.operation': 'close',
        'browser.context.type': 'incognito',
      },
    });
    
    try {
      await context.with(trace.setSpan(context.active(), span), async () => {
        return originalClose();
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  };
  
  return browserContext;
}

/**
 * Wrap page instance with telemetry
 */
export function instrumentPage(page: Page, metrics?: BrowserPoolMetrics): Page {
  const tracer = getTracer('puppeteer');
  const pageCreationTime = Date.now();
  
  // Instrument goto
  const originalGoto = page.goto.bind(page);
  page.goto = async function(url: string, options?: any): Promise<any> {
    const span = tracer.startSpan('page.goto', {
      kind: SpanKind.CLIENT,
      attributes: {
        'browser.operation': 'goto',
        'http.url': url,
        'http.method': 'GET',
        'navigation.timeout': options?.timeout ?? 30000,
        'navigation.wait_until': options?.waitUntil ?? 'load',
      },
    });
    
    const startTime = Date.now();
    
    try {
      const response = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalGoto(url, options);
      });
      
      const duration = Date.now() - startTime;
      
      if (response) {
        span.setAttributes({
          'http.status_code': response.status(),
          'http.response.size': response.headers()['content-length'] ?? 0,
        });
      }
      
      span.setStatus({ code: SpanStatusCode.OK });
      metrics?.recordPageNavigation(url, duration, true);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      
      metrics?.recordPageNavigation(url, duration, false);
      
      if (error instanceof Error && error.name === 'TimeoutError') {
        metrics?.recordTimeoutError('navigation');
      }
      
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Instrument evaluate
  const originalEvaluate = page.evaluate.bind(page);
  page.evaluate = async function(pageFunction: any, ...args: any[]): Promise<any> {
    const span = tracer.startSpan('page.evaluate', {
      kind: SpanKind.CLIENT,
      attributes: {
        'browser.operation': 'evaluate',
        'js.function.length': pageFunction.toString().length,
        'js.args.count': args.length,
      },
    });
    
    const startTime = Date.now();
    
    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalEvaluate(pageFunction, ...args);
      });
      
      const duration = Date.now() - startTime;
      span.setStatus({ code: SpanStatusCode.OK });
      metrics?.recordJavaScriptExecution(duration, true);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      metrics?.recordJavaScriptExecution(duration, false);
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Instrument screenshot
  const originalScreenshot = page.screenshot.bind(page);
  page.screenshot = async function(options?: any): Promise<any> {
    const format = options?.type ?? 'png';
    const span = tracer.startSpan('page.screenshot', {
      kind: SpanKind.CLIENT,
      attributes: {
        'browser.operation': 'screenshot',
        'screenshot.format': format,
        'screenshot.full_page': options?.fullPage ?? false,
        'screenshot.quality': options?.quality,
      },
    });
    
    const startTime = Date.now();
    
    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalScreenshot(options);
      });
      
      const duration = Date.now() - startTime;
      span.setStatus({ code: SpanStatusCode.OK });
      metrics?.recordScreenshot(duration, format, true);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      metrics?.recordScreenshot(duration, format, false);
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Instrument pdf
  const originalPdf = page.pdf.bind(page);
  page.pdf = async function(options?: any): Promise<any> {
    const span = tracer.startSpan('page.pdf', {
      kind: SpanKind.CLIENT,
      attributes: {
        'browser.operation': 'pdf',
        'pdf.format': options?.format ?? 'Letter',
        'pdf.landscape': options?.landscape ?? false,
      },
    });
    
    const startTime = Date.now();
    
    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return originalPdf(options);
      });
      
      const duration = Date.now() - startTime;
      span.setStatus({ code: SpanStatusCode.OK });
      metrics?.recordPdfGeneration(duration, true);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      metrics?.recordPdfGeneration(duration, false);
      throw error;
    } finally {
      span.end();
    }
  };
  
  // Instrument close
  const originalClose = page.close.bind(page);
  page.close = async function(options?: any): Promise<void> {
    const lifetime = Date.now() - pageCreationTime;
    
    const span = tracer.startSpan('page.close', {
      kind: SpanKind.CLIENT,
      attributes: {
        'browser.operation': 'close',
        'page.lifetime': lifetime,
      },
    });
    
    try {
      await context.with(trace.setSpan(context.active(), span), async () => {
        return originalClose(options);
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      metrics?.recordPageClose(lifetime);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  };
  
  return page;
}

/**
 * Create instrumented browser with metrics
 */
export function createInstrumentedBrowser(
  browserFactory: () => Promise<Browser>,
  metrics?: BrowserPoolMetrics,
): Promise<Browser> {
  const tracer = getTracer('puppeteer');
  
  return tracer.startActiveSpan('browser.launch', async (span) => {
    span.setAttributes({
      kind: SpanKind.CLIENT,
      'browser.type': 'chromium',
      'browser.operation': 'launch',
    });
    
    const startTime = Date.now();
    
    try {
      const browser = await browserFactory();
      const duration = Date.now() - startTime;
      
      span.setStatus({ code: SpanStatusCode.OK });
      metrics?.recordBrowserLaunch(duration, true);
      
      return instrumentBrowser(browser, metrics);
    } catch (error) {
      const duration = Date.now() - startTime;
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      metrics?.recordBrowserLaunch(duration, false);
      throw error;
    } finally {
      span.end();
    }
  });
}