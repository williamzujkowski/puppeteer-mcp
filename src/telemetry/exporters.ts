/**
 * OpenTelemetry exporters configuration
 * @module telemetry/exporters
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { SpanExporter } from '@opentelemetry/sdk-trace-node';
import { MetricExporter, PushMetricExporter } from '@opentelemetry/sdk-metrics';
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
 * Exporter health check
 */
export async function checkExporterHealth(config: TelemetryConfig): Promise<{
  traces: boolean;
  metrics: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let tracesHealthy = false;
  let metricsHealthy = false;
  
  // Check trace exporter endpoint
  if (config.tracing.enabled && config.tracing.exporter !== 'none' && config.tracing.exporter !== 'console') {
    try {
      let endpoint: string;
      switch (config.tracing.exporter) {
        case 'otlp':
          endpoint = config.tracing.endpoints.otlp;
          break;
        case 'jaeger':
          endpoint = config.tracing.endpoints.jaeger;
          break;
        case 'zipkin':
          endpoint = config.tracing.endpoints.zipkin;
          break;
        default:
          endpoint = '';
      }
      
      if (endpoint) {
        const url = new URL(endpoint);
        // Simple connectivity check
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        try {
          const response = await fetch(url.origin, { 
            signal: controller.signal,
            method: 'HEAD',
          });
          tracesHealthy = response.ok || response.status === 405; // Method not allowed is ok
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            errors.push(`Trace exporter endpoint timeout: ${endpoint}`);
          } else {
            errors.push(`Trace exporter endpoint unreachable: ${endpoint}`);
          }
        } finally {
          clearTimeout(timeout);
        }
      }
    } catch (error) {
      errors.push(`Invalid trace exporter configuration: ${error}`);
    }
  } else {
    tracesHealthy = true; // If disabled or console, consider healthy
  }
  
  // Check metric exporter endpoint
  if (config.metrics.enabled && config.metrics.exporter === 'otlp') {
    try {
      const endpoint = config.metrics.endpoints.otlp;
      const url = new URL(endpoint);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(url.origin, { 
          signal: controller.signal,
          method: 'HEAD',
        });
        metricsHealthy = response.ok || response.status === 405;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          errors.push(`Metric exporter endpoint timeout: ${endpoint}`);
        } else {
          errors.push(`Metric exporter endpoint unreachable: ${endpoint}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      errors.push(`Invalid metric exporter configuration: ${error}`);
    }
  } else {
    metricsHealthy = true; // If disabled, prometheus, or console, consider healthy
  }
  
  return {
    traces: tracesHealthy,
    metrics: metricsHealthy,
    errors,
  };
}