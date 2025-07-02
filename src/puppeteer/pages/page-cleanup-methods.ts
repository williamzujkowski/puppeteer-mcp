/**
 * Page Cleanup Method Implementations
 * @module puppeteer/pages/page-cleanup-methods
 * @nist ac-3 "Access enforcement"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { createLogger } from '../../utils/logger.js';
import type { Page } from 'puppeteer';
import type { PageInfoStore } from './page-info-store.js';
import { cleanupIdlePages as performCleanup } from './page-operations.js';

const logger = createLogger('page-cleanup-methods');

/**
 * Clean up idle pages with logging
 * @param idleTimeout - Idle timeout in milliseconds
 * @param pageStore - Page info store
 * @returns Number of pages cleaned up
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export async function cleanupIdlePagesWithLogging(
  idleTimeout: number,
  pageStore: PageInfoStore
): Promise<number> {
  const cleanedCount = await performCleanup(idleTimeout, pageStore);
  
  if (cleanedCount > 0) {
    logger.info({ cleanedCount, idleTimeout }, 'Cleaned up idle pages');
  }

  return cleanedCount;
}