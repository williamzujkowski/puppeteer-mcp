/**
 * HTTP metrics module
 * @module telemetry/metrics/app-metrics/http-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { Meter } from '@opentelemetry/api';
import { HttpMetrics, HttpRequestLabels, HttpRequestOptions } from './types.js';

/**
 * HTTP metrics implementation
 */
export class HttpMetricsImpl implements HttpMetrics {
  public readonly meter: Meter;
  public readonly httpRequestsTotal;
  public readonly httpRequestDuration;
  public readonly httpRequestSize;
  public readonly httpResponseSize;
  public readonly httpActiveRequests;

  constructor(meter: Meter) {
    this.meter = meter;
    
    this.httpRequestsTotal = meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
      unit: '1',
    });
    
    this.httpRequestDuration = meter.createHistogram('http_request_duration_ms', {
      description: 'HTTP request duration in milliseconds',
      unit: 'ms',
    });
    
    this.httpRequestSize = meter.createHistogram('http_request_size_bytes', {
      description: 'HTTP request size in bytes',
      unit: 'By',
    });
    
    this.httpResponseSize = meter.createHistogram('http_response_size_bytes', {
      description: 'HTTP response size in bytes',
      unit: 'By',
    });
    
    this.httpActiveRequests = meter.createUpDownCounter('http_active_requests', {
      description: 'Number of active HTTP requests',
      unit: '1',
    });
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(options: HttpRequestOptions): void {
    const { method, route, statusCode, duration, requestSize = 0, responseSize = 0 } = options;
    
    const labels: HttpRequestLabels = {
      method,
      route,
      status_code: statusCode.toString(),
      status_class: `${Math.floor(statusCode / 100)}xx`,
    };
    
    this.httpRequestsTotal.add(1, labels);
    this.httpRequestDuration.record(duration, labels);
    
    if (requestSize > 0) {
      this.httpRequestSize.record(requestSize, labels);
    }
    
    if (responseSize > 0) {
      this.httpResponseSize.record(responseSize, labels);
    }
  }

  /**
   * Record HTTP request metrics (legacy method)
   */
  recordHttpRequestLegacy(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize: number = 0,
    responseSize: number = 0,
  ): void {
    this.recordHttpRequest({
      method,
      route,
      statusCode,
      duration,
      requestSize,
      responseSize,
    });
  }

  /**
   * Increment active requests
   */
  incrementActiveRequests(): void {
    this.httpActiveRequests.add(1);
  }

  /**
   * Decrement active requests
   */
  decrementActiveRequests(): void {
    this.httpActiveRequests.add(-1);
  }
}