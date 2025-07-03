/**
 * Browser pool metrics
 * @module puppeteer/pool/browser-pool-metrics
 * @nist au-3 "Content of audit records"
 */

import type { PoolMetrics } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';

/**
 * Get pool metrics
 * @nist au-3 "Content of audit records"
 */
export function getPoolMetrics(
  browsers: Map<string, InternalBrowserInstance>,
  maxBrowsers: number,
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
    browsersCreated: 0, // TODO: Track this metric
    browsersDestroyed: 0, // TODO: Track this metric
    avgBrowserLifetime: 0, // TODO: Calculate this metric
    utilizationPercentage: browsers.size > 0 ? (activeBrowsers / maxBrowsers) * 100 : 0,
    lastHealthCheck: new Date(),
  };
}
