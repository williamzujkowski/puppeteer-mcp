/**
 * Application metrics module
 * @module telemetry/metrics/app-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

// Main metrics coordinator
export { AppMetrics } from './app-metrics.js';

// Individual metric modules
export { HttpMetricsImpl } from './http-metrics.js';
export { GrpcMetricsImpl } from './grpc-metrics.js';
export { WebSocketMetricsImpl } from './websocket-metrics.js';
export { SecurityMetricsImpl } from './security-metrics.js';
export { SessionMetricsImpl } from './session-metrics.js';
export { PuppeteerMetricsImpl } from './puppeteer-metrics.js';
export { McpMetricsImpl } from './mcp-metrics.js';

// Types
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
} from './types.js';

// Global instance
import { AppMetrics } from './app-metrics.js';
export const appMetrics = new AppMetrics();
