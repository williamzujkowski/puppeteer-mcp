/**
 * Browser pool operations
 * @module puppeteer/pool/browser-pool-operations
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import type { Page } from 'puppeteer';
import { AppError } from '../../core/errors/app-error.js';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';

const logger = createLogger('browser-pool-operations');

/**
 * Find an idle browser
 */
export function findIdleBrowser(
  browsers: Map<string, InternalBrowserInstance>,
): InternalBrowserInstance | null {
  for (const instance of browsers.values()) {
    if (instance.state === 'idle' && instance.browser.isConnected()) {
      return instance;
    }
  }
  return null;
}

/**
 * Activate a browser for a session
 */
export function activateBrowser(
  instance: InternalBrowserInstance,
  sessionId: string,
): InternalBrowserInstance {
  instance.state = 'active';
  instance.sessionId = sessionId;
  instance.lastUsedAt = new Date();

  logger.debug(
    {
      browserId: instance.id,
      sessionId,
    },
    'Browser activated for session',
  );

  return instance;
}

/**
 * Create a new page in a browser
 * @nist ac-4 "Information flow enforcement"
 */
export async function createPage(
  browserId: string,
  sessionId: string,
  browsers: Map<string, InternalBrowserInstance>,
): Promise<Page> {
  const instance = browsers.get(browserId);
  if (!instance) {
    throw new AppError('Browser not found', 404);
  }

  if (instance.sessionId !== sessionId) {
    throw new AppError('Browser not assigned to session', 403);
  }

  const page = await instance.browser.newPage();
  instance.pageCount++;
  instance.lastUsedAt = new Date();

  return page;
}

/**
 * Close a page in a browser
 */
export function closePage(
  browserId: string,
  sessionId: string,
  browsers: Map<string, InternalBrowserInstance>,
): void {
  const instance = browsers.get(browserId);
  if (!instance) {
    return;
  }

  if (instance.sessionId !== sessionId) {
    throw new AppError('Browser not assigned to session', 403);
  }

  // Decrement page count
  instance.pageCount = Math.max(0, instance.pageCount - 1);
  instance.lastUsedAt = new Date();

  // If browser has no more pages, it should be released
  if (instance.pageCount === 0 && instance.sessionId) {
    logger.info({
      msg: 'Browser has no active pages, marking for release',
      browserId,
      sessionId: instance.sessionId,
      state: instance.state,
    });
    
    // Note: The actual release should be handled by the browser pool
    // This function just updates the state. The pool's cleanup process
    // or the page manager should trigger the actual release.
  }
}

/**
 * List all browser instances
 */
export function listBrowsers(browsers: Map<string, InternalBrowserInstance>): BrowserInstance[] {
  return Array.from(browsers.values()).map((internal) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { state, sessionId, errorCount, ...browserInstance } = internal;
    return browserInstance;
  });
}
