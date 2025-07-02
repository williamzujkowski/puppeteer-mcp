/**
 * Page closure operations
 * @module puppeteer/pages/page-close-operations
 * @nist ac-12 "Session termination"
 */

import { createLogger } from '../../utils/logger.js';
import type {
  ClosePageOperationParams,
  ClosePagesForContextParams,
  ClosePagesForSessionParams
} from './page-close-types.js';
import { closePage, closeContextPages, closeSessionPages } from './page-cleanup.js';

const logger = createLogger('page-close-operations');

/**
 * Close page
 * @param params - Close page operation parameters
 * @nist ac-12 "Session termination"
 */
export async function closePageOperation(
  params: ClosePageOperationParams
): Promise<void> {
  const { pageId, sessionId, pages, pageStore, getPageInfo, emitter } = params;
  const pageInfo = await getPageInfo(pageId, sessionId);
  
  await closePage(pageId, pages, pageStore);
  
  emitter.emit('page:closed', { pageId, contextId: pageInfo.contextId });
  
  logger.info({ pageId, contextId: pageInfo.contextId }, 'Page closed');
}

/**
 * Close all pages for context
 * @param params - Close pages for context parameters
 * @nist ac-12 "Session termination"
 */
export async function closePagesForContextOperation(
  params: ClosePagesForContextParams
): Promise<void> {
  const { contextId, pages, pageStore, emitter } = params;
  const result = await closeContextPages(contextId, pages, pageStore);
  
  emitter.emit('context:pages-cleared', { 
    contextId, 
    pageCount: result.pageCount 
  });
  
  logger.info(result, 'Context pages closed');
}

/**
 * Close all pages for session
 * @param params - Close pages for session parameters
 * @nist ac-12 "Session termination"
 */
export async function closePagesForSessionOperation(
  params: ClosePagesForSessionParams
): Promise<void> {
  const { sessionId, pages, pageStore, emitter } = params;
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