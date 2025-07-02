/**
 * Browser pool shutdown logic
 * @module puppeteer/pool/browser-pool-shutdown
 * @nist ac-12 "Session termination"
 */

import { createLogger } from '../../utils/logger.js';
import { closeBrowser } from './browser-utils.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import type { BrowserHealthMonitor } from './browser-health.js';
import type { BrowserQueue } from './browser-queue.js';

const logger = createLogger('browser-pool-shutdown');

/**
 * Shutdown the pool
 * @nist ac-12 "Session termination"
 */
export async function shutdownPool(
  browsers: Map<string, InternalBrowserInstance>,
  healthMonitor: BrowserHealthMonitor,
  queue: BrowserQueue
): Promise<void> {
  logger.info('Shutting down browser pool');

  // Stop health monitoring
  healthMonitor.stopAll();

  // Clear queue
  queue.clear();

  // Close all browsers
  const closePromises = Array.from(browsers.values()).map(instance =>
    closeBrowser(instance.browser).catch(error => {
      logger.error({ browserId: instance.id, error }, 'Error closing browser');
    })
  );

  await Promise.allSettled(closePromises);

  browsers.clear();
  logger.info('Browser pool shutdown complete');
}