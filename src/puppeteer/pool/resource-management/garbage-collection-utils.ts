/**
 * Garbage collection utilities
 * @module puppeteer/pool/resource-management/garbage-collection-utils
 * @nist sc-3 "Security function isolation"
 */

import type { Browser } from 'puppeteer';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('garbage-collection-utils');

/**
 * Trigger garbage collection in browser pages
 * @nist sc-3 "Security function isolation"
 */
export async function triggerGarbageCollection(browser: Browser): Promise<void> {
  try {
    const pages = await browser.pages();
    for (const page of pages) {
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });
    }
    logger.debug('Garbage collection triggered');
  } catch (error) {
    logger.debug({ error }, 'Error triggering garbage collection');
  }
}
