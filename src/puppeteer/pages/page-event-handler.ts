/**
 * Page Event Handling for Page Manager
 * @module puppeteer/pages/page-event-handler
 * @nist au-3 "Content of audit records"
 * @nist au-12 "Audit generation"
 */

import type { Page } from 'puppeteer';
import type { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger.js';
import type { PageInfo } from '../interfaces/page-manager.interface.js';

const logger = createLogger('page-event-handler');

/**
 * Page lifecycle events
 */
export interface PageEvents {
  'page:created': { pageInfo: PageInfo };
  'page:navigated': { pageId: string; url: string };
  'page:closed': { pageId: string; contextId: string };
  'page:error': { pageId: string; error: Error };
  'page:state-changed': { pageId: string; state: PageInfo['state'] };
  'context:pages-cleared': { contextId: string; pageCount: number };
  'session:pages-cleared': { sessionId: string; pageCount: number };
}

/**
 * Configure page event handlers
 * @nist au-3 "Content of audit records"
 */
export function configurePageEventHandlers(
  page: Page,
  pageId: string,
  emitter: EventEmitter,
): void {
  // Page navigation
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      const url = frame.url();
      logger.debug({ pageId, url }, 'Page navigated');
      emitter.emit('page:navigated', { pageId, url });
    }
  });

  // Page errors
  page.on('pageerror', (error) => {
    logger.error({ pageId, error: error.message }, 'Page error occurred');
    emitter.emit('page:error', { pageId, error });
  });

  // Console messages
  page.on('console', (msg) => {
    logger.debug(
      {
        pageId,
        type: msg.type(),
        text: msg.text(),
      },
      'Page console message',
    );
  });

  // Page crashes
  page.on('error', (error) => {
    logger.error({ pageId, error: error.message }, 'Page crashed');
    emitter.emit('page:error', { pageId, error });
  });

  // Request failures
  page.on('requestfailed', (request) => {
    logger.warn(
      {
        pageId,
        url: request.url(),
        error: request.failure()?.errorText,
      },
      'Page request failed',
    );
  });
}

/**
 * Remove all page event listeners
 */
export function removePageEventHandlers(page: Page): void {
  page.removeAllListeners();
}
