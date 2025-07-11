/**
 * Exporter configuration validation utilities
 * @module telemetry/exporters/config-validator
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { TelemetryConfig } from '../config.js';
import type { TraceExporterType, MetricExporterType, ExporterConfiguration } from './types.js';
import { validateOTLPEndpoint } from './otlp-exporter.js';
import { validateJaegerEndpoint } from './jaeger-exporter.js';
import { validatePrometheusPort } from './prometheus-exporter.js';
import { validateHTTPEndpoint } from './http-exporter.js';
import { logger } from '../../utils/logger.js';

/**
 * Validation result interface
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validation error types
 */
export enum ValidationErrorType {
  MISSING_ENDPOINT = 'MISSING_ENDPOINT',
  INVALID_ENDPOINT = 'INVALID_ENDPOINT',
  INVALID_PORT = 'INVALID_PORT',
  INVALID_EXPORTER_TYPE = 'INVALID_EXPORTER_TYPE',
  CONFIGURATION_MISMATCH = 'CONFIGURATION_MISMATCH',
}

/**
 * Validation error class
 */
export class ExporterValidationError extends Error {
  constructor(
    public readonly type: ValidationErrorType,
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ExporterValidationError';
  }
}

/**
 * Validate OTLP configuration
 */
function validateOTLPConfig(
  endpoints: { otlp: string },
  result: ValidationResult,
  prefix: string,
): void {
  if (!endpoints.otlp) {
    result.errors.push(`${prefix} endpoint is required when using OTLP exporter`);
    result.valid = false;
  } else if (!validateOTLPEndpoint(endpoints.otlp)) {
    result.errors.push(`Invalid ${prefix} endpoint: ${endpoints.otlp}`);
    result.valid = false;
  }
}

/**
 * Validate Jaeger configuration
 */
function validateJaegerConfig(endpoints: { jaeger: string }, result: ValidationResult): void {
  if (!endpoints.jaeger) {
    result.errors.push('Jaeger endpoint is required when using Jaeger exporter');
    result.valid = false;
  } else if (!validateJaegerEndpoint(endpoints.jaeger)) {
    result.errors.push(`Invalid Jaeger endpoint: ${endpoints.jaeger}`);
    result.valid = false;
  }
}

/**
 * Validate Zipkin configuration
 */
function validateZipkinConfig(endpoints: { zipkin: string }, result: ValidationResult): void {
  if (!endpoints.zipkin) {
    result.errors.push('Zipkin endpoint is required when using Zipkin exporter');
    result.valid = false;
  } else {
    try {
      new URL(endpoints.zipkin);
    } catch {
      result.errors.push(`Invalid Zipkin endpoint: ${endpoints.zipkin}`);
      result.valid = false;
    }
  }
}

/**
 * Validate trace exporter configuration
 */
export function validateTraceExporterConfig(config: TelemetryConfig): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!config.tracing.enabled) {
    return result; // Skip validation if tracing is disabled
  }

  const { exporter, endpoints } = config.tracing;

  switch (exporter) {
    case 'otlp':
      validateOTLPConfig(endpoints, result, 'OTLP trace');
      break;

    case 'jaeger':
      validateJaegerConfig(endpoints, result);
      break;

    case 'zipkin':
      validateZipkinConfig(endpoints, result);
      break;

    case 'console':
    case 'none':
      // No endpoint validation needed
      break;

    default:
      result.errors.push(`Unknown trace exporter type: ${String(exporter)}`);
      result.valid = false;
      break;
  }

  // Validate sampling rate
  if (config.tracing.samplingRate < 0 || config.tracing.samplingRate > 1) {
    result.errors.push('Trace sampling rate must be between 0 and 1');
    result.valid = false;
  }

  return result;
}

/**
 * Validate metric exporter configuration
 */
export function validateMetricExporterConfig(config: TelemetryConfig): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!config.metrics.enabled) {
    return result; // Skip validation if metrics are disabled
  }

  const { exporter, endpoints } = config.metrics;

  switch (exporter) {
    case 'otlp':
      validateOTLPConfig(endpoints, result, 'OTLP metrics');
      break;

    case 'prometheus':
      if (!validatePrometheusPort(endpoints.prometheusPort)) {
        result.errors.push(`Invalid Prometheus port: ${endpoints.prometheusPort}`);
        result.valid = false;
      }
      break;

    case 'console':
    case 'none':
      // No endpoint validation needed
      break;

    default:
      result.errors.push(`Unknown metric exporter type: ${String(exporter)}`);
      result.valid = false;
      break;
  }

  // Validate metrics interval
  if (config.metrics.interval <= 0) {
    result.errors.push('Metrics interval must be greater than 0');
    result.valid = false;
  }

  return result;
}

/**
 * Validate export configuration
 */
export function validateExportConfig(config: TelemetryConfig): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const { export: exportConfig } = config;

  if (exportConfig.timeout <= 0) {
    result.errors.push('Export timeout must be greater than 0');
    result.valid = false;
  }

  if (exportConfig.maxQueueSize <= 0) {
    result.errors.push('Max queue size must be greater than 0');
    result.valid = false;
  }

  if (exportConfig.maxBatchSize <= 0) {
    result.errors.push('Max batch size must be greater than 0');
    result.valid = false;
  }

  if (exportConfig.maxBatchSize > exportConfig.maxQueueSize) {
    result.errors.push('Max batch size cannot be larger than max queue size');
    result.valid = false;
  }

  if (exportConfig.batchDelay < 0) {
    result.errors.push('Batch delay cannot be negative');
    result.valid = false;
  }

  // Performance warnings
  if (exportConfig.timeout > 30000) {
    result.warnings.push(
      'Export timeout is very high (>30s), consider reducing for better performance',
    );
  }

  if (exportConfig.maxQueueSize > 10000) {
    result.warnings.push(
      'Max queue size is very high (>10000), consider reducing to limit memory usage',
    );
  }

  return result;
}

/**
 * Validate complete telemetry configuration
 */
export function validateTelemetryConfig(config: TelemetryConfig): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!config.enabled) {
    return result; // Skip validation if telemetry is disabled
  }

  // Validate trace configuration
  const traceResult = validateTraceExporterConfig(config);
  result.errors.push(...traceResult.errors);
  result.warnings.push(...traceResult.warnings);
  if (!traceResult.valid) {
    result.valid = false;
  }

  // Validate metric configuration
  const metricResult = validateMetricExporterConfig(config);
  result.errors.push(...metricResult.errors);
  result.warnings.push(...metricResult.warnings);
  if (!metricResult.valid) {
    result.valid = false;
  }

  // Validate export configuration
  const exportResult = validateExportConfig(config);
  result.errors.push(...exportResult.errors);
  result.warnings.push(...exportResult.warnings);
  if (!exportResult.valid) {
    result.valid = false;
  }

  // Service name validation
  if (!config.serviceName || config.serviceName.trim() === '') {
    result.errors.push('Service name is required');
    result.valid = false;
  }

  // Service version validation
  if (!config.serviceVersion || config.serviceVersion.trim() === '') {
    result.warnings.push('Service version is not specified');
  }

  return result;
}

/**
 * Validate exporter type
 */
function validateExporterType(
  config: ExporterConfiguration,
  type: 'trace' | 'metric',
  result: ValidationResult,
): void {
  if (type === 'trace') {
    const validTraceTypes: TraceExporterType[] = ['otlp', 'jaeger', 'zipkin', 'console', 'none'];
    if (!validTraceTypes.includes(config.type as TraceExporterType)) {
      result.errors.push(`Invalid trace exporter type: ${config.type}`);
      result.valid = false;
    }
  } else {
    const validMetricTypes: MetricExporterType[] = ['otlp', 'prometheus', 'console', 'none'];
    if (!validMetricTypes.includes(config.type as MetricExporterType)) {
      result.errors.push(`Invalid metric exporter type: ${config.type}`);
      result.valid = false;
    }
  }
}

/**
 * Validate exporter endpoint
 */
function validateExporterEndpoint(config: ExporterConfiguration, result: ValidationResult): void {
  const requiresEndpoint = ['otlp', 'jaeger', 'zipkin', 'http'].includes(config.type);

  if (requiresEndpoint && (config.endpoint === undefined || config.endpoint.trim() === '')) {
    result.errors.push(`Endpoint is required for ${config.type} exporter`);
    result.valid = false;
    return;
  }

  if (
    config.endpoint !== undefined &&
    config.endpoint.trim() !== '' &&
    !validateHTTPEndpoint(config.endpoint)
  ) {
    result.errors.push(`Invalid endpoint URL: ${config.endpoint}`);
    result.valid = false;
  }
}

/**
 * Validate exporter configuration object
 */
export function validateExporterConfiguration(
  config: ExporterConfiguration,
  type: 'trace' | 'metric',
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!config.enabled) {
    return result;
  }

  if (!config.type || config.type.trim() === '') {
    result.errors.push('Exporter type is required');
    result.valid = false;
    return result;
  }

  validateExporterType(config, type, result);
  validateExporterEndpoint(config, result);

  // Validate timeout
  if (config.timeout !== undefined && config.timeout <= 0) {
    result.errors.push('Timeout must be greater than 0');
    result.valid = false;
  }

  return result;
}

/**
 * Log validation results
 */
export function logValidationResults(results: ValidationResult, context: string): void {
  if (results.errors.length > 0) {
    logger.error(
      {
        context,
        errors: results.errors,
      },
      'Exporter configuration validation failed',
    );
  }

  if (results.warnings.length > 0) {
    logger.warn(
      {
        context,
        warnings: results.warnings,
      },
      'Exporter configuration validation warnings',
    );
  }

  if (results.valid && results.errors.length === 0 && results.warnings.length === 0) {
    logger.info({ context }, 'Exporter configuration validation passed');
  }
}
