/**
 * Puppeteer instrumentation module exports
 * @module telemetry/instrumentations/puppeteer
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

// Main instrumentation coordinator
export {
  PuppeteerInstrumentation,
  createPuppeteerInstrumentation,
  instrumentBrowser,
  instrumentPage,
  instrumentBrowserContext,
  createInstrumentedBrowser,
} from './puppeteer-instrumentation.js';

// Individual instrumentation modules
export { BrowserInstrumentation, createBrowserInstrumentation } from './browser-instrumentation.js';

export { PageInstrumentation, createPageInstrumentation } from './page-instrumentation.js';

export {
  ActionInstrumentation,
  createActionInstrumentation,
  instrumentPageActions,
} from './action-instrumentation.js';

export {
  NetworkInstrumentation,
  createNetworkInstrumentation,
  instrumentNetworkEvents,
} from './network-instrumentation.js';

export {
  PerformanceInstrumentation,
  createPerformanceInstrumentation,
  instrumentPagePerformance,
} from './performance-instrumentation.js';

// Trace management
export {
  createSpan,
  withActiveSpan,
  withSpanContext,
  recordError,
  recordSuccess,
  addTiming,
  createSpanCreator,
  finishSpan,
  finishSpanWithAttributes,
  createChildSpan,
  getCurrentSpan,
  hasActiveTrace,
  measureOperation,
} from './trace-manager.js';

// Metrics collection
export {
  PuppeteerMetricsCollector,
  createMetricsRecorder,
  PerformanceTimer,
  createTimer,
} from './metrics-collector.js';

// Error handling
export {
  ErrorInstrumentation,
  createErrorHandler,
  withErrorInstrumentation,
  setupGlobalErrorHandler,
} from './error-instrumentation.js';

// Span attributes utilities
export {
  createBrowserAttributes,
  createPageAttributes,
  createNetworkAttributes,
  extractGotoAttributes,
  extractScreenshotAttributes,
  extractPdfAttributes,
  extractEvaluationAttributes,
  addResponseAttributes,
  addTimingAttributes,
  addErrorAttributes,
  addLifetimeAttributes,
  sanitizeUrl,
  enrichAttributes,
} from './span-attributes.js';

// Types
export type {
  InstrumentationContext,
  BrowserOperation,
  PageOperation,
  NetworkOperation,
  PerformanceMetric,
  ErrorType,
  BrowserSpanAttributes,
  PageSpanAttributes,
  NetworkSpanAttributes,
  PerformanceTiming,
  ErrorData,
  InstrumentedBrowser,
  InstrumentedPage,
  InstrumentedBrowserContext,
  BrowserFactory,
  SpanCreator,
  MetricsRecorder,
  GotoOptions,
  ScreenshotOptions,
  PdfOptions,
} from './types.js';
