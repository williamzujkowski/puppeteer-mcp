/**
 * Page creation operations
 * @module puppeteer/pages/page-create-operations
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 */

import type { Page } from 'puppeteer';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType, createLogger } from '../../utils/logger.js';
import { contextStore } from '../../store/context-store.js';
import type { BrowserPool } from '../interfaces/browser-pool.interface.js';
import type { PageInfo, PageOptions } from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';
import { configurePageOptions } from './page-configuration.js';
import { configurePageEventHandlers } from './page-event-handler.js';
import type { EventEmitter } from 'events';

const logger = createLogger('page-create-operations');

/**
 * Create page creation info
 */
export function createPageInfo(
  pageId: string,
  contextId: string,
  sessionId: string,
  browserId: string,
): PageInfo {
  return {
    id: pageId,
    contextId,
    sessionId,
    browserId,
    url: 'about:blank',
    title: '',
    state: 'active',
    createdAt: new Date(),
    lastActivityAt: new Date(),
    navigationHistory: [],
    errorCount: 0,
  };
}

/**
 * Verify context access
 */
export async function verifyContextAccess(contextId: string, sessionId: string): Promise<void> {
  const context = await contextStore.get(contextId);
  if (!context) {
    throw new AppError('Context not found', 404);
  }

  if (context.sessionId !== sessionId) {
    await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
      userId: sessionId,
      resource: `context:${contextId}`,
      result: 'failure',
      reason: 'Context does not belong to session',
    });
    throw new AppError('Unauthorized access to context', 403);
  }
}

/**
 * Parameters for createAndConfigurePage
 */
export interface CreatePageParams {
  browserPool: BrowserPool;
  browserId: string;
  pageId: string;
  pageInfo: PageInfo;
  options: PageOptions | undefined;
  pages: Map<string, Page>;
  pageStore: PageInfoStore;
  emitter: EventEmitter;
}

/**
 * Create and configure page
 */
export async function createAndConfigurePage(params: CreatePageParams): Promise<PageInfo> {
  const { browserPool, browserId, pageInfo, options, pages, pageStore, emitter } = params;

  // Create new page through browser pool
  const page = await browserPool.createPage(browserId, pageInfo.sessionId);

  // Configure page options
  if (options) {
    await configurePageOptions(page, options);
  }

  // Update page info with actual page details
  pageInfo.url = page.url();
  pageInfo.title = await page.title();
  pageInfo.navigationHistory = [page.url()];

  // Store page info and get the actual ID assigned by the store
  const storedPageInfo = await pageStore.create(pageInfo);

  // Use the store-assigned ID for the pages map
  pages.set(storedPageInfo.id, page);

  // Set up event listeners using the correct page ID
  configurePageEventHandlers(page, storedPageInfo.id, emitter);

  logger.info(
    {
      pageId: storedPageInfo.id,
      contextId: storedPageInfo.contextId,
      sessionId: storedPageInfo.sessionId,
      browserId,
    },
    'Page created successfully',
  );

  return storedPageInfo;
}
