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

  // Launch multiple browsers initially for better concurrency
  const browsersToLaunch = Math.min(Math.max(2, Math.floor(maxBrowsers / 2)), maxBrowsers);
  let browsersLaunched = 0;
  const launchPromises: Promise<unknown>[] = [];

  logger.info({ browsersToLaunch }, 'Launching initial browsers');

  // Launch browsers in parallel
  for (let i = 0; i < browsersToLaunch; i++) {
    launchPromises.push(
      launchNewBrowser()
        .then(() => {
          browsersLaunched++;
          logger.debug({ browserIndex: i + 1, browsersLaunched }, 'Browser launched');
        })
        .catch((error) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(
            {
              browserIndex: i + 1,
              error: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
            },
            'Failed to launch browser',
          );
        }),
    );
  }

  // Wait for all launch attempts to complete
  await Promise.allSettled(launchPromises);

  if (browsersLaunched === 0) {
    logger.error('Failed to launch any browsers - browser pool will be empty');
    // Don't throw here - let the pool start empty and browsers will be created on demand
  } else {
    logger.info({ browsersLaunched }, 'Initial browsers launched successfully');
  }

  logger.info(
    {
      activeBrowsers: browsersLaunched,
      initialized: true,
    },
    'Browser pool initialized',
  );
}
