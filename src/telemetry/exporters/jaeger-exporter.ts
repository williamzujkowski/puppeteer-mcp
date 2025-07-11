/**
 * Jaeger tracing exporter configuration
 * @module telemetry/exporters/jaeger-exporter
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import type { SpanExporter } from '@opentelemetry/sdk-trace-node';
import type { TelemetryConfig } from '../config.js';
import type { ExporterFactory, ExporterOptions } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Default Jaeger configuration
 */
const DEFAULT_CONFIG = {
  maxPacketSize: 65000,
  endpoint: 'http://localhost:14268/api/traces',
} as const;

/**
 * Jaeger trace exporter factory
 */
export class JaegerExporterFactory implements ExporterFactory<SpanExporter> {
  create(config: TelemetryConfig): SpanExporter | null {
    const endpoint = config.tracing.endpoints.jaeger;

    if (!endpoint || endpoint.trim() === '') {
      logger.warn('Jaeger endpoint not configured');
      return null;
    }

    logger.info(
      {
        endpoint,
        maxPacketSize: DEFAULT_CONFIG.maxPacketSize,
      },
      'Creating Jaeger trace exporter',
    );

    return new JaegerExporter({
      endpoint,
      maxPacketSize: DEFAULT_CONFIG.maxPacketSize,
    });
  }

  getType(): string {
    return 'jaeger';
  }
}

/**
 * Create Jaeger exporter with custom options
 */
export function createJaegerExporter(
  endpoint: string,
  options: ExporterOptions = {},
): SpanExporter {
  const exporterOptions = {
    endpoint,
    maxPacketSize: options.maxPacketSize ?? DEFAULT_CONFIG.maxPacketSize,
  };

  logger.info({ endpoint, options }, 'Creating Jaeger exporter with custom options');

  return new JaegerExporter(exporterOptions);
}

/**
 * Validate Jaeger endpoint URL
 */
export function validateJaegerEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.pathname.includes('/api/traces')
    );
  } catch {
    return false;
  }
}

/**
 * Validate Jaeger max packet size
 */
export function validateJaegerMaxPacketSize(size: number): boolean {
  return Number.isInteger(size) && size > 0 && size <= 65536;
}

/**
 * Get default Jaeger endpoint for environment
 */
export function getDefaultJaegerEndpoint(
  hostname: string = 'localhost',
  port: number = 14268,
): string {
  return `http://${hostname}:${port}/api/traces`;
}

/**
 * Parse Jaeger endpoint components
 */
export function parseJaegerEndpoint(endpoint: string): {
  protocol: string;
  hostname: string;
  port: string;
  path: string;
} | null {
  try {
    const url = new URL(endpoint);
    return {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
    };
  } catch {
    return null;
  }
}
