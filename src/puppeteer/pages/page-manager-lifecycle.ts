/**
 * Page manager lifecycle methods
 * @module puppeteer/pages/page-manager-lifecycle
 * @nist ac-12 "Session termination"
 */

import type { Page } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { PageInfoStore } from './page-info-store.js';
import { closePage, performPeriodicCleanup } from './page-cleanup.js';

const logger = createLogger('page-manager-lifecycle');

/**
 * Perform periodic cleanup of idle pages
 */
export async function performCleanup(
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
  isShuttingDown: boolean
): Promise<number> {
  if (isShuttingDown) {
    return 0;
  }

  try {
    const cleanedCount = await performPeriodicCleanup(
      pages, 
      pageStore
    );
    
    if (cleanedCount > 0) {
      logger.info({ cleanedCount }, 'Cleaned up idle pages');
    }

    return cleanedCount;
  } catch (error) {
    logger.error({ error }, 'Error during periodic cleanup');
    return 0;
  }
}

/**
 * Shutdown page manager
 * @nist ac-12 "Session termination"
 */
export async function shutdownPageManager(
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
  cleanupInterval?: NodeJS.Timeout
): Promise<void> {
  logger.info('Shutting down page manager');

  // Stop periodic cleanup
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  // Close all pages
  const allPages = Array.from(pages.keys());
  await Promise.allSettled(
    allPages.map(pageId => 
      closePage(pageId, pages, pageStore).catch(error => {
        logger.error({ pageId, error }, 'Error closing page during shutdown');
      })
    )
  );

  await pageStore.clear();
  pages.clear();

  logger.info('Page manager shutdown complete');
}