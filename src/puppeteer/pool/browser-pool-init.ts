/**
 * Browser pool initialization
 * @module puppeteer/pool/browser-pool-init
 * @nist ac-3 "Access enforcement"
 */

import { createLogger } from '../../utils/logger.js';
import type { BrowserPool } from '../interfaces/browser-pool.interface.js';

const logger = createLogger('browser-pool-init');

/**
 * Initialize the pool
 * @nist ac-3 "Access enforcement"
 */
export async function initializePool(
  _pool: BrowserPool,
  maxBrowsers: number,
  launchNewBrowser: () => Promise<unknown>,
): Promise<void> {
  logger.info(
    {
      maxBrowsers,
    },
    'Initializing browser pool',
  );

  // Launch one browser initially
  let initialBrowserLaunched = false;
  try {
    await launchNewBrowser();
    initialBrowserLaunched = true;
    logger.info('Initial browser launched successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Failed to launch initial browser - browser pool will be empty',
    );
    // Don't throw here - let the pool start empty and browsers will be created on demand
  }

  logger.info(
    {
      activeBrowsers: initialBrowserLaunched ? 1 : 0,
      initialized: true,
    },
    'Browser pool initialized',
  );
}
