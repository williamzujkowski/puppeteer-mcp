/**
 * OpenTelemetry metrics collection
 * @module telemetry/metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

// Re-export from modular structure
export { AppMetrics, appMetrics } from './app-metrics/index.js';
export type {
  BaseMetrics,
  HttpMetrics,
  GrpcMetrics,
  WebSocketMetrics,
  SecurityMetrics,
  SessionMetrics,
  PuppeteerMetrics,
  McpMetrics,
  HttpRequestLabels,
  GrpcCallLabels,
  AuthLabels,
  ErrorLabels,
  ApiCallLabels,
} from './app-metrics/index.js';

import { Counter, Histogram, ObservableGauge, ObservableResult } from '@opentelemetry/api';
import { getMeter } from '../index.js';

/**
 * Create custom gauge
 */
export function createGauge(
  name: string,
  description: string,
  callback: () => number,
  unit: string = '1',
): ObservableGauge {
  const meter = getMeter();
  return meter.createObservableGauge(
    name,
    {
      description,
      unit,
    },
    (result: ObservableResult<number>) => {
      result.observe(callback());
    },
  );
}

/**
 * Create custom counter
 */
export function createCounter(name: string, description: string, unit: string = '1'): Counter {
  const meter = getMeter();
  return meter.createCounter(name, {
    description,
    unit,
  });
}

/**
 * Create custom histogram
 */
export function createHistogram(name: string, description: string, unit: string = 'ms'): Histogram {
  const meter = getMeter();
  return meter.createHistogram(name, {
    description,
    unit,
  });
}
