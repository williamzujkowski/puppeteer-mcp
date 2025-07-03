/**
 * Browser Pool Public Methods
 * @module puppeteer/pool/browser-pool-public-methods
 */

import type { Page } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { 
  BrowserInstance,
  BrowserPoolOptions,
  PoolMetrics,
} from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { BrowserPoolMaintenance } from './browser-pool-maintenance.js';
import { 
  createPage as createBrowserPage,
  closePage as closeBrowserPage,
  listBrowsers,
} from './browser-pool-operations.js';
import { getPoolMetrics } from './browser-pool-metrics.js';
import { configurePoolOptions } from './browser-pool-config.js';

const logger = createLogger('browser-pool-public-methods');

/**
 * Create a new page in a browser
 * @nist ac-4 "Information flow enforcement"
 */
export function createPage(
  browserId: string, 
  sessionId: string,
  browsers: Map<string, InternalBrowserInstance>
): Promise<Page> {
  return createBrowserPage(browserId, sessionId, browsers);
}

/**
 * Close a page in a browser
 */
export function closePage(
  browserId: string, 
  sessionId: string,
  browsers: Map<string, InternalBrowserInstance>
): Promise<void> {
  return closeBrowserPage(browserId, sessionId, browsers);
}

/**
 * Perform health check on all browsers
 * @nist si-4 "Information system monitoring"
 */
export function healthCheck(
  maintenance: BrowserPoolMaintenance,
  browsers: Map<string, InternalBrowserInstance>
): Promise<Map<string, boolean>> {
  return maintenance.healthCheck(browsers);
}

/**
 * Parameters for recycleBrowser
 */
export interface RecycleBrowserParams {
  browserId: string;
  browsers: Map<string, InternalBrowserInstance>;
  options: BrowserPoolOptions;
  maintenance: BrowserPoolMaintenance;
  removeBrowser: (browserId: string) => Promise<void>;
}

/**
 * Recycle a browser instance
 */
export async function recycleBrowser(
  params: RecycleBrowserParams
): Promise<void> {
  const { browserId, browsers, options, maintenance, removeBrowser } = params;
  
  try {
    await maintenance.recycleBrowser(
      browserId,
      browsers,
      options
    );
  } catch (error) {
    logger.error({ browserId, error }, 'Failed to recycle browser');
    await removeBrowser(browserId);
  }
}

/**
 * List all browser instances
 */
export function listBrowsersPublic(
  browsers: Map<string, InternalBrowserInstance>
): BrowserInstance[] {
  return listBrowsers(browsers);
}

/**
 * Clean up idle browsers
 */
export function cleanupIdle(
  maintenance: BrowserPoolMaintenance,
  browsers: Map<string, InternalBrowserInstance>,
  options: BrowserPoolOptions,
  removeBrowser: (browserId: string) => Promise<void>
): Promise<number> {
  return maintenance.cleanupIdle(
    browsers,
    options,
    removeBrowser
  );
}

/**
 * Configure pool options
 * @nist cm-7 "Least functionality"
 */
export function configure(
  currentOptions: BrowserPoolOptions,
  newOptions: Partial<BrowserPoolOptions>,
  maintenance: BrowserPoolMaintenance,
  performMaintenance: () => Promise<void>
): BrowserPoolOptions {
  const updatedOptions = configurePoolOptions(currentOptions, newOptions);
  
  // Restart maintenance if interval changed
  if (newOptions.healthCheckInterval) {
    maintenance.stopMaintenance();
    maintenance.startMaintenance(
      performMaintenance,
      60000
    );
  }
  
  return updatedOptions;
}

/**
 * Get browser instance by ID
 * @nist ac-3 "Access enforcement"
 */
export function getBrowser(
  browserId: string,
  browsers: Map<string, InternalBrowserInstance>
): BrowserInstance | undefined {
  return browsers.get(browserId);
}

/**
 * Get pool metrics
 * @nist au-3 "Content of audit records"
 */
export function getMetrics(
  browsers: Map<string, InternalBrowserInstance>,
  maxBrowsers: number
): PoolMetrics {
  return getPoolMetrics(browsers, maxBrowsers);
}