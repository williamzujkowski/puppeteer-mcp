/**
 * Console-based exporter for development and debugging
 * @module telemetry/exporters/console-exporter
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import type { SpanExporter } from '@opentelemetry/sdk-trace-node';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import type { TelemetryConfig } from '../config.js';
import type { ExporterFactory } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Console trace exporter factory
 */
export class ConsoleTraceExporterFactory implements ExporterFactory<SpanExporter> {
  create(_config: TelemetryConfig): SpanExporter {
    logger.info('Creating console trace exporter');
    return new ConsoleSpanExporter();
  }

  getType(): string {
    return 'console';
  }
}

/**
 * Console metric exporter factory
 */
export class ConsoleMetricExporterFactory implements ExporterFactory<PushMetricExporter> {
  create(_config: TelemetryConfig): PushMetricExporter {
    logger.info('Creating console metric exporter');
    return new ConsoleMetricExporter();
  }

  getType(): string {
    return 'console';
  }
}

/**
 * Create console trace exporter
 */
export function createConsoleTraceExporter(): SpanExporter {
  const factory = new ConsoleTraceExporterFactory();
  return factory.create({} as TelemetryConfig);
}

/**
 * Create console metric exporter
 */
export function createConsoleMetricExporter(): PushMetricExporter {
  const factory = new ConsoleMetricExporterFactory();
  return factory.create({} as TelemetryConfig);
}