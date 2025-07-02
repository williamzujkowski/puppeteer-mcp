/**
 * Page Manager Initialization Module
 * @module puppeteer/pages/page-manager-init
 * @nist ac-3 "Access enforcement"
 * @nist sc-2 "Application partitioning"
 */

import type { EventEmitter } from 'events';
import type { Page } from 'puppeteer';
import type { BrowserPool } from '../interfaces/browser-pool.interface.js';
import { pageInfoStore, type PageInfoStore } from './page-info-store.js';
import { initializeCleanupInterval } from './page-manager-lifecycle.js';

/**
 * Page manager initialization result
 */
export interface PageManagerInit {
  browserPool: BrowserPool;
  pageStore: PageInfoStore;
  pages: Map<string, Page>;
  cleanupInterval?: NodeJS.Timeout;
  isShuttingDown: boolean;
}

/**
 * Initialize page manager properties
 * @param browserPool - Browser pool instance
 * @param pageStore - Optional page store instance
 * @param emitter - Event emitter instance
 * @param performCleanup - Cleanup function
 * @returns Initialized properties
 */
export function initializePageManager(
  browserPool: BrowserPool,
  pageStore: PageInfoStore | undefined,
  emitter: EventEmitter,
  performCleanup: () => Promise<void>
): PageManagerInit {
  // Initialize base properties
  const init: PageManagerInit = {
    browserPool,
    pageStore: pageStore ?? pageInfoStore,
    pages: new Map<string, Page>(),
    isShuttingDown: false,
  };

  // Start periodic cleanup
  init.cleanupInterval = initializeCleanupInterval(performCleanup);

  return init;
}