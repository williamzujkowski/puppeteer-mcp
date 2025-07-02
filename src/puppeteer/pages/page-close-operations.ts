/**
 * Page closure operations
 * @module puppeteer/pages/page-close-operations
 * @nist ac-12 "Session termination"
 */

import type { Page } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { PageInfo } from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';
import { closePage, closeContextPages, closeSessionPages } from './page-cleanup.js';
import type { EventEmitter } from 'events';

const logger = createLogger('page-close-operations');

/**
 * Close page
 * @nist ac-12 "Session termination"
 */
export async function closePageOperation(
  pageId: string,
  sessionId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
  getPageInfo: (pageId: string, sessionId: string) => Promise<PageInfo>,
  emitter: EventEmitter
): Promise<void> {
  const pageInfo = await getPageInfo(pageId, sessionId);
  
  await closePage(pageId, pages, pageStore);
  
  emitter.emit('page:closed', { pageId, contextId: pageInfo.contextId });
  
  logger.info({ pageId, contextId: pageInfo.contextId }, 'Page closed');
}

/**
 * Close all pages for context
 * @nist ac-12 "Session termination"
 */
export async function closePagesForContextOperation(
  contextId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
  emitter: EventEmitter
): Promise<void> {
  const result = await closeContextPages(contextId, pages, pageStore);
  
  emitter.emit('context:pages-cleared', { 
    contextId, 
    pageCount: result.pageCount 
  });
  
  logger.info(result, 'Context pages closed');
}

/**
 * Close all pages for session
 * @nist ac-12 "Session termination"
 */
export async function closePagesForSessionOperation(
  sessionId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
  emitter: EventEmitter
): Promise<void> {
  const results = await closeSessionPages(sessionId, pages, pageStore);
  
  let totalPages = 0;
  for (const result of results.values()) {
    totalPages += result.pageCount;
  }
  
  emitter.emit('session:pages-cleared', { 
    sessionId, 
    pageCount: totalPages 
  });
  
  logger.info({ sessionId, totalPages }, 'Session pages closed');
}