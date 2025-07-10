/**
 * Puppeteer instrumentation for OpenTelemetry
 * @module telemetry/instrumentations/puppeteer
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

// Re-export the main instrumentation functions for backward compatibility
export {
  instrumentBrowser,
  instrumentPage,
  createInstrumentedBrowser,
  instrumentBrowserContext,
} from './puppeteer/puppeteer-instrumentation.js';

// Re-export the main instrumentation class
export {
  PuppeteerInstrumentation,
  createPuppeteerInstrumentation,
} from './puppeteer/puppeteer-instrumentation.js';

// Re-export types for backward compatibility
export type {
  InstrumentedBrowser,
  InstrumentedPage,
  InstrumentedBrowserContext,
  BrowserFactory,
} from './puppeteer/types.js';
