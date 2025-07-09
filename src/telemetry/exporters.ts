/**
 * OpenTelemetry exporters configuration
 * @module telemetry/exporters
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { SpanExporter } from '@opentelemetry/sdk-trace-node';
import { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import type { TelemetryConfig } from './config.js';
import { logger } from '../utils/logger.js';

/**
 * Create trace exporter based on configuration
 */
export function createTraceExporter(config: TelemetryConfig): SpanExporter | null {
  if (!config.tracing.enabled) {
    return null;
  }

  switch (config.tracing.exporter) {
    case 'otlp':
      logger.info({
        endpoint: config.tracing.endpoints.otlp,
      }, 'Creating OTLP trace exporter');
      
      return new OTLPTraceExporter({
        url: config.tracing.endpoints.otlp,
        headers: {
          'Content-Type': 'application/json',
        },
        timeoutMillis: config.export.timeout,
      });

    case 'jaeger':
      logger.info({
        endpoint: config.tracing.endpoints.jaeger,
      }, 'Creating Jaeger trace exporter');
      
      return new JaegerExporter({
        endpoint: config.tracing.endpoints.jaeger,
        maxPacketSize: 65000,
      });

    case 'zipkin':
      logger.info({
        endpoint: config.tracing.endpoints.zipkin,
      }, 'Creating Zipkin trace exporter');
      
      return new ZipkinExporter({
        url: config.tracing.endpoints.zipkin,
        serviceName: config.serviceName,
      });

    case 'console':
      logger.info('Creating console trace exporter');
      return new ConsoleSpanExporter();

    case 'none':
      logger.info('Trace exporter disabled');
      return null;

    default:
      logger.warn(
        { exporter: config.tracing.exporter },
        'Unknown trace exporter type, falling back to console',
      );
      return new ConsoleSpanExporter();
  }
}

/**
 * Create metric exporter based on configuration
 */
export function createMetricExporter(config: TelemetryConfig): PushMetricExporter | PrometheusExporter | null {
  if (!config.metrics.enabled) {
    return null;
  }

  switch (config.metrics.exporter) {
    case 'otlp':
      logger.info({
        endpoint: config.metrics.endpoints.otlp,
      }, 'Creating OTLP metric exporter');
      
      return new OTLPMetricExporter({
        url: config.metrics.endpoints.otlp,
        headers: {
          'Content-Type': 'application/json',
        },
        timeoutMillis: config.export.timeout,
      });

    case 'prometheus':
      logger.info({
        port: config.metrics.endpoints.prometheusPort,
      }, 'Creating Prometheus metric exporter');
      
      return new PrometheusExporter({
        port: config.metrics.endpoints.prometheusPort,
        endpoint: '/metrics',
        prefix: 'puppeteer_mcp_',
      });

    case 'console':
      logger.info('Creating console metric exporter');
      return new ConsoleMetricExporter();

    case 'none':
      logger.info('Metric exporter disabled');
      return null;

    default:
      logger.warn(
        { exporter: config.metrics.exporter },
        'Unknown metric exporter type, falling back to console',
      );
      return new ConsoleMetricExporter();
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
  
  // Add console exporter in debug mode
  if (config.debug.enabled && config.tracing.exporter !== 'console') {
    exporters.push(new ConsoleSpanExporter());
  }
  
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
  
  // Add console exporter in debug mode
  if (config.debug.enabled && config.metrics.exporter !== 'console') {
    exporters.push(new ConsoleMetricExporter());
  }
  
  return exporters;
}

/**
 * Health check result interface
 */
interface HealthCheckResult {
  healthy: boolean;
  errors: string[];
}

/**
 * Health check strategy interface
 */
interface HealthCheckStrategy {
  getEndpoint(config: TelemetryConfig): string | null;
  requiresConnectivityCheck(): boolean;
  getConfigurationErrorPrefix(): string;
}

/**
 * Health check command interface
 */
interface HealthCheckCommand {
  execute(): Promise<HealthCheckResult>;
}

/**
 * OTLP health check strategy
 */
class OTLPHealthCheckStrategy implements HealthCheckStrategy {
  getEndpoint(config: TelemetryConfig): string | null {
    return config.tracing.endpoints.otlp || config.metrics.endpoints.otlp;
  }

  requiresConnectivityCheck(): boolean {
    return true;
  }

  getConfigurationErrorPrefix(): string {
    return 'Invalid OTLP exporter configuration';
  }
}

/**
 * Jaeger health check strategy
 */
class JaegerHealthCheckStrategy implements HealthCheckStrategy {
  getEndpoint(config: TelemetryConfig): string | null {
    return config.tracing.endpoints.jaeger;
  }

  requiresConnectivityCheck(): boolean {
    return true;
  }

  getConfigurationErrorPrefix(): string {
    return 'Invalid Jaeger exporter configuration';
  }
}

/**
 * Zipkin health check strategy
 */
class ZipkinHealthCheckStrategy implements HealthCheckStrategy {
  getEndpoint(config: TelemetryConfig): string | null {
    return config.tracing.endpoints.zipkin;
  }

  requiresConnectivityCheck(): boolean {
    return true;
  }

  getConfigurationErrorPrefix(): string {
    return 'Invalid Zipkin exporter configuration';
  }
}

/**
 * Console health check strategy
 */
class ConsoleHealthCheckStrategy implements HealthCheckStrategy {
  getEndpoint(): string | null {
    return null;
  }

  requiresConnectivityCheck(): boolean {
    return false;
  }

  getConfigurationErrorPrefix(): string {
    return 'Invalid console exporter configuration';
  }
}

/**
 * None health check strategy
 */
class NoneHealthCheckStrategy implements HealthCheckStrategy {
  getEndpoint(): string | null {
    return null;
  }

  requiresConnectivityCheck(): boolean {
    return false;
  }

  getConfigurationErrorPrefix(): string {
    return 'Invalid none exporter configuration';
  }
}

/**
 * Connectivity checker utility
 */
class ConnectivityChecker {
  private static readonly TIMEOUT_MS = 5000;

  static async checkEndpoint(endpoint: string, errorPrefix: string): Promise<HealthCheckResult> {
    try {
      const url = new URL(endpoint);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      try {
        const response = await fetch(url.origin, {
          signal: controller.signal,
          method: 'HEAD',
        });
        
        const healthy = response.ok || response.status === 405; // Method not allowed is ok
        return { healthy, errors: [] };
      } catch (error) {
        const errorMessage = error instanceof Error && error.name === 'AbortError'
          ? `${errorPrefix} endpoint timeout: ${endpoint}`
          : `${errorPrefix} endpoint unreachable: ${endpoint}`;
        
        return { healthy: false, errors: [errorMessage] };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      return {
        healthy: false,
        errors: [`Invalid ${errorPrefix.toLowerCase()} configuration: ${String(error)}`]
      };
    }
  }
}

/**
 * Health check strategy factory
 */
class HealthCheckStrategyFactory {
  static createStrategy(exporterType: string): HealthCheckStrategy {
    switch (exporterType) {
      case 'otlp':
        return new OTLPHealthCheckStrategy();
      case 'jaeger':
        return new JaegerHealthCheckStrategy();
      case 'zipkin':
        return new ZipkinHealthCheckStrategy();
      case 'console':
        return new ConsoleHealthCheckStrategy();
      case 'none':
        return new NoneHealthCheckStrategy();
      default:
        return new ConsoleHealthCheckStrategy(); // Default fallback
    }
  }
}

/**
 * Trace health check command
 */
class TraceHealthCheckCommand implements HealthCheckCommand {
  constructor(private config: TelemetryConfig) {}

  async execute(): Promise<HealthCheckResult> {
    if (!this.config.tracing.enabled) {
      return { healthy: true, errors: [] };
    }

    const strategy = HealthCheckStrategyFactory.createStrategy(this.config.tracing.exporter);
    
    if (!strategy.requiresConnectivityCheck()) {
      return { healthy: true, errors: [] };
    }

    const endpoint = strategy.getEndpoint(this.config);
    if (!endpoint || endpoint.trim() === '') {
      return { healthy: true, errors: [] };
    }

    return ConnectivityChecker.checkEndpoint(endpoint, 'Trace exporter');
  }
}

/**
 * Metric health check command
 */
class MetricHealthCheckCommand implements HealthCheckCommand {
  constructor(private config: TelemetryConfig) {}

  async execute(): Promise<HealthCheckResult> {
    if (!this.config.metrics.enabled || this.config.metrics.exporter !== 'otlp') {
      return { healthy: true, errors: [] };
    }

    const strategy = HealthCheckStrategyFactory.createStrategy(this.config.metrics.exporter);
    const endpoint = strategy.getEndpoint(this.config);
    
    if (!endpoint || endpoint.trim() === '') {
      return { healthy: true, errors: [] };
    }

    return ConnectivityChecker.checkEndpoint(endpoint, 'Metric exporter');
  }
}

/**
 * Health check result builder
 */
class HealthCheckResultBuilder {
  private traceResult: HealthCheckResult = { healthy: true, errors: [] };
  private metricResult: HealthCheckResult = { healthy: true, errors: [] };

  withTraceResult(result: HealthCheckResult): this {
    this.traceResult = result;
    return this;
  }

  withMetricResult(result: HealthCheckResult): this {
    this.metricResult = result;
    return this;
  }

  build(): { traces: boolean; metrics: boolean; errors: string[] } {
    return {
      traces: this.traceResult.healthy,
      metrics: this.metricResult.healthy,
      errors: [...this.traceResult.errors, ...this.metricResult.errors],
    };
  }
}

/**
 * Exporter health check
 */
export async function checkExporterHealth(config: TelemetryConfig): Promise<{
  traces: boolean;
  metrics: boolean;
  errors: string[];
}> {
  const traceCommand = new TraceHealthCheckCommand(config);
  const metricCommand = new MetricHealthCheckCommand(config);

  const [traceResult, metricResult] = await Promise.all([
    traceCommand.execute(),
    metricCommand.execute(),
  ]);

  return new HealthCheckResultBuilder()
    .withTraceResult(traceResult)
    .withMetricResult(metricResult)
    .build();
}