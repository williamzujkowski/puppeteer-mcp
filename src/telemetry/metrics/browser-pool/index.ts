/**
 * Browser pool metrics module exports
 * @module telemetry/metrics/browser-pool
 * @nist au-6 "Audit review, analysis, and reporting"
 */

export { BrowserPoolMetrics } from './browser-pool-metrics.js';
export type {
  PoolMetrics,
  BrowserPoolProvider,
  MetricLabels,
  BrowserCloseReason,
  ScreenshotFormat,
  NetworkDirection,
} from './types.js';

import { BrowserPoolMetrics } from './browser-pool-metrics.js';
import type { BrowserPool } from '../../../puppeteer/pool/browser-pool.js';

/**
 * Create browser pool metrics with pool instance
 */
export function createBrowserPoolMetrics(browserPool: BrowserPool): BrowserPoolMetrics {
  return new BrowserPoolMetrics(browserPool);
}
