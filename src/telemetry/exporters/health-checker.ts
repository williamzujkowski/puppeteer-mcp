/**
 * Exporter health checking utilities
 * @module telemetry/exporters/health-checker
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { TelemetryConfig } from '../config.js';
import type {
  HealthCheckResult,
  HealthCheckStrategy,
  HealthCheckCommand,
  ExporterHealthResult,
  ConnectivityOptions,
} from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * Default connectivity check options
 */
const DEFAULT_CONNECTIVITY_OPTIONS: ConnectivityOptions = {
  timeout: 5000,
  method: 'HEAD',
  allowedStatusCodes: [200, 404, 405], // Method not allowed is acceptable
};

/**
 * OTLP health check strategy
 */
export class OTLPHealthCheckStrategy implements HealthCheckStrategy {
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
export class JaegerHealthCheckStrategy implements HealthCheckStrategy {
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
export class ZipkinHealthCheckStrategy implements HealthCheckStrategy {
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
export class ConsoleHealthCheckStrategy implements HealthCheckStrategy {
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
export class NoneHealthCheckStrategy implements HealthCheckStrategy {
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
 * Prometheus health check strategy
 */
export class PrometheusHealthCheckStrategy implements HealthCheckStrategy {
  getEndpoint(config: TelemetryConfig): string | null {
    const port = config.metrics.endpoints.prometheusPort;
    return port ? `http://localhost:${port}/metrics` : null;
  }

  requiresConnectivityCheck(): boolean {
    return false; // Prometheus server starts its own HTTP server
  }

  getConfigurationErrorPrefix(): string {
    return 'Invalid Prometheus exporter configuration';
  }
}

/**
 * Connectivity checker utility
 */
export class ConnectivityChecker {
  /**
   * Check endpoint connectivity
   */
  static async checkEndpoint(
    endpoint: string,
    errorPrefix: string,
    options: ConnectivityOptions = DEFAULT_CONNECTIVITY_OPTIONS,
  ): Promise<HealthCheckResult> {
    try {
      const url = new URL(endpoint);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeout);

      try {
        const response = await fetch(url.origin, {
          signal: controller.signal,
          method: options.method,
        });

        const allowedCodes = options.allowedStatusCodes ??
          DEFAULT_CONNECTIVITY_OPTIONS.allowedStatusCodes ?? [200, 404, 405];
        const healthy = allowedCodes.includes(response.status);

        if (!healthy) {
          return {
            healthy: false,
            errors: [`${errorPrefix} endpoint returned status ${response.status}: ${endpoint}`],
          };
        }

        return { healthy: true, errors: [] };
      } catch (error) {
        const errorMessage =
          error instanceof Error && error.name === 'AbortError'
            ? `${errorPrefix} endpoint timeout: ${endpoint}`
            : `${errorPrefix} endpoint unreachable: ${endpoint} (${String(error)})`;

        return { healthy: false, errors: [errorMessage] };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      return {
        healthy: false,
        errors: [
          `Invalid ${errorPrefix.toLowerCase()} endpoint URL: ${endpoint} (${String(error)})`,
        ],
      };
    }
  }

  /**
   * Check multiple endpoints concurrently
   */
  static async checkEndpoints(
    endpoints: Array<{ endpoint: string; errorPrefix: string }>,
    options: ConnectivityOptions = DEFAULT_CONNECTIVITY_OPTIONS,
  ): Promise<HealthCheckResult[]> {
    const checks = endpoints.map(({ endpoint, errorPrefix }) =>
      this.checkEndpoint(endpoint, errorPrefix, options),
    );

    return Promise.all(checks);
  }
}

/**
 * Health check strategy factory
 */
export class HealthCheckStrategyFactory {
  private static readonly strategies = new Map<string, () => HealthCheckStrategy>([
    ['otlp', () => new OTLPHealthCheckStrategy()],
    ['jaeger', () => new JaegerHealthCheckStrategy()],
    ['zipkin', () => new ZipkinHealthCheckStrategy()],
    ['console', () => new ConsoleHealthCheckStrategy()],
    ['none', () => new NoneHealthCheckStrategy()],
    ['prometheus', () => new PrometheusHealthCheckStrategy()],
  ]);

  static createStrategy(exporterType: string): HealthCheckStrategy {
    const strategyFactory = this.strategies.get(exporterType);

    if (!strategyFactory) {
      logger.warn(
        { exporterType },
        'Unknown exporter type for health check, using console strategy',
      );
      return new ConsoleHealthCheckStrategy();
    }

    return strategyFactory();
  }

  static registerStrategy(exporterType: string, strategyFactory: () => HealthCheckStrategy): void {
    this.strategies.set(exporterType, strategyFactory);
    logger.debug({ exporterType }, 'Registered health check strategy');
  }

  static getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}

/**
 * Trace health check command
 */
export class TraceHealthCheckCommand implements HealthCheckCommand {
  constructor(private readonly config: TelemetryConfig) {}

  async execute(): Promise<HealthCheckResult> {
    if (!this.config.tracing.enabled) {
      return { healthy: true, errors: [] };
    }

    const strategy = HealthCheckStrategyFactory.createStrategy(this.config.tracing.exporter);

    if (!strategy.requiresConnectivityCheck()) {
      return { healthy: true, errors: [] };
    }

    const endpoint = strategy.getEndpoint(this.config);
    if (endpoint === null || endpoint.trim() === '') {
      return { healthy: true, errors: [] };
    }

    return ConnectivityChecker.checkEndpoint(endpoint, 'Trace exporter');
  }
}

/**
 * Metric health check command
 */
export class MetricHealthCheckCommand implements HealthCheckCommand {
  constructor(private readonly config: TelemetryConfig) {}

  async execute(): Promise<HealthCheckResult> {
    if (!this.config.metrics.enabled) {
      return { healthy: true, errors: [] };
    }

    const strategy = HealthCheckStrategyFactory.createStrategy(this.config.metrics.exporter);

    if (!strategy.requiresConnectivityCheck()) {
      return { healthy: true, errors: [] };
    }

    const endpoint = strategy.getEndpoint(this.config);
    if (endpoint === null || endpoint.trim() === '') {
      return { healthy: true, errors: [] };
    }

    return ConnectivityChecker.checkEndpoint(endpoint, 'Metric exporter');
  }
}

/**
 * Health check result builder
 */
export class HealthCheckResultBuilder {
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

  build(): ExporterHealthResult {
    return {
      traces: this.traceResult.healthy,
      metrics: this.metricResult.healthy,
      errors: [...this.traceResult.errors, ...this.metricResult.errors],
    };
  }
}

/**
 * Exporter health check coordinator
 */
export async function checkExporterHealth(config: TelemetryConfig): Promise<ExporterHealthResult> {
  const traceCommand = new TraceHealthCheckCommand(config);
  const metricCommand = new MetricHealthCheckCommand(config);

  logger.debug('Starting exporter health check');

  try {
    const [traceResult, metricResult] = await Promise.all([
      traceCommand.execute(),
      metricCommand.execute(),
    ]);

    const result = new HealthCheckResultBuilder()
      .withTraceResult(traceResult)
      .withMetricResult(metricResult)
      .build();

    logger.debug(
      {
        traces: result.traces,
        metrics: result.metrics,
        errorCount: result.errors.length,
      },
      'Exporter health check completed',
    );

    return result;
  } catch (error) {
    logger.error({ error }, 'Exporter health check failed');
    return {
      traces: false,
      metrics: false,
      errors: [`Health check failed: ${String(error)}`],
    };
  }
}

/**
 * Perform comprehensive health check with detailed results
 */
export async function performDetailedHealthCheck(config: TelemetryConfig): Promise<{
  overall: boolean;
  details: {
    tracing: HealthCheckResult;
    metrics: HealthCheckResult;
  };
}> {
  const traceCommand = new TraceHealthCheckCommand(config);
  const metricCommand = new MetricHealthCheckCommand(config);

  const [traceResult, metricResult] = await Promise.all([
    traceCommand.execute(),
    metricCommand.execute(),
  ]);

  const overall = traceResult.healthy && metricResult.healthy;

  return {
    overall,
    details: {
      tracing: traceResult,
      metrics: metricResult,
    },
  };
}
