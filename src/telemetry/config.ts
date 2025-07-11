/**
 * OpenTelemetry configuration module
 * @module telemetry/config
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { DiagLogLevel } from '@opentelemetry/api';
import { config } from '../core/config.js';
import type { 
  SpanExporter, 
  ReadableSpan, 
  SpanProcessor 
} from '@opentelemetry/sdk-trace-node';
import type { 
  PeriodicExportingMetricReaderOptions 
} from '@opentelemetry/sdk-metrics';

/**
 * Telemetry configuration interface
 */
export interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment?: string;
  
  // Tracing
  tracing: {
    enabled: boolean;
    samplingRate: number;
    exporter: 'otlp' | 'jaeger' | 'zipkin' | 'console' | 'none';
    endpoints: {
      otlp: string;
      jaeger: string;
      zipkin: string;
    };
  };
  
  // Metrics
  metrics: {
    enabled: boolean;
    interval: number;
    exporter: 'otlp' | 'prometheus' | 'console' | 'none';
    endpoints: {
      otlp: string;
      prometheusPort: number;
    };
  };
  
  // Context propagation
  propagation: {
    propagators: string[];
    baggageMaxSize: number;
  };
  
  // Resource detection
  resource: {
    detectionEnabled: boolean;
    attributes?: Record<string, string | number | boolean>;
  };
  
  // Sampling
  sampling: {
    strategy: 'always_on' | 'always_off' | 'trace_id_ratio' | 'parent_based' | 'adaptive';
    adaptiveTargetRate?: number;
  };
  
  // Export configuration
  export: {
    timeout: number;
    maxQueueSize: number;
    maxBatchSize: number;
    batchDelay: number;
  };
  
  // Instrumentation control
  instrumentations: {
    http: boolean;
    express: boolean;
    grpc: boolean;
    redis: boolean;
    ws: boolean;
    puppeteer: boolean;
  };
  
  // Debug
  debug: {
    enabled: boolean;
    logLevel: DiagLogLevel;
  };
}

/**
 * Parse additional resource attributes from JSON string
 */
function parseResourceAttributes(): Record<string, string | number | boolean> | undefined {
  if (!config.TELEMETRY_RESOURCE_ATTRIBUTES) {
    return undefined;
  }
  
  try {
    return config.TELEMETRY_RESOURCE_ATTRIBUTES as Record<string, string | number | boolean>;
  } catch (error) {
    console.error('Failed to parse TELEMETRY_RESOURCE_ATTRIBUTES:', error);
    return undefined;
  }
}

/**
 * Convert log level string to DiagLogLevel
 */
function getLogLevel(level: string): DiagLogLevel {
  switch (level) {
    case 'verbose':
      return DiagLogLevel.VERBOSE;
    case 'debug':
      return DiagLogLevel.DEBUG;
    case 'info':
      return DiagLogLevel.INFO;
    case 'warn':
      return DiagLogLevel.WARN;
    case 'error':
      return DiagLogLevel.ERROR;
    default:
      return DiagLogLevel.ERROR;
  }
}

/**
 * Get telemetry configuration from application config
 */
export function getTelemetryConfig(): TelemetryConfig {
  return {
    enabled: config.TELEMETRY_ENABLED,
    serviceName: config.TELEMETRY_SERVICE_NAME,
    serviceVersion: config.TELEMETRY_SERVICE_VERSION,
    environment: config.TELEMETRY_ENVIRONMENT,
    
    tracing: {
      enabled: config.TELEMETRY_ENABLED,
      samplingRate: config.TELEMETRY_SAMPLING_RATIO,
      exporter: config.TELEMETRY_EXPORTER_TYPE === 'none' ? 'none' : config.TELEMETRY_EXPORTER_TYPE as 'otlp' | 'jaeger' | 'zipkin' | 'console',
      endpoints: {
        otlp: config.TELEMETRY_EXPORTER_ENDPOINT || 'http://localhost:4318',
        jaeger: config.TELEMETRY_EXPORTER_ENDPOINT || 'http://localhost:14268/api/traces',
        zipkin: config.TELEMETRY_EXPORTER_ENDPOINT || 'http://localhost:9411/api/v2/spans',
      },
    },
    
    metrics: {
      enabled: config.TELEMETRY_ENABLED,
      interval: config.TELEMETRY_METRICS_INTERVAL,
      exporter: config.TELEMETRY_EXPORTER_TYPE === 'none' ? 'none' : config.TELEMETRY_EXPORTER_TYPE === 'otlp' ? 'otlp' : 'console',
      endpoints: {
        otlp: config.TELEMETRY_EXPORTER_ENDPOINT || 'http://localhost:4318',
        prometheusPort: 9090,
      },
    },
    
    propagation: {
      propagators: config.TELEMETRY_PROPAGATORS,
      baggageMaxSize: 180,
    },
    
    resource: {
      detectionEnabled: true,
      attributes: parseResourceAttributes(),
    },
    
    sampling: {
      strategy: config.TELEMETRY_TRACE_ID_RATIO_BASED ? 'trace_id_ratio' : 'parent_based',
      adaptiveTargetRate: config.TELEMETRY_SAMPLING_RATIO,
    },
    
    export: {
      timeout: config.TELEMETRY_EXPORTER_TIMEOUT,
      maxQueueSize: config.TELEMETRY_BATCH_MAX_QUEUE_SIZE,
      maxBatchSize: config.TELEMETRY_BATCH_MAX_EXPORT_BATCH_SIZE,
      batchDelay: config.TELEMETRY_BATCH_SCHEDULED_DELAY,
    },
    
    instrumentations: {
      http: config.TELEMETRY_INSTRUMENTATION_HTTP,
      express: config.TELEMETRY_INSTRUMENTATION_EXPRESS,
      grpc: config.TELEMETRY_INSTRUMENTATION_GRPC,
      redis: config.TELEMETRY_INSTRUMENTATION_REDIS,
      ws: true,
      puppeteer: true,
    },
    
    debug: {
      enabled: config.TELEMETRY_LOG_LEVEL !== 'none',
      logLevel: getLogLevel(config.TELEMETRY_LOG_LEVEL),
    },
  };
}

/**
 * Batch span processor configuration interface
 */
export interface BatchSpanProcessorConfig {
  maxQueueSize?: number;
  maxExportBatchSize?: number;
  scheduledDelayMillis?: number;
  exportTimeoutMillis?: number;
}

/**
 * Get batch span processor configuration
 */
export function getBatchSpanProcessorConfig(telemetryConfig: TelemetryConfig): BatchSpanProcessorConfig {
  return {
    maxQueueSize: telemetryConfig.export.maxQueueSize,
    maxExportBatchSize: telemetryConfig.export.maxBatchSize,
    scheduledDelayMillis: telemetryConfig.export.batchDelay,
    exportTimeoutMillis: telemetryConfig.export.timeout,
  };
}

/**
 * Get metric reader options
 */
export function getMetricReaderOptions(telemetryConfig: TelemetryConfig): any {
  return {
    exportIntervalMillis: telemetryConfig.metrics.interval,
    exportTimeoutMillis: telemetryConfig.export.timeout,
  };
}

/**
 * Validate telemetry configuration
 */
export function validateTelemetryConfig(telemetryConfig: TelemetryConfig): void {
  if (!telemetryConfig.enabled) {
    return; // Skip validation if telemetry is disabled
  }
  
  // Validate sampling rate
  if (telemetryConfig.tracing.samplingRate < 0 || telemetryConfig.tracing.samplingRate > 1) {
    throw new Error('TELEMETRY_TRACE_SAMPLING_RATE must be between 0 and 1');
  }
  
  // Validate export configuration
  if (telemetryConfig.export.maxBatchSize > telemetryConfig.export.maxQueueSize) {
    throw new Error('TELEMETRY_EXPORT_MAX_BATCH_SIZE cannot be larger than TELEMETRY_EXPORT_MAX_QUEUE_SIZE');
  }
  
  // Validate endpoints based on exporters
  if (telemetryConfig.tracing.enabled && telemetryConfig.tracing.exporter === 'otlp') {
    if (!telemetryConfig.tracing.endpoints.otlp) {
      throw new Error('TELEMETRY_TRACE_OTLP_ENDPOINT is required when using OTLP exporter');
    }
  }
  
  if (telemetryConfig.metrics.enabled && telemetryConfig.metrics.exporter === 'otlp') {
    if (!telemetryConfig.metrics.endpoints.otlp) {
      throw new Error('TELEMETRY_METRICS_OTLP_ENDPOINT is required when using OTLP metrics exporter');
    }
  }
}