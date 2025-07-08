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
  try {
    await launchNewBrowser();
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to launch initial browser',
    );
  }

  logger.info(
    {
      activeBrowsers: 1,
    },
    'Browser pool initialized',
  );
}
