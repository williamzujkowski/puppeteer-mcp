/**
 * Shared types and interfaces for OpenTelemetry exporters
 * @module telemetry/exporters/types
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { SpanExporter } from '@opentelemetry/sdk-trace-node';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import type { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import type { TelemetryConfig } from '../config.js';

/**
 * Supported trace exporter types
 */
export type TraceExporterType = 'otlp' | 'jaeger' | 'zipkin' | 'console' | 'none';

/**
 * Supported metric exporter types
 */
export type MetricExporterType = 'otlp' | 'prometheus' | 'console' | 'none';

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  healthy: boolean;
  errors: string[];
}

/**
 * Health check strategy interface
 */
export interface HealthCheckStrategy {
  getEndpoint(config: TelemetryConfig): string | null;
  requiresConnectivityCheck(): boolean;
  getConfigurationErrorPrefix(): string;
}

/**
 * Health check command interface
 */
export interface HealthCheckCommand {
  execute(): Promise<HealthCheckResult>;
}

/**
 * Exporter factory interface
 */
export interface ExporterFactory<T> {
  create(config: TelemetryConfig): T | null;
  getType(): string;
}

/**
 * Exporter configuration interface
 */
export interface ExporterConfiguration {
  enabled: boolean;
  type: string;
  endpoint?: string;
  timeout?: number;
  headers?: Record<string, string>;
  additionalOptions?: Record<string, unknown>;
}

/**
 * Exporter manager interface
 */
export interface ExporterManager {
  initialize(config: TelemetryConfig): Promise<void>;
  shutdown(): Promise<void>;
  getTraceExporters(): SpanExporter[];
  getMetricExporters(): Array<PushMetricExporter | PrometheusExporter>;
}

/**
 * Combined exporter health check result
 */
export interface ExporterHealthResult {
  traces: boolean;
  metrics: boolean;
  errors: string[];
}

/**
 * Connectivity check options
 */
export interface ConnectivityOptions {
  timeout?: number;
  method?: 'HEAD' | 'GET';
  allowedStatusCodes?: number[];
}

/**
 * Exporter creation options
 */
export interface ExporterOptions {
  timeout?: number;
  headers?: Record<string, string>;
  maxPacketSize?: number;
  serviceName?: string;
  port?: number;
  endpoint?: string;
  prefix?: string;
}