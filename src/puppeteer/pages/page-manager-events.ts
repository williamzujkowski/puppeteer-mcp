/**
 * Page manager event handling setup
 * @module puppeteer/pages/page-manager-events
 */

import type { Page } from 'puppeteer';
import type { EventEmitter } from 'events';
import type { PageInfo } from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';

/**
 * Set up page store event handlers
 */
export function setupPageStoreHandlers(
  page: Page,
  pageInfo: PageInfo,
  pageStore: PageInfoStore,
  emitter: EventEmitter
): void {
  const pageId = pageInfo.id;

  // Update store on navigation
  emitter.on('page:navigated', async ({ pageId: navPageId, url }) => {
    if (navPageId === pageId) {
      const title = await page.title().catch(() => '');
      await pageStore.updateUrl(pageId, url);
      await pageStore.updateTitle(pageId, title);
      await pageStore.addNavigationHistory(pageId, url);
      await pageStore.touchActivity(pageId);
    }
  });

  // Update error count
  emitter.on('page:error', async ({ pageId: errorPageId }) => {
    if (errorPageId === pageId) {
      await pageStore.incrementErrorCount(pageId);
      await pageStore.touchActivity(pageId);
    }
  });
}