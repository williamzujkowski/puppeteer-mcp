/**
 * Browser Pool Facade Methods
 * @module puppeteer/pool/browser-pool-facade
 */

import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import { acquireBrowser, type AcquireBrowserParams } from './browser-pool-acquisition-handlers.js';

/**
 * Acquire browser facade method
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export function acquireBrowserFacade(params: AcquireBrowserParams): Promise<BrowserInstance> {
  return acquireBrowser(params);
}
