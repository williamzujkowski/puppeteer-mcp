/**
 * Network request/response instrumentation
 * @module telemetry/instrumentations/puppeteer/network-instrumentation
 * @nist au-2 "Audit events"
 */

import { SpanKind } from '@opentelemetry/api';
import type { Page, HTTPRequest, HTTPResponse } from 'puppeteer';
import { createSpan, finishSpan } from './trace-manager.js';
import { createNetworkAttributes, sanitizeUrl } from './span-attributes.js';
import { createErrorHandler } from './error-instrumentation.js';
import { PuppeteerMetricsCollector } from './metrics-collector.js';
import type { InstrumentationContext } from './types.js';

/**
 * Network instrumentation class
 */
export class NetworkInstrumentation {
  private metricsCollector: PuppeteerMetricsCollector;
  private errorHandler: ReturnType<typeof createErrorHandler>;
  private requestTimes: Map<string, number> = new Map();

  constructor(private context: InstrumentationContext) {
    this.metricsCollector = new PuppeteerMetricsCollector(context.metrics);
    this.errorHandler = createErrorHandler(context);
  }

  /**
   * Instrument page network events
   */
  instrumentNetworkEvents(page: Page): void {
    this.setupRequestListeners(page);
    this.setupResponseListeners(page);
    this.setupFailureListeners(page);
  }

  /**
   * Setup request event listeners
   */
  private setupRequestListeners(page: Page): void {
    page.on('request', (request: HTTPRequest) => {
      this.handleRequest(request);
    });

    page.on('requestfinished', (request: HTTPRequest) => {
      this.handleRequestFinished(request);
    });
  }

  /**
   * Setup response event listeners
   */
  private setupResponseListeners(page: Page): void {
    page.on('response', (response: HTTPResponse) => {
      this.handleResponse(response);
    });
  }

  /**
   * Setup failure event listeners
   */
  private setupFailureListeners(page: Page): void {
    page.on('requestfailed', (request: HTTPRequest) => {
      this.handleRequestFailed(request);
    });
  }

  /**
   * Handle request event
   */
  private handleRequest(request: HTTPRequest): void {
    const requestId = this.getRequestId(request);
    const startTime = Date.now();
    this.requestTimes.set(requestId, startTime);

    const span = createSpan(
      'network.request',
      createNetworkAttributes('request', request.method(), sanitizeUrl(request.url()), {
        'http.request.size': this.getRequestSize(request),
        'http.request.headers': this.sanitizeHeaders(request.headers()),
        'network.resource_type': request.resourceType(),
      }),
      SpanKind.CLIENT,
    );

    // Store span reference with request
    (request as any).__span = span;
  }

  /**
   * Handle response event
   */
  private handleResponse(response: HTTPResponse): void {
    const request = response.request();
    const span = (request as any).__span;
    const requestId = this.getRequestId(request);
    const startTime = this.requestTimes.get(requestId);

    if (span && startTime) {
      const duration = Date.now() - startTime;

      span.setAttributes({
        'http.status_code': response.status(),
        'http.status_text': response.statusText(),
        'http.response.size': this.getResponseSize(response),
        'http.response.headers': this.sanitizeHeaders(response.headers()),
        'network.from_cache': response.fromCache(),
        'network.from_service_worker': response.fromServiceWorker(),
      });

      // Record metrics
      this.metricsCollector.recordNetwork({
        url: sanitizeUrl(request.url()),
        method: request.method(),
        statusCode: response.status(),
        duration,
        requestSize: this.getRequestSize(request),
        responseSize: this.getResponseSize(response),
      });

      const success = response.status() < 400;
      finishSpan(span, startTime, success);

      // Clean up
      this.requestTimes.delete(requestId);
    }
  }

  /**
   * Handle request finished event
   */
  private handleRequestFinished(request: HTTPRequest): void {
    const span = (request as any).__span;
    const requestId = this.getRequestId(request);
    const startTime = this.requestTimes.get(requestId);

    if (span && startTime && !span.isRecording()) {
      // Request finished without response (e.g., redirected)
      finishSpan(span, startTime, true, undefined, {
        'network.finished_without_response': true,
      });

      this.requestTimes.delete(requestId);
    }
  }

  /**
   * Handle request failed event
   */
  private handleRequestFailed(request: HTTPRequest): void {
    const span = (request as any).__span;
    const requestId = this.getRequestId(request);
    const startTime = this.requestTimes.get(requestId);

    if (span && startTime) {
      const duration = Date.now() - startTime;
      const errorText = request.failure()?.errorText ?? 'Request failed';

      span.setAttributes({
        'network.error': errorText,
        'network.failure_reason': request.failure()?.errorText ?? 'unknown',
      });

      // Record metrics
      this.metricsCollector.recordNetwork({
        url: sanitizeUrl(request.url()),
        method: request.method(),
        statusCode: 0, // No status code for failed requests
        duration,
        requestSize: this.getRequestSize(request),
        responseSize: 0, // No response size for failed requests
      });

      const error = new Error(`Network request failed: ${errorText}`);
      this.errorHandler(span, error, 'network.request', {
        url: sanitizeUrl(request.url()),
        method: request.method(),
      });

      finishSpan(span, startTime, false, error);

      // Clean up
      this.requestTimes.delete(requestId);
    }
  }

  /**
   * Get unique request identifier
   */
  private getRequestId(request: HTTPRequest): string {
    // Use URL + method + timestamp for uniqueness
    return `${request.method()}_${request.url()}_${Date.now()}`;
  }

  /**
   * Get request size estimate
   */
  private getRequestSize(request: HTTPRequest): number {
    const postData = request.postData();
    if (postData) {
      return Buffer.byteLength(postData, 'utf8');
    }

    // Estimate header size
    const headers = request.headers();
    const headerSize = Object.entries(headers).reduce(
      (size, [key, value]) => size + key.length + value.length + 4,
      0,
    ); // +4 for ': ' and '\r\n'

    return headerSize + request.url().length;
  }

  /**
   * Get response size estimate
   */
  private getResponseSize(response: HTTPResponse): number {
    const headers = response.headers();
    const contentLength = headers['content-length'];

    if (contentLength) {
      return parseInt(contentLength, 10);
    }

    // Estimate header size if no content-length
    return Object.entries(headers).reduce(
      (size, [key, value]) => size + key.length + value.length + 4,
      0,
    );
  }

  /**
   * Sanitize headers for telemetry
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedHeaders = [
      'content-type',
      'content-length',
      'cache-control',
      'user-agent',
      'accept',
      'accept-language',
      'accept-encoding',
    ];

    // Use Object.keys to avoid object injection warning
    Object.keys(headers).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (allowedHeaders.includes(lowerKey)) {
        // eslint-disable-next-line security/detect-object-injection
        sanitized[lowerKey] = headers[key];
      }
    });

    return sanitized;
  }

  /**
   * Enable request interception for instrumentation
   */
  async enableRequestInterception(page: Page): Promise<void> {
    await page.setRequestInterception(true);

    page.on('request', (request: HTTPRequest) => {
      // Allow all requests to proceed
      void request.continue();
    });
  }

  /**
   * Get network statistics for the page
   */
  getNetworkStats(): Record<string, number> {
    return {
      activeRequests: this.requestTimes.size,
      totalRequests: this.requestTimes.size, // This would need proper tracking
    };
  }

  /**
   * Clear network tracking data
   */
  clearNetworkData(): void {
    this.requestTimes.clear();
  }
}

/**
 * Create network instrumentation instance
 */
export function createNetworkInstrumentation(
  context: InstrumentationContext,
): NetworkInstrumentation {
  return new NetworkInstrumentation(context);
}

/**
 * Instrument page network events
 */
export function instrumentNetworkEvents(
  page: Page,
  context: InstrumentationContext,
): NetworkInstrumentation {
  const instrumentation = createNetworkInstrumentation(context);
  instrumentation.instrumentNetworkEvents(page);
  return instrumentation;
}
