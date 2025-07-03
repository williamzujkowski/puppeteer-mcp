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
import type {
  PageInfo,
  PageOptions,
} from '../interfaces/page-manager.interface.js';
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
  browserId: string
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
export async function verifyContextAccess(
  contextId: string,
  sessionId: string
): Promise<void> {
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
export async function createAndConfigurePage(
  params: CreatePageParams
): Promise<PageInfo> {
  const { browserPool, browserId, pageId, pageInfo, options, pages, pageStore, emitter } = params;
  
  // Get browser instance from pool
  const browserInstance = browserPool.getBrowser(browserId);
  if (!browserInstance) {
    throw new AppError('Browser not found', 404);
  }

  // Create new page
  const page = await browserInstance.browser.newPage();

  // Configure page options
  if (options) {
    await configurePageOptions(page, options);
  }

  // Store page
  pages.set(pageId, page);
  await pageStore.create(pageInfo);

  // Set up event listeners
  configurePageEventHandlers(page, pageId, emitter);

  logger.info({
    pageId,
    contextId: pageInfo.contextId,
    sessionId: pageInfo.sessionId,
    browserId,
  }, 'Page created successfully');

  return pageInfo;
}