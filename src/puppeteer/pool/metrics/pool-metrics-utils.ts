/**
 * Utility functions for pool metrics calculation
 * @module puppeteer/pool/metrics/pool-metrics-utils
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import type { PoolMetrics } from '../../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from '../browser-pool-maintenance.js';

/**
 * Calculate base pool metrics
 * @nist au-3 "Content of audit records"
 */
export function getPoolMetrics(
  browsers: Map<string, InternalBrowserInstance>,
  maxBrowsers: number
): PoolMetrics {
  const instances = Array.from(browsers.values());

  const totalPages = instances.reduce((sum, i) => sum + i.pageCount, 0);
  const activePages = totalPages; // Simplified - all pages are considered active

  // Use state for determining active vs idle instead of pageCount
  const activeBrowsers = instances.filter((i) => i.state === 'active').length;
  const idleBrowsers = instances.filter((i) => i.state === 'idle').length;

  return {
    totalBrowsers: browsers.size,
    activeBrowsers,
    idleBrowsers,
    totalPages,
    activePages,
    browsersCreated: 0, // Will be overridden by ExtendedPoolMetrics
    browsersDestroyed: 0, // Will be overridden by ExtendedPoolMetrics
    avgBrowserLifetime: 0, // Will be overridden by ExtendedPoolMetrics
    utilizationPercentage:
      browsers.size > 0 ? (activeBrowsers / maxBrowsers) * 100 : 0,
    lastHealthCheck: new Date(),
  };
}