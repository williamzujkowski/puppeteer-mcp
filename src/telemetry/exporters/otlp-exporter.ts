/**
 * OTLP (OpenTelemetry Protocol) exporter configuration
 * @module telemetry/exporters/otlp-exporter
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import type { SpanExporter } from '@opentelemetry/sdk-trace-node';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import type { TelemetryConfig } from '../config.js';
import type { ExporterFactory, ExporterOptions } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Default OTLP headers
 */
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
} as const;

/**
 * OTLP trace exporter factory
 */
export class OTLPTraceExporterFactory implements ExporterFactory<SpanExporter> {
  create(config: TelemetryConfig): SpanExporter | null {
    const endpoint = config.tracing.endpoints.otlp;
    
    if (!endpoint || endpoint.trim() === '') {
      logger.warn('OTLP trace endpoint not configured');
      return null;
    }

    logger.info({
      endpoint,
    }, 'Creating OTLP trace exporter');

    return new OTLPTraceExporter({
      url: endpoint,
      headers: DEFAULT_HEADERS,
      timeoutMillis: config.export.timeout,
    });
  }

  getType(): string {
    return 'otlp';
  }
}

/**
 * OTLP metric exporter factory
 */
export class OTLPMetricExporterFactory implements ExporterFactory<PushMetricExporter> {
  create(config: TelemetryConfig): PushMetricExporter | null {
    const endpoint = config.metrics.endpoints.otlp;
    
    if (!endpoint || endpoint.trim() === '') {
      logger.warn('OTLP metrics endpoint not configured');
      return null;
    }

    logger.info({
      endpoint,
    }, 'Creating OTLP metric exporter');

    return new OTLPMetricExporter({
      url: endpoint,
      headers: DEFAULT_HEADERS,
      timeoutMillis: config.export.timeout,
    });
  }

  getType(): string {
    return 'otlp';
  }
}

/**
 * Create OTLP trace exporter with custom options
 */
export function createOTLPTraceExporter(
  endpoint: string,
  options: ExporterOptions = {}
): SpanExporter {
  const exporterOptions = {
    url: endpoint,
    headers: { ...DEFAULT_HEADERS, ...options.headers },
    timeoutMillis: options.timeout ?? 5000,
  };

  logger.info({ endpoint, options }, 'Creating OTLP trace exporter with custom options');
  
  return new OTLPTraceExporter(exporterOptions);
}

/**
 * Create OTLP metric exporter with custom options
 */
export function createOTLPMetricExporter(
  endpoint: string,
  options: ExporterOptions = {}
): PushMetricExporter {
  const exporterOptions = {
    url: endpoint,
    headers: { ...DEFAULT_HEADERS, ...options.headers },
    timeoutMillis: options.timeout ?? 5000,
  };

  logger.info({ endpoint, options }, 'Creating OTLP metric exporter with custom options');
  
  return new OTLPMetricExporter(exporterOptions);
}

/**
 * Validate OTLP endpoint URL
 */
export function validateOTLPEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}