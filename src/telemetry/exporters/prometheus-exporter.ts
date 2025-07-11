/**
 * Prometheus metrics exporter configuration
 * @module telemetry/exporters/prometheus-exporter
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import type { TelemetryConfig } from '../config.js';
import type { ExporterFactory, ExporterOptions } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Default Prometheus configuration
 */
const DEFAULT_CONFIG = {
  endpoint: '/metrics',
  prefix: 'puppeteer_mcp_',
  port: 9464,
} as const;

/**
 * Prometheus metric exporter factory
 */
export class PrometheusExporterFactory implements ExporterFactory<PrometheusExporter> {
  create(config: TelemetryConfig): PrometheusExporter {
    const port = config.metrics.endpoints.prometheusPort || DEFAULT_CONFIG.port;

    logger.info(
      {
        port,
        endpoint: DEFAULT_CONFIG.endpoint,
        prefix: DEFAULT_CONFIG.prefix,
      },
      'Creating Prometheus metric exporter',
    );

    return new PrometheusExporter({
      port,
      endpoint: DEFAULT_CONFIG.endpoint,
      prefix: DEFAULT_CONFIG.prefix,
    });
  }

  getType(): string {
    return 'prometheus';
  }
}

/**
 * Create Prometheus exporter with custom options
 */
export function createPrometheusExporter(options: ExporterOptions = {}): PrometheusExporter {
  const exporterOptions = {
    port: options.port ?? DEFAULT_CONFIG.port,
    endpoint: options.endpoint ?? DEFAULT_CONFIG.endpoint,
    prefix: options.prefix ?? DEFAULT_CONFIG.prefix,
  };

  logger.info(exporterOptions, 'Creating Prometheus exporter with custom options');

  return new PrometheusExporter(exporterOptions);
}

/**
 * Validate Prometheus port
 */
export function validatePrometheusPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * Validate Prometheus endpoint path
 */
export function validatePrometheusEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/') && endpoint.length > 1;
}

/**
 * Validate Prometheus metric prefix
 */
export function validatePrometheusPrefix(prefix: string): boolean {
  // Prometheus metric names must match [a-zA-Z_:][a-zA-Z0-9_:]*
  const validPrefixRegex = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
  return validPrefixRegex.test(prefix);
}

/**
 * Get Prometheus metrics endpoint URL
 */
export function getPrometheusMetricsUrl(
  port: number,
  endpoint: string = DEFAULT_CONFIG.endpoint,
): string {
  return `http://localhost:${port}${endpoint}`;
}
