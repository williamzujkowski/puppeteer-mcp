/**
 * Browser pool configuration
 * @module puppeteer/pool/browser-pool-config
 * @nist cm-7 "Least functionality"
 */

import type { BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import { getDefaultLaunchOptions } from '../config.js';

/**
 * Default pool options
 */
export const DEFAULT_OPTIONS: Partial<BrowserPoolOptions> = {
  maxBrowsers: process.env.CI === 'true' ? 2 : 5, // Reduce browsers in CI
  maxPagesPerBrowser: process.env.CI === 'true' ? 5 : 10, // Reduce pages per browser in CI
  idleTimeout: 5 * 60 * 1000, // 5 minutes
  acquisitionTimeout:
    process.env.CI === 'true' ? 300000 : process.env.NODE_ENV === 'test' ? 120000 : 30000, // 5min for CI, 120s for tests, 30s for production
  healthCheckInterval: process.env.CI === 'true' ? 60000 : 30000, // Longer health check interval in CI
  launchOptions: getDefaultLaunchOptions(),
};

/**
 * Configure pool options
 * @nist cm-7 "Least functionality"
 */
export function configurePoolOptions(
  currentOptions: BrowserPoolOptions,
  newOptions: Partial<BrowserPoolOptions>,
): BrowserPoolOptions {
  return { ...currentOptions, ...newOptions };
}
