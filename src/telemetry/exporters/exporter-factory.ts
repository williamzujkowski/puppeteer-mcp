/**
 * Factory for creating and configuring exporters
 * @module telemetry/exporters/exporter-factory
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import type { SpanExporter } from '@opentelemetry/sdk-trace-node';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import type { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import type { TelemetryConfig } from '../config.js';
import type { TraceExporterType, MetricExporterType, ExporterFactory } from './types.js';
import { ConsoleTraceExporterFactory, ConsoleMetricExporterFactory } from './console-exporter.js';
import { OTLPTraceExporterFactory, OTLPMetricExporterFactory } from './otlp-exporter.js';
import { PrometheusExporterFactory } from './prometheus-exporter.js';
import { JaegerExporterFactory } from './jaeger-exporter.js';
// Optional extended exporters - available but not registered by default
// import { FileTraceExporterFactory, FileMetricExporterFactory } from './file-exporter.js';
// import { HTTPTraceExporterFactory, HTTPMetricExporterFactory } from './http-exporter.js';
import { logger } from '../../utils/logger.js';

/**
 * Zipkin trace exporter factory
 */
export class ZipkinExporterFactory implements ExporterFactory<SpanExporter> {
  create(config: TelemetryConfig): SpanExporter | null {
    const endpoint = config.tracing.endpoints.zipkin;
    
    if (!endpoint || endpoint.trim() === '') {
      logger.warn('Zipkin endpoint not configured');
      return null;
    }

    logger.info({
      endpoint,
      serviceName: config.serviceName,
    }, 'Creating Zipkin trace exporter');

    return new ZipkinExporter({
      url: endpoint,
      serviceName: config.serviceName,
    });
  }

  getType(): string {
    return 'zipkin';
  }
}

/**
 * Registry of trace exporter factories
 */
class TraceExporterFactoryRegistry {
  private readonly factories = new Map<TraceExporterType, ExporterFactory<SpanExporter>>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.factories.set('console', new ConsoleTraceExporterFactory());
    this.factories.set('otlp', new OTLPTraceExporterFactory());
    this.factories.set('jaeger', new JaegerExporterFactory());
    this.factories.set('zipkin', new ZipkinExporterFactory());
  }

  register(type: TraceExporterType, factory: ExporterFactory<SpanExporter>): void {
    this.factories.set(type, factory);
    logger.debug({ type, factoryType: factory.getType() }, 'Registered trace exporter factory');
  }

  get(type: TraceExporterType): ExporterFactory<SpanExporter> | undefined {
    return this.factories.get(type);
  }

  getAvailableTypes(): TraceExporterType[] {
    return Array.from(this.factories.keys());
  }
}

/**
 * Registry of metric exporter factories
 */
class MetricExporterFactoryRegistry {
  private readonly factories = new Map<MetricExporterType, ExporterFactory<PushMetricExporter | PrometheusExporter>>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.factories.set('console', new ConsoleMetricExporterFactory());
    this.factories.set('otlp', new OTLPMetricExporterFactory());
    this.factories.set('prometheus', new PrometheusExporterFactory());
  }

  register(type: MetricExporterType, factory: ExporterFactory<PushMetricExporter | PrometheusExporter>): void {
    this.factories.set(type, factory);
    logger.debug({ type, factoryType: factory.getType() }, 'Registered metric exporter factory');
  }

  get(type: MetricExporterType): ExporterFactory<PushMetricExporter | PrometheusExporter> | undefined {
    return this.factories.get(type);
  }

  getAvailableTypes(): MetricExporterType[] {
    return Array.from(this.factories.keys());
  }
}

/**
 * Global factory registries
 */
const traceFactoryRegistry = new TraceExporterFactoryRegistry();
const metricFactoryRegistry = new MetricExporterFactoryRegistry();

/**
 * Create trace exporter based on configuration
 */
export function createTraceExporter(config: TelemetryConfig): SpanExporter | null {
  if (!config.tracing.enabled) {
    logger.debug('Trace exporter creation skipped - tracing disabled');
    return null;
  }

  const exporterType = config.tracing.exporter;
  
  if (exporterType === 'none') {
    logger.info('Trace exporter disabled');
    return null;
  }

  const factory = traceFactoryRegistry.get(exporterType);
  
  if (!factory) {
    logger.warn(
      { exporter: exporterType, available: traceFactoryRegistry.getAvailableTypes() },
      'Unknown trace exporter type, falling back to console'
    );
    const consoleFactory = traceFactoryRegistry.get('console');
    return consoleFactory?.create(config) ?? null;
  }

  try {
    const exporter = factory.create(config);
    if (exporter) {
      logger.info({ type: exporterType }, 'Successfully created trace exporter');
    }
    return exporter;
  } catch (error) {
    logger.error(
      { error, type: exporterType },
      'Failed to create trace exporter, falling back to console'
    );
    const consoleFactory = traceFactoryRegistry.get('console');
    return consoleFactory?.create(config) ?? null;
  }
}

/**
 * Create metric exporter based on configuration
 */
export function createMetricExporter(config: TelemetryConfig): PushMetricExporter | PrometheusExporter | null {
  if (!config.metrics.enabled) {
    logger.debug('Metric exporter creation skipped - metrics disabled');
    return null;
  }

  const exporterType = config.metrics.exporter;
  
  if (exporterType === 'none') {
    logger.info('Metric exporter disabled');
    return null;
  }

  const factory = metricFactoryRegistry.get(exporterType);
  
  if (!factory) {
    logger.warn(
      { exporter: exporterType, available: metricFactoryRegistry.getAvailableTypes() },
      'Unknown metric exporter type, falling back to console'
    );
    const consoleFactory = metricFactoryRegistry.get('console');
    return consoleFactory?.create(config) ?? null;
  }

  try {
    const exporter = factory.create(config);
    if (exporter) {
      logger.info({ type: exporterType }, 'Successfully created metric exporter');
    }
    return exporter;
  } catch (error) {
    logger.error(
      { error, type: exporterType },
      'Failed to create metric exporter, falling back to console'
    );
    const consoleFactory = metricFactoryRegistry.get('console');
    return consoleFactory?.create(config) ?? null;
  }
}

/**
 * Create multiple trace exporters for failover
 */
export function createMultiTraceExporter(config: TelemetryConfig): SpanExporter[] {
  const exporters: SpanExporter[] = [];
  
  // Primary exporter
  const primary = createTraceExporter(config);
  if (primary) {
    exporters.push(primary);
  }
  
  // Add console exporter in debug mode (if not already the primary)
  if (config.debug.enabled && config.tracing.exporter !== 'console') {
    const consoleFactory = traceFactoryRegistry.get('console');
    const consoleExporter = consoleFactory?.create(config);
    if (consoleExporter) {
      exporters.push(consoleExporter);
      logger.debug('Added console trace exporter for debug mode');
    }
  }
  
  logger.info({ count: exporters.length }, 'Created multi-trace exporter setup');
  return exporters;
}

/**
 * Create multiple metric exporters
 */
export function createMultiMetricExporter(config: TelemetryConfig): Array<PushMetricExporter | PrometheusExporter> {
  const exporters: Array<PushMetricExporter | PrometheusExporter> = [];
  
  // Primary exporter
  const primary = createMetricExporter(config);
  if (primary) {
    exporters.push(primary);
  }
  
  // Add console exporter in debug mode (if not already the primary)
  if (config.debug.enabled && config.metrics.exporter !== 'console') {
    const consoleFactory = metricFactoryRegistry.get('console');
    const consoleExporter = consoleFactory?.create(config);
    if (consoleExporter) {
      exporters.push(consoleExporter);
      logger.debug('Added console metric exporter for debug mode');
    }
  }
  
  logger.info({ count: exporters.length }, 'Created multi-metric exporter setup');
  return exporters;
}

/**
 * Register custom trace exporter factory
 */
export function registerTraceExporterFactory(
  type: TraceExporterType,
  factory: ExporterFactory<SpanExporter>
): void {
  traceFactoryRegistry.register(type, factory);
}

/**
 * Register custom metric exporter factory
 */
export function registerMetricExporterFactory(
  type: MetricExporterType,
  factory: ExporterFactory<PushMetricExporter | PrometheusExporter>
): void {
  metricFactoryRegistry.register(type, factory);
}

/**
 * Get available trace exporter types
 */
export function getAvailableTraceExporterTypes(): TraceExporterType[] {
  return traceFactoryRegistry.getAvailableTypes();
}

/**
 * Get available metric exporter types
 */
export function getAvailableMetricExporterTypes(): MetricExporterType[] {
  return metricFactoryRegistry.getAvailableTypes();
}

/**
 * Register extended exporter factories (file, http)
 */
export function registerExtendedExporterFactories(): void {
  // These are optional exporters that can be registered as needed
  logger.info('Registering extended exporter factories');
  
  // Note: These would extend the TraceExporterType and MetricExporterType unions
  // For now, they're available through direct factory instantiation
  // Factories are available: FileTraceExporterFactory, FileMetricExporterFactory,
  // HTTPTraceExporterFactory, HTTPMetricExporterFactory
  
  logger.debug('Extended exporter factories available for direct use');
}