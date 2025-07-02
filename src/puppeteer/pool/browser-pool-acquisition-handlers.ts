/**
 * Browser pool acquisition handlers
 * @module puppeteer/pool/browser-pool-acquisition-handlers
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import { AppError } from '../../core/errors/app-error.js';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';

const logger = createLogger('browser-pool-acquisition-handlers');

/**
 * Acquire a browser for a session
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export async function acquireBrowser(
  sessionId: string,
  isShuttingDown: boolean,
  findIdleBrowser: () => InternalBrowserInstance | null,
  activateBrowser: (instance: InternalBrowserInstance, sessionId: string) => InternalBrowserInstance,
  createAndAcquireBrowser: (sessionId: string) => Promise<BrowserInstance>,
  canCreateNewBrowser: () => boolean,
  queueAcquisition: (sessionId: string) => Promise<BrowserInstance>
): Promise<BrowserInstance> {
  if (isShuttingDown) {
    throw new AppError('Browser pool is shutting down', 503);
  }

  logger.debug({ sessionId }, 'Browser acquisition requested');

  // Try to find an idle browser
  const idleBrowser = findIdleBrowser();
  if (idleBrowser) {
    return activateBrowser(idleBrowser, sessionId);
  }

  // Check if we can create a new browser
  if (canCreateNewBrowser()) {
    return createAndAcquireBrowser(sessionId);
  }

  // Queue the request
  return queueAcquisition(sessionId);
}

/**
 * Release a browser back to the pool
 * @nist ac-12 "Session termination"
 */
export function releaseBrowser(
  browserId: string,
  browsers: Map<string, InternalBrowserInstance>,
  queue: any,
  onReleased: (browserId: string) => void
): void {
  const instance = browsers.get(browserId);
  if (!instance) {
    logger.warn({ browserId }, 'Attempted to release unknown browser');
    return;
  }

  logger.debug({ browserId, sessionId: instance.sessionId }, 'Releasing browser');

  // Update state
  instance.state = 'idle';
  instance.sessionId = null;
  instance.lastUsedAt = new Date();

  // Process queue
  queue.processNext(instance);

  // Emit event
  onReleased(browserId);
}