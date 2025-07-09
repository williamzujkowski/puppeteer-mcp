/**
 * Browser pool metrics collection
 * @module telemetry/metrics/browser-pool
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

// Re-export from modular implementation
export { BrowserPoolMetrics, createBrowserPoolMetrics } from './browser-pool/index.js';
export type { 
  PoolMetrics, 
  BrowserPoolProvider, 
  MetricLabels,
  BrowserCloseReason,
  ScreenshotFormat,
  NetworkDirection 
} from './browser-pool/index.js';