/**
 * Exporter lifecycle management and coordination
 * @module telemetry/exporters/exporter-manager
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { SpanExporter } from '@opentelemetry/sdk-trace-node';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import type { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import type { TelemetryConfig } from '../config.js';
import type { ExporterManager, ExporterHealthResult } from './types.js';
import { createMultiTraceExporter, createMultiMetricExporter } from './exporter-factory.js';
import { checkExporterHealth } from './health-checker.js';
import { validateTelemetryConfig, logValidationResults } from './config-validator.js';
import { logger } from '../../utils/logger.js';

/**
 * Exporter state enumeration
 */
enum ExporterState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  SHUTTING_DOWN = 'shutting_down',
  SHUTDOWN = 'shutdown',
  ERROR = 'error',
}

/**
 * Exporter statistics
 */
interface ExporterStats {
  traceExporterCount: number;
  metricExporterCount: number;
  initializationTime: number;
  lastHealthCheck: Date | null;
  totalShutdowns: number;
  totalInitializations: number;
}

/**
 * Default exporter manager implementation
 */
export class DefaultExporterManager implements ExporterManager {
  private state: ExporterState = ExporterState.UNINITIALIZED;
  private traceExporters: SpanExporter[] = [];
  private metricExporters: Array<PushMetricExporter | PrometheusExporter> = [];
  private config: TelemetryConfig | null = null;
  private stats: ExporterStats = {
    traceExporterCount: 0,
    metricExporterCount: 0,
    initializationTime: 0,
    lastHealthCheck: null,
    totalShutdowns: 0,
    totalInitializations: 0,
  };

  /**
   * Initialize exporters with configuration
   */
  async initialize(config: TelemetryConfig): Promise<void> {
    if (this.state === ExporterState.INITIALIZING) {
      throw new Error('Exporter manager is already initializing');
    }

    if (this.state === ExporterState.RUNNING) {
      logger.warn('Exporter manager already running, shutting down before re-initialization');
      await this.shutdown();
    }

    this.state = ExporterState.INITIALIZING;
    const startTime = Date.now();

    try {
      logger.info('Initializing exporter manager');

      // Validate configuration
      this.validateConfiguration(config);

      // Store configuration
      this.config = config;

      // Create exporters
      this.createExporters(config);

      // Perform health check
      await this.performInitialHealthCheck(config);

      this.state = ExporterState.RUNNING;
      this.stats.initializationTime = Date.now() - startTime;
      this.stats.totalInitializations++;

      logger.info(
        {
          traceExporters: this.stats.traceExporterCount,
          metricExporters: this.stats.metricExporterCount,
          initTime: this.stats.initializationTime,
        },
        'Exporter manager initialized successfully',
      );
    } catch (error) {
      this.state = ExporterState.ERROR;
      logger.error({ error }, 'Failed to initialize exporter manager');
      throw error;
    }
  }

  /**
   * Shutdown all exporters
   */
  async shutdown(): Promise<void> {
    if (this.state === ExporterState.SHUTDOWN || this.state === ExporterState.SHUTTING_DOWN) {
      logger.debug('Exporter manager already shutdown or shutting down');
      return;
    }

    this.state = ExporterState.SHUTTING_DOWN;
    const startTime = Date.now();

    try {
      logger.info('Shutting down exporter manager');

      // Shutdown trace exporters
      await this.shutdownTraceExporters();

      // Shutdown metric exporters
      await this.shutdownMetricExporters();

      // Reset state
      this.traceExporters = [];
      this.metricExporters = [];
      this.config = null;
      this.state = ExporterState.SHUTDOWN;
      this.stats.totalShutdowns++;

      const shutdownTime = Date.now() - startTime;
      logger.info({ shutdownTime }, 'Exporter manager shutdown completed');
    } catch (error) {
      this.state = ExporterState.ERROR;
      logger.error({ error }, 'Error during exporter manager shutdown');
      throw error;
    }
  }

  /**
   * Get current trace exporters
   */
  getTraceExporters(): SpanExporter[] {
    return [...this.traceExporters];
  }

  /**
   * Get current metric exporters
   */
  getMetricExporters(): Array<PushMetricExporter | PrometheusExporter> {
    return [...this.metricExporters];
  }

  /**
   * Get current state
   */
  getState(): ExporterState {
    return this.state;
  }

  /**
   * Get exporter statistics
   */
  getStats(): ExporterStats {
    return { ...this.stats };
  }

  /**
   * Perform health check on exporters
   */
  async healthCheck(): Promise<ExporterHealthResult> {
    if (!this.config) {
      throw new Error('Exporter manager not initialized');
    }

    const result = await checkExporterHealth(this.config);
    this.stats.lastHealthCheck = new Date();

    logger.debug(
      {
        traces: result.traces,
        metrics: result.metrics,
        errorCount: result.errors.length,
      },
      'Exporter health check completed',
    );

    return result;
  }

  /**
   * Force flush all exporters
   */
  async forceFlush(): Promise<void> {
    if (this.state !== ExporterState.RUNNING) {
      logger.warn('Cannot flush exporters - manager not running');
      return;
    }

    const flushPromises: Promise<void>[] = [];

    // Flush trace exporters
    for (const exporter of this.traceExporters) {
      if ('forceFlush' in exporter && typeof exporter.forceFlush === 'function') {
        flushPromises.push(exporter.forceFlush());
      }
    }

    // Flush metric exporters
    for (const exporter of this.metricExporters) {
      if ('forceFlush' in exporter && typeof exporter.forceFlush === 'function') {
        flushPromises.push(exporter.forceFlush());
      }
    }

    await Promise.all(flushPromises);
    logger.debug('All exporters flushed');
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(config: TelemetryConfig): void {
    const validationResult = validateTelemetryConfig(config);

    logValidationResults(validationResult, 'exporter-manager');

    if (!validationResult.valid) {
      throw new Error(`Invalid telemetry configuration: ${validationResult.errors.join(', ')}`);
    }
  }

  /**
   * Create exporters based on configuration
   */
  private createExporters(config: TelemetryConfig): void {
    // Create trace exporters
    if (config.tracing.enabled) {
      this.traceExporters = createMultiTraceExporter(config);
      this.stats.traceExporterCount = this.traceExporters.length;
      logger.debug({ count: this.stats.traceExporterCount }, 'Created trace exporters');
    }

    // Create metric exporters
    if (config.metrics.enabled) {
      this.metricExporters = createMultiMetricExporter(config);
      this.stats.metricExporterCount = this.metricExporters.length;
      logger.debug({ count: this.stats.metricExporterCount }, 'Created metric exporters');
    }
  }

  /**
   * Perform initial health check
   */
  private async performInitialHealthCheck(config: TelemetryConfig): Promise<void> {
    try {
      const healthResult = await checkExporterHealth(config);
      this.stats.lastHealthCheck = new Date();

      if (healthResult.errors.length > 0) {
        logger.warn(
          {
            errors: healthResult.errors,
            tracesHealthy: healthResult.traces,
            metricsHealthy: healthResult.metrics,
          },
          'Initial health check found issues',
        );
      } else {
        logger.info('Initial health check passed');
      }
    } catch (error) {
      logger.error({ error }, 'Initial health check failed');
      // Don't fail initialization for health check errors
    }
  }

  /**
   * Shutdown trace exporters
   */
  private async shutdownTraceExporters(): Promise<void> {
    const shutdownPromises = this.traceExporters.map(async (exporter, index) => {
      try {
        await exporter.shutdown();
        logger.debug({ index }, 'Trace exporter shutdown');
      } catch (error) {
        logger.error({ error, index }, 'Error shutting down trace exporter');
      }
    });

    await Promise.allSettled(shutdownPromises);
    logger.debug('All trace exporters shutdown completed');
  }

  /**
   * Shutdown metric exporters
   */
  private async shutdownMetricExporters(): Promise<void> {
    const shutdownPromises = this.metricExporters.map(async (exporter, index) => {
      try {
        await exporter.shutdown();
        logger.debug({ index }, 'Metric exporter shutdown');
      } catch (error) {
        logger.error({ error, index }, 'Error shutting down metric exporter');
      }
    });

    await Promise.allSettled(shutdownPromises);
    logger.debug('All metric exporters shutdown completed');
  }
}

/**
 * Global exporter manager instance
 */
let globalExporterManager: ExporterManager | null = null;

/**
 * Get or create global exporter manager
 */
export function getExporterManager(): ExporterManager {
  globalExporterManager ??= new DefaultExporterManager();
  return globalExporterManager;
}

/**
 * Set custom exporter manager
 */
export function setExporterManager(manager: ExporterManager): void {
  globalExporterManager = manager;
}

/**
 * Initialize global exporter manager
 */
export async function initializeExporters(config: TelemetryConfig): Promise<void> {
  const manager = getExporterManager();
  await manager.initialize(config);
}

/**
 * Shutdown global exporter manager
 */
export async function shutdownExporters(): Promise<void> {
  if (globalExporterManager) {
    await globalExporterManager.shutdown();
  }
}
