/**
 * Browser Pool Facade Methods
 * @module puppeteer/pool/browser-pool-facade
 */

import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { acquireBrowser } from './browser-pool-acquisition-handlers.js';

/**
 * Acquire browser facade method
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export function acquireBrowserFacade(
  sessionId: string,
  isShuttingDown: boolean,
  findIdleBrowser: () => InternalBrowserInstance | null,
  activateBrowser: (instance: InternalBrowserInstance, sessionId: string) => InternalBrowserInstance,
  createAndAcquireBrowser: (sessionId: string) => Promise<BrowserInstance>,
  canCreateNewBrowser: () => boolean,
  queueAcquisition: (sessionId: string) => Promise<BrowserInstance>
): Promise<BrowserInstance> {
  return acquireBrowser(
    sessionId,
    isShuttingDown,
    findIdleBrowser,
    activateBrowser,
    createAndAcquireBrowser,
    canCreateNewBrowser,
    queueAcquisition
  );
}