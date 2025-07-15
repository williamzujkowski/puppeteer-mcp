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
  maxBrowsers: 5,
  maxPagesPerBrowser: 10,
  idleTimeout: 5 * 60 * 1000, // 5 minutes
  acquisitionTimeout:
    process.env.CI === 'true' ? 180000 : process.env.NODE_ENV === 'test' ? 120000 : 30000, // 180s for CI, 120s for tests, 30s for production
  healthCheckInterval: 30000,
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
