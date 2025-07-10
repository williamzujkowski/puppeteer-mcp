/**
 * Shared types for Puppeteer instrumentation
 * @module telemetry/instrumentations/puppeteer/types
 * @nist au-2 "Audit events"
 */

import type { Span } from '@opentelemetry/api';
import type { Browser, Page, BrowserContext } from 'puppeteer';
import type { BrowserPoolMetrics } from '../../metrics/browser-pool.js';

/**
 * Base instrumentation context
 */
export interface InstrumentationContext {
  metrics?: BrowserPoolMetrics;
  tracer: any;
}

/**
 * Browser operation types
 */
export type BrowserOperation = 'launch' | 'newPage' | 'createContext' | 'close' | 'crash';

/**
 * Page operation types
 */
export type PageOperation =
  | 'goto'
  | 'evaluate'
  | 'screenshot'
  | 'pdf'
  | 'close'
  | 'reload'
  | 'click'
  | 'type'
  | 'select'
  | 'hover'
  | 'focus'
  | 'scroll';

/**
 * Network operation types
 */
export type NetworkOperation = 'request' | 'response' | 'failed' | 'finished';

/**
 * Performance metric types
 */
export type PerformanceMetric = 'navigation' | 'evaluation' | 'screenshot' | 'pdf' | 'network';

/**
 * Error types for tracking
 */
export type ErrorType =
  | 'timeout'
  | 'navigation'
  | 'evaluation'
  | 'network'
  | 'screenshot'
  | 'pdf'
  | 'unknown';

/**
 * Span attributes for browser operations
 */
export interface BrowserSpanAttributes {
  'browser.type': string;
  'browser.operation': BrowserOperation;
  'browser.context.incognito'?: boolean;
  'browser.context.type'?: string;
}

/**
 * Span attributes for page operations
 */
export interface PageSpanAttributes {
  'browser.operation': PageOperation;
  'http.url'?: string;
  'http.method'?: string;
  'http.status_code'?: number;
  'http.response.size'?: number;
  'navigation.timeout'?: number;
  'navigation.wait_until'?: string;
  'screenshot.format'?: string;
  'screenshot.full_page'?: boolean;
  'screenshot.quality'?: number;
  'pdf.format'?: string;
  'pdf.landscape'?: boolean;
  'js.function.length'?: number;
  'js.args.count'?: number;
  'page.lifetime'?: number;
}

/**
 * Network span attributes
 */
export interface NetworkSpanAttributes {
  'http.method': string;
  'http.url': string;
  'http.status_code'?: number;
  'http.request.size'?: number;
  'http.response.size'?: number;
  'network.operation': NetworkOperation;
}

/**
 * Performance timing data
 */
export interface PerformanceTiming {
  startTime: number;
  endTime?: number;
  duration?: number;
}

/**
 * Error tracking data
 */
export interface ErrorData {
  type: ErrorType;
  message: string;
  stack?: string;
  operation: string;
}

/**
 * Instrumented browser interface
 */
export interface InstrumentedBrowser extends Browser {
  __instrumentation?: InstrumentationContext;
}

/**
 * Instrumented page interface
 */
export interface InstrumentedPage extends Page {
  __instrumentation?: InstrumentationContext;
  __creationTime?: number;
}

/**
 * Instrumented browser context interface
 */
export interface InstrumentedBrowserContext extends BrowserContext {
  __instrumentation?: InstrumentationContext;
}

/**
 * Browser factory function type
 */
export type BrowserFactory = () => Promise<Browser>;

/**
 * Span creator function type
 */
export type SpanCreator = (name: string, attributes?: Record<string, any>) => Span;

/**
 * Metrics recorder function type
 */
export type MetricsRecorder = (
  operation: string,
  duration: number,
  success: boolean,
  ...args: any[]
) => void;

/**
 * Options for goto operation
 */
export interface GotoOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  referer?: string;
}

/**
 * Options for screenshot operation
 */
export interface ScreenshotOptions {
  type?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Options for PDF generation
 */
export interface PdfOptions {
  format?: string;
  landscape?: boolean;
  printBackground?: boolean;
  scale?: number;
  width?: string;
  height?: string;
}
