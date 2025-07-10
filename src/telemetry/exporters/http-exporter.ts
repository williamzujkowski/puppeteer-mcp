/**
 * HTTP-based custom exporter for telemetry data
 * @module telemetry/exporters/http-exporter
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-node';
import type { PushMetricExporter, ResourceMetrics } from '@opentelemetry/sdk-metrics';
import type { ExportResult } from '@opentelemetry/core';
import { ExportResultCode } from '@opentelemetry/core';
import type { TelemetryConfig } from '../config.js';
import type { ExporterFactory, ExporterOptions } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * HTTP exporter configuration
 */
interface HTTPExporterConfig {
  endpoint: string;
  timeout: number;
  headers: Record<string, string>;
  method: 'POST' | 'PUT';
  retryCount: number;
  retryDelay: number;
}

/**
 * Default HTTP exporter configuration
 */
const DEFAULT_CONFIG: HTTPExporterConfig = {
  endpoint: 'http://localhost:8080/telemetry',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'puppeteer-mcp-telemetry/1.0',
  },
  method: 'POST',
  retryCount: 3,
  retryDelay: 1000,
};

/**
 * HTTP-based span exporter
 */
export class HTTPSpanExporter implements SpanExporter {
  private readonly config: HTTPExporterConfig;

  constructor(config: Partial<HTTPExporterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.exportAsync(spans, resultCallback).catch((error) => {
      logger.error({ error, endpoint: this.config.endpoint }, 'Failed to export spans via HTTP');
      resultCallback({ 
        code: ExportResultCode.FAILED,
        error: error instanceof Error ? error : new Error(String(error))
      });
    });
  }

  private async exportAsync(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): Promise<void> {
    const payload = {
      type: 'spans',
      timestamp: new Date().toISOString(),
      data: spans,
    };

    await this.sendWithRetry(payload);
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for HTTP exporter
  }

  async forceFlush(): Promise<void> {
    // HTTP requests are sent immediately, no flushing needed
  }

  private async sendWithRetry(payload: unknown, attempt: number = 1): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(this.config.endpoint, {
          method: this.config.method,
          headers: this.config.headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (attempt < this.config.retryCount) {
        logger.warn(
          { error, attempt, endpoint: this.config.endpoint },
          'HTTP export failed, retrying'
        );
        
        await this.delay(this.config.retryDelay * attempt);
        return this.sendWithRetry(payload, attempt + 1);
      }
      
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(resolve, ms);
    });
  }
}

/**
 * HTTP-based metric exporter
 */
export class HTTPMetricExporter implements PushMetricExporter {
  private readonly config: HTTPExporterConfig;

  constructor(config: Partial<HTTPExporterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Use different default endpoint for metrics
    if (config.endpoint === undefined || config.endpoint.trim() === '') {
      this.config.endpoint = 'http://localhost:8080/metrics';
    }
  }

  export(metrics: ResourceMetrics, resultCallback: (result: ExportResult) => void): void {
    this.exportAsync(metrics, resultCallback).catch((error) => {
      logger.error({ error, endpoint: this.config.endpoint }, 'Failed to export metrics via HTTP');
      resultCallback({ 
        code: ExportResultCode.FAILED,
        error: error instanceof Error ? error : new Error(String(error))
      });
    });
  }

  private async exportAsync(metrics: ResourceMetrics, resultCallback: (result: ExportResult) => void): Promise<void> {
    const payload = {
      type: 'metrics',
      timestamp: new Date().toISOString(),
      data: metrics,
    };

    await this.sendWithRetry(payload);
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for HTTP exporter
  }

  async forceFlush(): Promise<void> {
    // HTTP requests are sent immediately, no flushing needed
  }

  private async sendWithRetry(payload: unknown, attempt: number = 1): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(this.config.endpoint, {
          method: this.config.method,
          headers: this.config.headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (attempt < this.config.retryCount) {
        logger.warn(
          { error, attempt, endpoint: this.config.endpoint },
          'HTTP metrics export failed, retrying'
        );
        
        await this.delay(this.config.retryDelay * attempt);
        return this.sendWithRetry(payload, attempt + 1);
      }
      
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(resolve, ms);
    });
  }
}

/**
 * HTTP trace exporter factory
 */
export class HTTPTraceExporterFactory implements ExporterFactory<SpanExporter> {
  create(config: TelemetryConfig): SpanExporter {
    const endpoint = process.env.TELEMETRY_HTTP_TRACES_ENDPOINT ?? DEFAULT_CONFIG.endpoint;
    
    logger.info({ endpoint }, 'Creating HTTP trace exporter');
    
    return new HTTPSpanExporter({
      endpoint,
      timeout: config.export.timeout,
    });
  }

  getType(): string {
    return 'http';
  }
}

/**
 * HTTP metric exporter factory
 */
export class HTTPMetricExporterFactory implements ExporterFactory<PushMetricExporter> {
  create(config: TelemetryConfig): PushMetricExporter {
    const endpoint = process.env.TELEMETRY_HTTP_METRICS_ENDPOINT ?? 'http://localhost:8080/metrics';
    
    logger.info({ endpoint }, 'Creating HTTP metric exporter');
    
    return new HTTPMetricExporter({
      endpoint,
      timeout: config.export.timeout,
    });
  }

  getType(): string {
    return 'http';
  }
}

/**
 * Create HTTP span exporter with custom options
 */
export function createHTTPSpanExporter(options: ExporterOptions & Partial<HTTPExporterConfig> = {}): HTTPSpanExporter {
  return new HTTPSpanExporter(options);
}

/**
 * Create HTTP metric exporter with custom options
 */
export function createHTTPMetricExporter(options: ExporterOptions & Partial<HTTPExporterConfig> = {}): HTTPMetricExporter {
  return new HTTPMetricExporter(options);
}

/**
 * Validate HTTP endpoint URL
 */
export function validateHTTPEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}