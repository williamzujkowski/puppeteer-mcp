/**
 * OpenTelemetry health monitoring
 * @module telemetry/health
 * @nist si-6 "Security function verification"
 */

import { trace, metrics } from '@opentelemetry/api';
import { getTelemetryConfig } from './config.js';
import { checkExporterHealth } from './exporters.js';
import { checkResourceHealth } from './resources.js';
import { isTelemetryInitialized, flushTelemetry } from './index.js';
import { logger } from '../utils/logger.js';

/**
 * Telemetry health status
 */
export interface TelemetryHealth {
  initialized: boolean;
  enabled: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    tracing: {
      enabled: boolean;
      healthy: boolean;
      exporter: string;
      samplingRate: number;
      activeSpans?: number;
    };
    metrics: {
      enabled: boolean;
      healthy: boolean;
      exporter: string;
      exportInterval: number;
    };
    exporters: {
      traces: boolean;
      metrics: boolean;
      errors: string[];
    };
    resource: {
      healthy: boolean;
      warnings: string[];
      attributes: Record<string, any>;
    };
  };
  errors: string[];
  warnings: string[];
  lastCheck: string;
}

/**
 * Check telemetry health
 */
export async function checkTelemetryHealth(): Promise<TelemetryHealth> {
  const config = getTelemetryConfig();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check initialization
  const initialized = isTelemetryInitialized();
  if (!initialized && config.enabled) {
    errors.push('Telemetry is enabled but not initialized');
  }
  
  // Check exporters
  let exporterHealth = { traces: false, metrics: false, errors: [] as string[] };
  if (initialized) {
    try {
      exporterHealth = await checkExporterHealth(config);
    } catch (error) {
      errors.push(`Failed to check exporter health: ${error}`);
    }
  }
  
  // Check resource
  let resourceHealth = { healthy: false, warnings: [] as string[], attributes: {} };
  if (initialized) {
    try {
      const tracerProvider = trace.getTracerProvider();
      // Get resource from tracer provider (implementation specific)
      const resource = (tracerProvider as any).resource;
      if (resource) {
        resourceHealth = checkResourceHealth(resource);
      }
    } catch (error) {
      warnings.push(`Failed to check resource health: ${error}`);
    }
  }
  
  // Aggregate errors and warnings
  errors.push(...exporterHealth.errors);
  warnings.push(...resourceHealth.warnings);
  
  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (errors.length > 0) {
    status = 'unhealthy';
  } else if (warnings.length > 0 || !exporterHealth.traces || !exporterHealth.metrics) {
    status = 'degraded';
  }
  
  const health: TelemetryHealth = {
    initialized,
    enabled: config.enabled,
    status,
    components: {
      tracing: {
        enabled: config.tracing.enabled,
        healthy: config.tracing.enabled ? exporterHealth.traces : true,
        exporter: config.tracing.exporter,
        samplingRate: config.tracing.samplingRate,
      },
      metrics: {
        enabled: config.metrics.enabled,
        healthy: config.metrics.enabled ? exporterHealth.metrics : true,
        exporter: config.metrics.exporter,
        exportInterval: config.metrics.interval,
      },
      exporters: exporterHealth,
      resource: resourceHealth,
    },
    errors,
    warnings,
    lastCheck: new Date().toISOString(),
  };
  
  return health;
}

/**
 * Telemetry diagnostics
 */
export interface TelemetryDiagnostics {
  health: TelemetryHealth;
  performance: {
    exportQueueSize?: number;
    droppedSpans?: number;
    droppedMetrics?: number;
    lastExportTime?: string;
    averageExportDuration?: number;
  };
  configuration: {
    serviceName: string;
    serviceVersion: string;
    environment?: string;
    instrumentations: Record<string, boolean>;
  };
}

/**
 * Get telemetry diagnostics
 */
export async function getTelemetryDiagnostics(): Promise<TelemetryDiagnostics> {
  const health = await checkTelemetryHealth();
  const config = getTelemetryConfig();
  
  const diagnostics: TelemetryDiagnostics = {
    health,
    performance: {
      // These would need to be extracted from the SDK internals
      // For now, we'll leave them as optional
    },
    configuration: {
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      environment: config.environment,
      instrumentations: config.instrumentations,
    },
  };
  
  return diagnostics;
}

/**
 * Create telemetry health check endpoint handler
 */
export async function telemetryHealthHandler(_req: any, res: any): Promise<void> {
  try {
    const health = await checkTelemetryHealth();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      status: health.status,
      telemetry: health,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to check telemetry health');
    res.status(500).json({
      status: 'error',
      error: 'Failed to check telemetry health',
    });
  }
}

/**
 * Telemetry readiness check
 */
export function isTelemetryReady(): boolean {
  const config = getTelemetryConfig();
  
  // If telemetry is disabled, it's always ready
  if (!config.enabled) {
    return true;
  }
  
  // Check if initialized
  return isTelemetryInitialized();
}

/**
 * Telemetry liveness check
 */
export async function isTelemetryAlive(): Promise<boolean> {
  const config = getTelemetryConfig();
  
  // If telemetry is disabled, it's always alive
  if (!config.enabled) {
    return true;
  }
  
  // Check if initialized
  if (!isTelemetryInitialized()) {
    return false;
  }
  
  try {
    // Try to flush data as a liveness check
    await flushTelemetry();
    return true;
  } catch (error) {
    logger.error({ error }, 'Telemetry liveness check failed');
    return false;
  }
}

/**
 * Monitor telemetry health periodically
 */
export function startTelemetryHealthMonitoring(intervalMs: number = 60000): NodeJS.Timer {
  return setInterval(async () => {
    try {
      const health = await checkTelemetryHealth();
      
      if (health.status === 'unhealthy') {
        logger.error({
          health,
        }, 'Telemetry health check failed');
      } else if (health.status === 'degraded') {
        logger.warn({
          health,
        }, 'Telemetry health degraded');
      }
      
      // Record health metrics
      const meter = metrics.getMeter('telemetry-health');
      const healthGauge = meter.createObservableGauge('telemetry_health_status', {
        description: 'Telemetry health status (1=healthy, 0=unhealthy)',
      });
      
      healthGauge.addCallback((result) => {
        result.observe(health.status === 'healthy' ? 1 : 0, {
          status: health.status,
        });
      });
      
    } catch (error) {
      logger.error({ error }, 'Error monitoring telemetry health');
    }
  }, intervalMs);
}