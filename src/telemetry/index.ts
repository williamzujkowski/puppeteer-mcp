/**
 * OpenTelemetry initialization and setup
 * @module telemetry
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { diag, DiagConsoleLogger, trace, metrics } from '@opentelemetry/api';
import { 
  BatchSpanProcessor, 
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { 
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
  MeterProvider,
} from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { 
  CompositePropagator,
  W3CTraceContextPropagator,
  W3CBaggagePropagator,
} from '@opentelemetry/core';
import { B3Propagator, B3InjectEncoding } from '@opentelemetry/propagator-b3';
import { JaegerPropagator } from '@opentelemetry/propagator-jaeger';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { 
  getTelemetryConfig, 
  validateTelemetryConfig,
  getBatchSpanProcessorConfig,
  getMetricReaderOptions,
  type TelemetryConfig,
} from './config.js';
import { createResource } from './resources.js';
import { createEnhancedSampler } from './sampling.js';
import { createMultiTraceExporter, createMultiMetricExporter } from './exporters.js';
import { logger } from '../utils/logger.js';
import { logTelemetryEvent } from './correlation.js';

/**
 * Global telemetry instance
 */
let telemetryInstance: NodeSDK | null = null;
let isInitialized = false;

/**
 * Create propagator based on configuration
 */
function createPropagator(config: TelemetryConfig): CompositePropagator {
  const propagators: any[] = [];
  
  config.propagation.propagators.forEach(name => {
    switch (name.toLowerCase()) {
      case 'tracecontext':
        propagators.push(new W3CTraceContextPropagator());
        break;
      case 'baggage':
        propagators.push(new W3CBaggagePropagator());
        break;
      case 'b3':
        propagators.push(new B3Propagator());
        break;
      case 'b3multi':
        propagators.push(new B3Propagator({ injectEncoding: B3InjectEncoding.MULTI_HEADER }));
        break;
      case 'jaeger':
        propagators.push(new JaegerPropagator());
        break;
      default:
        logger.warn({ propagator: name }, 'Unknown propagator type');
    }
  });
  
  if (propagators.length === 0) {
    // Default to W3C trace context
    propagators.push(new W3CTraceContextPropagator());
  }
  
  return new CompositePropagator({
    propagators,
  });
}

/**
 * Create instrumentations based on configuration
 */
function createInstrumentations(config: TelemetryConfig): any[] {
  const instrumentations: any[] = [];
  
  // Use auto-instrumentations with configuration
  const autoInstrumentations = getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': {
      enabled: config.instrumentations.http,
      requestHook: (span, request) => {
        // Add custom attributes to HTTP spans
        span.setAttributes({
          'http.request.body.size': request.headers['content-length'] || 0,
          'http.user_agent': request.headers['user-agent'] || 'unknown',
        });
      },
      responseHook: (span, response) => {
        // Add response attributes
        if (response) {
          span.setAttributes({
            'http.response.body.size': response.headers?.['content-length'] || 0,
          });
        }
      },
      ignoreIncomingRequestHook: (request) => {
        // Ignore health check endpoints
        const url = request.url || '';
        return url === '/health' || url === '/metrics' || url.startsWith('/metrics/');
      },
    },
    '@opentelemetry/instrumentation-express': {
      enabled: config.instrumentations.express,
      requestHook: (span, info) => {
        if (info.request) {
          span.updateName(`${info.request.method} ${info.route || info.request.path}`);
        }
      },
    },
    '@opentelemetry/instrumentation-grpc': {
      enabled: config.instrumentations.grpc,
    },
    '@opentelemetry/instrumentation-ioredis': {
      enabled: config.instrumentations.redis,
      requestHook: (span, info) => {
        // Add Redis command details
        span.setAttributes({
          'db.redis.command': info.commandObj?.command,
          'db.redis.args_length': info.commandObj?.args?.length || 0,
        });
      },
    },
    '@opentelemetry/instrumentation-ws': {
      enabled: config.instrumentations.ws,
    },
    // Disable some auto-instrumentations we don't need
    '@opentelemetry/instrumentation-fs': {
      enabled: false, // Too noisy
    },
    '@opentelemetry/instrumentation-dns': {
      enabled: false, // Not needed
    },
  });
  
  instrumentations.push(...autoInstrumentations);
  
  return instrumentations;
}

/**
 * Initialize telemetry
 */
export async function initializeTelemetry(): Promise<void> {
  if (isInitialized) {
    logger.warn('Telemetry already initialized');
    return;
  }
  
  const config = getTelemetryConfig();
  
  // Validate configuration
  try {
    validateTelemetryConfig(config);
  } catch (error) {
    logger.error({ error }, 'Invalid telemetry configuration');
    throw error;
  }
  
  if (!config.enabled) {
    logger.info('Telemetry is disabled');
    isInitialized = true;
    return;
  }
  
  logTelemetryEvent(logger, {
    operation: 'telemetry.init',
    status: 'started',
    metadata: {
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      environment: config.environment,
    },
  });
  
  try {
    // Set up diagnostics
    if (config.debug.enabled) {
      diag.setLogger(new DiagConsoleLogger(), config.debug.logLevel);
    }
    
    // Create resource
    const resource = createResource(config);
    
    // Create span processors
    const spanProcessors: any[] = [];
    const traceExporters = createMultiTraceExporter(config);
    
    traceExporters.forEach(exporter => {
      if (config.debug.enabled || exporter instanceof ConsoleSpanExporter) {
        spanProcessors.push(new SimpleSpanProcessor(exporter));
      } else {
        spanProcessors.push(new BatchSpanProcessor(
          exporter,
          getBatchSpanProcessorConfig(config),
        ));
      }
    });
    
    // Create metric readers
    const metricReaders: any[] = [];
    const metricExporters = createMultiMetricExporter(config);
    
    metricExporters.forEach(exporter => {
      if (exporter instanceof PrometheusExporter) {
        metricReaders.push(exporter);
      } else {
        metricReaders.push(new PeriodicExportingMetricReader({
          exporter,
          ...getMetricReaderOptions(config),
        }));
      }
    });
    
    // Create sampler
    const sampler = createEnhancedSampler(config);
    
    // Create propagator
    const textMapPropagator = createPropagator(config);
    
    // Create instrumentations
    const instrumentations = createInstrumentations(config);
    
    // Initialize SDK
    telemetryInstance = new NodeSDK({
      resource,
      spanProcessors,
      metricReaders,
      sampler,
      textMapPropagator,
      instrumentations,
      serviceName: config.serviceName,
    });
    
    // Start SDK
    await telemetryInstance.start();
    
    isInitialized = true;
    
    logTelemetryEvent(logger, {
      operation: 'telemetry.init',
      status: 'completed',
      metadata: {
        resource: resource.attributes,
        exporters: {
          traces: config.tracing.exporter,
          metrics: config.metrics.exporter,
        },
        sampling: config.sampling.strategy,
        instrumentations: Object.entries(config.instrumentations)
          .filter(([_, enabled]) => enabled)
          .map(([name]) => name),
      },
    });
    
    logger.info({
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      environment: config.environment,
      tracing: config.tracing.enabled,
      metrics: config.metrics.enabled,
    }, 'OpenTelemetry initialized successfully');
    
  } catch (error) {
    logTelemetryEvent(logger, {
      operation: 'telemetry.init',
      status: 'failed',
      error: error as Error,
    });
    
    logger.error({ error }, 'Failed to initialize OpenTelemetry');
    throw error;
  }
}

/**
 * Shutdown telemetry gracefully
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!isInitialized || !telemetryInstance) {
    return;
  }
  
  logTelemetryEvent(logger, {
    operation: 'telemetry.shutdown',
    status: 'started',
  });
  
  try {
    await telemetryInstance.shutdown();
    telemetryInstance = null;
    isInitialized = false;
    
    logTelemetryEvent(logger, {
      operation: 'telemetry.shutdown',
      status: 'completed',
    });
    
    logger.info('OpenTelemetry shut down successfully');
  } catch (error) {
    logTelemetryEvent(logger, {
      operation: 'telemetry.shutdown',
      status: 'failed',
      error: error as Error,
    });
    
    logger.error({ error }, 'Error shutting down OpenTelemetry');
    throw error;
  }
}

/**
 * Get tracer instance
 */
export function getTracer(name?: string, version?: string): any {
  return trace.getTracer(
    name ?? 'puppeteer-mcp',
    version ?? getTelemetryConfig().serviceVersion,
  );
}

/**
 * Get meter instance
 */
export function getMeter(name?: string, version?: string): any {
  return metrics.getMeter(
    name ?? 'puppeteer-mcp',
    version ?? getTelemetryConfig().serviceVersion,
  );
}

/**
 * Check if telemetry is initialized
 */
export function isTelemetryInitialized(): boolean {
  return isInitialized;
}

/**
 * Force flush all telemetry data
 */
export async function flushTelemetry(): Promise<void> {
  if (!isInitialized || !telemetryInstance) {
    return;
  }
  
  try {
    // Force flush all span processors
    const tracerProvider = trace.getTracerProvider();
    if ('forceFlush' in tracerProvider) {
      await (tracerProvider as any).forceFlush();
    }
    
    // Force flush all metric readers
    const meterProvider = metrics.getMeterProvider();
    if ('forceFlush' in meterProvider) {
      await (meterProvider as any).forceFlush();
    }
    
    logger.debug('Telemetry data flushed successfully');
  } catch (error) {
    logger.error({ error }, 'Error flushing telemetry data');
  }
}

// Re-export commonly used items
export { contextPropagationMiddleware } from './context.js';
export { createCorrelatedLogger, CorrelatedLogger } from './correlation.js';
export * from './metrics/index.js';
export * from './instrumentations/index.js';
export { createBrowserPoolMetrics } from './metrics/browser-pool/index.js';