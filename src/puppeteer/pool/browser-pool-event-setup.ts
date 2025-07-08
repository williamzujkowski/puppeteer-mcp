/**
 * Browser pool event setup
 * @module puppeteer/pool/browser-pool-event-setup
 */

import type { EventEmitter } from 'events';
import type { BrowserQueue } from './browser-queue.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';

/**
 * Set up queue event handlers
 */
export function setupQueueHandlers(
  emitter: EventEmitter,
  queue: BrowserQueue,
  findIdleBrowser: () => InternalBrowserInstance | null,
): void {
  // When a browser becomes available, try to process queue
  emitter.on('browser:released', () => {
    const idleBrowser = findIdleBrowser();
    if (idleBrowser) {
      queue.processNext(idleBrowser);
    }
  });
}
