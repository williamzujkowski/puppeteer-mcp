/**
 * Page Cleanup Utilities
 * @module puppeteer/pages/page-cleanup
 * @nist ac-12 "Session termination"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { PageInfoStore } from './page-info-store.js';
import type { PageInfo } from '../interfaces/page-manager.interface.js';
import { removePageEventHandlers } from './page-event-handler.js';

const logger = createLogger('page-cleanup');

/**
 * Page cleanup result
 */
export interface CleanupResult {
  contextId: string;
  pageCount: number;
  errors: Array<{ pageId: string; error: string }>;
}

/**
 * Close all pages for a context
 * @nist ac-12 "Session termination"
 */
export async function closeContextPages(
  contextId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore
): Promise<CleanupResult> {
  logger.info({ contextId }, 'Closing all pages for context');

  const contextPages = await pageStore.listByContext(contextId);
  const errors: Array<{ pageId: string; error: string }> = [];
  let closedCount = 0;

  for (const pageInfo of contextPages) {
    try {
      await closePage(pageInfo.id, pages, pageStore);
      closedCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        contextId,
        pageId: pageInfo.id,
        error: errorMessage,
      }, 'Failed to close page');
      errors.push({ pageId: pageInfo.id, error: errorMessage });
    }
  }

  return {
    contextId,
    pageCount: closedCount,
    errors,
  };
}

/**
 * Close all pages for a session
 * @nist ac-12 "Session termination"
 */
export async function closeSessionPages(
  sessionId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore
): Promise<Map<string, CleanupResult>> {
  logger.info({ sessionId }, 'Closing all pages for session');

  const sessionPages = await pageStore.listBySession(sessionId);
  const resultsByContext = new Map<string, CleanupResult>();

  // Group pages by context
  const pagesByContext = new Map<string, PageInfo[]>();
  for (const pageInfo of sessionPages) {
    const contextPages = pagesByContext.get(pageInfo.contextId) ?? [];
    contextPages.push(pageInfo);
    pagesByContext.set(pageInfo.contextId, contextPages);
  }

  // Close pages by context
  for (const [contextId, contextPages] of pagesByContext) {
    const errors: Array<{ pageId: string; error: string }> = [];
    let closedCount = 0;

    for (const pageInfo of contextPages) {
      try {
        await closePage(pageInfo.id, pages, pageStore);
        closedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ pageId: pageInfo.id, error: errorMessage });
      }
    }

    resultsByContext.set(contextId, {
      contextId,
      pageCount: closedCount,
      errors,
    });
  }

  return resultsByContext;
}

/**
 * Close a single page
 * @nist ac-12 "Session termination"
 */
export async function closePage(
  pageId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore
): Promise<void> {
  const page = pages.get(pageId);
  if (!page) {
    await pageStore.delete(pageId);
    return;
  }

  try {
    // Remove event handlers first
    removePageEventHandlers(page);

    // Close the page
    if (!page.isClosed()) {
      await page.close();
    }
  } finally {
    // Always clean up from stores
    pages.delete(pageId);
    await pageStore.delete(pageId);
  }
}

/**
 * Perform periodic cleanup of orphaned pages
 * @nist ac-12 "Session termination"
 */
export async function performPeriodicCleanup(
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
  maxIdleTime: number = 30 * 60 * 1000 // 30 minutes
): Promise<number> {
  const now = Date.now();
  const allPages = await pageStore.listAll();
  let cleanedCount = 0;

  for (const pageInfo of allPages) {
    // Check if page is idle too long
    const idleTime = now - pageInfo.lastActivityAt.getTime();
    if (idleTime > maxIdleTime) {
      try {
        await closePage(pageInfo.id, pages, pageStore);
        cleanedCount++;
        logger.info({
          pageId: pageInfo.id,
          idleTime,
        }, 'Cleaned up idle page');
      } catch (error) {
        logger.error({
          pageId: pageInfo.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to clean up idle page');
      }
    }
  }

  return cleanedCount;
}