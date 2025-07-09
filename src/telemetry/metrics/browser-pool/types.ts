/**
 * Shared types for browser pool metrics
 * @module telemetry/metrics/browser-pool/types
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { BrowserPool } from '../../../puppeteer/pool/browser-pool.js';

/**
 * Browser pool metrics interface
 */
export interface PoolMetrics {
  queueLength: number;
  utilizationPercentage: number;
  memoryUsage: number;
  cpuUsage: number;
}

/**
 * Browser pool metrics provider
 */
export interface BrowserPoolProvider {
  browserPool?: BrowserPool;
  getPoolMetrics(): PoolMetrics;
}

/**
 * Common metric labels
 */
export interface MetricLabels {
  [key: string]: string;
}

/**
 * Browser lifecycle reason
 */
export type BrowserCloseReason = 'normal' | 'crash' | 'timeout';

/**
 * Screenshot format
 */
export type ScreenshotFormat = 'png' | 'jpeg' | 'webp';

/**
 * Network direction
 */
export type NetworkDirection = 'upload' | 'download';