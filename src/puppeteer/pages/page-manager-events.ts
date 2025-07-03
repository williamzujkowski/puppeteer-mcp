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
  emitter.on('page:navigated', ({ pageId: navPageId, url }) => {
    if (navPageId === pageId) {
      void page.title().then(title => {
        void pageStore.updateUrl(pageId, url);
        void pageStore.updateTitle(pageId, title);
        void pageStore.addNavigationHistory(pageId, url);
        void pageStore.touchActivity(pageId);
      }).catch(() => {
        // If title fails, still update other fields
        void pageStore.updateUrl(pageId, url);
        void pageStore.addNavigationHistory(pageId, url);
        void pageStore.touchActivity(pageId);
      });
    }
  });

  // Update error count
  emitter.on('page:error', ({ pageId: errorPageId }) => {
    if (errorPageId === pageId) {
      void pageStore.incrementErrorCount(pageId);
      void pageStore.touchActivity(pageId);
    }
  });
}