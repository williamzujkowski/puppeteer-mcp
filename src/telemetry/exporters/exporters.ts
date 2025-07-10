/**
 * Main exporters coordinator - re-exports from modular structure
 * @module telemetry/exporters/exporters
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

// Factory functions
export {
  createTraceExporter,
  createMetricExporter,
  createMultiTraceExporter,
  createMultiMetricExporter,
  registerTraceExporterFactory,
  registerMetricExporterFactory,
  getAvailableTraceExporterTypes,
  getAvailableMetricExporterTypes,
} from './exporter-factory.js';

// Manager functions
export {
  getExporterManager,
  setExporterManager,
  initializeExporters,
  shutdownExporters,
  DefaultExporterManager,
} from './exporter-manager.js';

// Health checking
export {
  checkExporterHealth,
  performDetailedHealthCheck,
  ConnectivityChecker,
  HealthCheckStrategyFactory,
  TraceHealthCheckCommand,
  MetricHealthCheckCommand,
  HealthCheckResultBuilder,
} from './health-checker.js';

// Configuration validation
export {
  validateTelemetryConfig,
  validateTraceExporterConfig,
  validateMetricExporterConfig,
  validateExportConfig,
  validateExporterConfiguration,
  logValidationResults,
  ExporterValidationError,
  ValidationErrorType,
} from './config-validator.js';

// Individual exporter factories
export {
  ConsoleTraceExporterFactory,
  ConsoleMetricExporterFactory,
  createConsoleTraceExporter,
  createConsoleMetricExporter,
} from './console-exporter.js';

export {
  OTLPTraceExporterFactory,
  OTLPMetricExporterFactory,
  createOTLPTraceExporter,
  createOTLPMetricExporter,
  validateOTLPEndpoint,
} from './otlp-exporter.js';

export {
  PrometheusExporterFactory,
  createPrometheusExporter,
  validatePrometheusPort,
  validatePrometheusEndpoint,
  validatePrometheusPrefix,
  getPrometheusMetricsUrl,
} from './prometheus-exporter.js';

export {
  JaegerExporterFactory,
  createJaegerExporter,
  validateJaegerEndpoint,
  validateJaegerMaxPacketSize,
  getDefaultJaegerEndpoint,
  parseJaegerEndpoint,
} from './jaeger-exporter.js';

export {
  FileSpanExporter,
  FileMetricExporter,
  FileTraceExporterFactory,
  FileMetricExporterFactory,
  createFileSpanExporter,
  createFileMetricExporter,
} from './file-exporter.js';

export {
  HTTPSpanExporter,
  HTTPMetricExporter,
  HTTPTraceExporterFactory,
  HTTPMetricExporterFactory,
  createHTTPSpanExporter,
  createHTTPMetricExporter,
  validateHTTPEndpoint,
} from './http-exporter.js';

// Types
export type {
  TraceExporterType,
  MetricExporterType,
  HealthCheckResult,
  HealthCheckStrategy,
  HealthCheckCommand,
  ExporterFactory,
  ExporterConfiguration,
  ExporterManager,
  ExporterHealthResult,
  ConnectivityOptions,
  ExporterOptions,
} from './types.js';