/**
 * Page Manager Method Implementations
 * @module puppeteer/pages/page-manager-methods
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { EventEmitter } from 'events';
import { AppError } from '../../core/errors/app-error.js';
import { createLogger } from '../../utils/logger.js';
import type { BrowserPool } from '../interfaces/browser-pool.interface.js';
import type {
  PageInfo,
  PageOptions,
} from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';
import {
  createPageInfo,
  verifyContextAccess,
  createAndConfigurePage,
} from './page-create-operations.js';
import { setupPageStoreHandlers } from './page-manager-events.js';

const logger = createLogger('page-manager-methods');

/**
 * Create page implementation
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 */
export async function createPageImpl(
  contextId: string,
  sessionId: string,
  browserId: string,
  options: PageOptions | undefined,
  browserPool: BrowserPool,
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
  emitter: EventEmitter,
  isShuttingDown: boolean
): Promise<PageInfo> {
  if (isShuttingDown) {
    throw new AppError('Page manager is shutting down', 503);
  }

  logger.debug({ contextId, sessionId, browserId }, 'Creating new page');

  // Verify context access
  await verifyContextAccess(contextId, sessionId);

  try {
    const pageId = `page-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const pageInfo = createPageInfo(pageId, contextId, sessionId, browserId);
    
    const result = await createAndConfigurePage(
      browserPool,
      browserId,
      pageId,
      pageInfo,
      options,
      pages,
      pageStore,
      emitter
    );

    // Get the actual page from the pages Map
    const page = pages.get(pageId);
    if (page) {
      setupPageStoreHandlers(page, pageInfo, pageStore, emitter);
    }
    
    // Emit creation event
    emitter.emit('page:created', { pageInfo });

    return result;

  } catch (error) {
    logger.error({
      contextId,
      sessionId,
      browserId,
      error,
    }, 'Failed to create page');

    throw error instanceof AppError 
      ? error 
      : new AppError('Failed to create page', 500, true, error instanceof Error ? { originalError: error.message } : undefined);
  }
}