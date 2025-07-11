/**
 * OpenTelemetry Monitoring Setup
 *
 * This example demonstrates:
 * - Distributed tracing for browser automation
 * - Custom metrics collection
 * - Performance monitoring
 * - Error tracking and alerting
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import axios from 'axios';

// Configuration
const OTEL_ENDPOINT = process.env.OTEL_ENDPOINT || 'http://localhost:4318';
const SERVICE_NAME = 'puppeteer-mcp-automation';
const SERVICE_VERSION = '1.0.0';

// Initialize OpenTelemetry
export function initializeMonitoring() {
  // Configure resource
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  });

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: `${OTEL_ENDPOINT}/v1/traces`,
    headers: {
      'api-key': process.env.OTEL_API_KEY || '',
    },
  });

  // Configure metric exporter
  const metricExporter = new OTLPMetricExporter({
    url: `${OTEL_ENDPOINT}/v1/metrics`,
    headers: {
      'api-key': process.env.OTEL_API_KEY || '',
    },
  });

  // Configure Prometheus exporter for local metrics
  const prometheusExporter = new PrometheusExporter(
    {
      port: 9090,
      endpoint: '/metrics',
    },
    () => {
      console.log('Prometheus metrics available at http://localhost:9090/metrics');
    },
  );

  // Initialize SDK
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          requestHook: (span, request) => {
            span.setAttribute('http.request.body', JSON.stringify(request.body));
          },
        },
      }),
    ],
  });

  // Start SDK
  sdk.start();

  console.log('OpenTelemetry monitoring initialized');

  return { sdk, prometheusExporter };
}

// Custom instrumentation for Puppeteer operations
export class PuppeteerInstrumentation {
  private tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);
  private meter = metrics.getMeter(SERVICE_NAME, SERVICE_VERSION);

  // Metrics
  private sessionCounter = this.meter.createCounter('puppeteer.sessions.created', {
    description: 'Number of browser sessions created',
  });

  private pageLoadHistogram = this.meter.createHistogram('puppeteer.page.load_time', {
    description: 'Page load time in milliseconds',
    unit: 'ms',
  });

  private errorCounter = this.meter.createCounter('puppeteer.errors', {
    description: 'Number of errors encountered',
  });

  private activeSessionsGauge = this.meter.createUpDownCounter('puppeteer.sessions.active', {
    description: 'Number of active browser sessions',
  });

  private memoryGauge = this.meter.createObservableGauge('puppeteer.memory.usage', {
    description: 'Memory usage in bytes',
    unit: 'bytes',
  });

  constructor() {
    // Set up memory monitoring
    this.memoryGauge.addCallback(async (observableResult) => {
      const memUsage = process.memoryUsage();
      observableResult.observe(memUsage.heapUsed, {
        'memory.type': 'heap',
      });
      observableResult.observe(memUsage.rss, {
        'memory.type': 'rss',
      });
    });
  }

  // Trace browser session creation
  async traceSessionCreation<T>(
    operation: () => Promise<T>,
    attributes: Record<string, any> = {},
  ): Promise<T> {
    const span = this.tracer.startSpan('puppeteer.session.create', {
      attributes: {
        'puppeteer.operation': 'create_session',
        ...attributes,
      },
    });

    try {
      const result = await operation();

      this.sessionCounter.add(1, {
        'session.type': attributes.browserName || 'chrome',
      });

      this.activeSessionsGauge.add(1);

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      this.errorCounter.add(1, {
        'error.type': 'session_creation',
      });

      throw error;
    } finally {
      span.end();
    }
  }

  // Trace page navigation
  async traceNavigation<T>(url: string, operation: () => Promise<T>): Promise<T> {
    const span = this.tracer.startSpan('puppeteer.page.navigate', {
      attributes: {
        'http.url': url,
        'puppeteer.operation': 'navigate',
      },
    });

    const startTime = Date.now();

    try {
      const result = await operation();
      const loadTime = Date.now() - startTime;

      this.pageLoadHistogram.record(loadTime, {
        'page.url': new URL(url).hostname,
      });

      span.setAttribute('page.load_time', loadTime);
      span.setStatus({ code: SpanStatusCode.OK });

      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      this.errorCounter.add(1, {
        'error.type': 'navigation',
        'error.url': url,
      });

      throw error;
    } finally {
      span.end();
    }
  }

  // Trace automation workflow
  async traceWorkflow<T>(
    workflowName: string,
    operation: () => Promise<T>,
    metadata: Record<string, any> = {},
  ): Promise<T> {
    const span = this.tracer.startSpan(`puppeteer.workflow.${workflowName}`, {
      attributes: {
        'workflow.name': workflowName,
        'workflow.metadata': JSON.stringify(metadata),
      },
    });

    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      span.setAttribute('workflow.duration', duration);
      span.setAttribute('workflow.success', true);
      span.setStatus({ code: SpanStatusCode.OK });

      // Log custom event
      span.addEvent('workflow.completed', {
        duration,
        result: JSON.stringify(result),
      });

      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      this.errorCounter.add(1, {
        'error.type': 'workflow',
        'error.workflow': workflowName,
      });

      throw error;
    } finally {
      span.end();
    }
  }

  // Record custom metric
  recordMetric(name: string, value: number, labels: Record<string, string> = {}) {
    const customMetric = this.meter.createHistogram(`puppeteer.custom.${name}`, {
      description: `Custom metric: ${name}`,
    });

    customMetric.record(value, labels);
  }

  // Session cleanup tracking
  sessionClosed() {
    this.activeSessionsGauge.add(-1);
  }
}

// Example: Monitored automation workflow
export class MonitoredAutomation {
  private instrumentation = new PuppeteerInstrumentation();
  private apiClient = axios.create({
    baseURL: process.env.API_BASE_URL || 'http://localhost:3000/api',
    headers: {
      'X-API-Key': process.env.API_KEY || '',
    },
  });

  async runMonitoredWorkflow(params: any) {
    return this.instrumentation.traceWorkflow(
      'example_workflow',
      async () => {
        let sessionId: string | null = null;

        try {
          // Create session with monitoring
          const session = await this.instrumentation.traceSessionCreation(
            async () => {
              const response = await this.apiClient.post('/sessions', {
                capabilities: { browserName: 'chrome' },
              });
              return response.data.data;
            },
            { browserName: 'chrome' },
          );

          sessionId = session.id;

          // Navigate with monitoring
          await this.instrumentation.traceNavigation(params.url, async () => {
            await this.apiClient.post(`/sessions/${sessionId}/execute`, {
              script: 'goto',
              args: [params.url],
            });
          });

          // Custom operation with metrics
          const extractionStart = Date.now();
          const data = await this.extractData(sessionId);
          this.instrumentation.recordMetric('data_extraction_time', Date.now() - extractionStart, {
            url: params.url,
          });

          return { success: true, data };
        } finally {
          if (sessionId) {
            await this.cleanup(sessionId);
            this.instrumentation.sessionClosed();
          }
        }
      },
      { url: params.url },
    );
  }

  private async extractData(sessionId: string): Promise<any> {
    const response = await this.apiClient.post(`/sessions/${sessionId}/execute`, {
      script: 'evaluate',
      args: [`document.title`],
    });

    return response.data.data.result;
  }

  private async cleanup(sessionId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/sessions/${sessionId}`);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

// Grafana Dashboard Configuration
export const grafanaDashboard = {
  title: 'Puppeteer MCP Monitoring',
  panels: [
    {
      title: 'Session Creation Rate',
      query: 'rate(puppeteer_sessions_created_total[5m])',
      type: 'graph',
    },
    {
      title: 'Active Sessions',
      query: 'puppeteer_sessions_active',
      type: 'gauge',
    },
    {
      title: 'Page Load Time (p95)',
      query: 'histogram_quantile(0.95, puppeteer_page_load_time_bucket)',
      type: 'graph',
    },
    {
      title: 'Error Rate',
      query: 'rate(puppeteer_errors_total[5m])',
      type: 'graph',
    },
    {
      title: 'Memory Usage',
      query: 'puppeteer_memory_usage_bytes',
      type: 'graph',
    },
    {
      title: 'Workflow Success Rate',
      query: 'rate(puppeteer_workflow_completed_total[5m])',
      type: 'stat',
    },
  ],
  alerts: [
    {
      name: 'HighErrorRate',
      condition: 'rate(puppeteer_errors_total[5m]) > 0.1',
      severity: 'warning',
    },
    {
      name: 'HighMemoryUsage',
      condition: 'puppeteer_memory_usage_bytes > 1073741824', // 1GB
      severity: 'critical',
    },
    {
      name: 'LowSuccessRate',
      condition: 'rate(puppeteer_workflow_completed_total[5m]) < 0.9',
      severity: 'warning',
    },
  ],
};

// Example usage
if (require.main === module) {
  (async () => {
    // Initialize monitoring
    const { sdk } = initializeMonitoring();

    // Run monitored automation
    const automation = new MonitoredAutomation();

    try {
      const result = await automation.runMonitoredWorkflow({
        url: 'https://example.com',
      });

      console.log('Workflow completed:', result);
    } catch (error) {
      console.error('Workflow failed:', error);
    }

    // Keep the process running for metrics collection
    console.log('Monitoring active. Metrics available at http://localhost:9090/metrics');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await sdk.shutdown();
      process.exit(0);
    });
  })();
}
