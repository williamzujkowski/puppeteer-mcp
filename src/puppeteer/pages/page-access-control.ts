/**
 * Page access control functions
 * @module puppeteer/pages/page-access-control
 * @nist ac-3 "Access enforcement"
 */

import type { Page } from 'puppeteer';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { PageInfo } from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';

/**
 * Get page by ID with access control
 * @nist ac-3 "Access enforcement"
 */
export async function getPageWithAccessControl(
  pageId: string,
  sessionId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
): Promise<Page> {
  const pageInfo = await pageStore.get(pageId);
  if (!pageInfo) {
    throw new AppError('Page not found', 404);
  }

  if (pageInfo.sessionId !== sessionId) {
    await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
      userId: sessionId,
      resource: `page:${pageId}`,
      result: 'failure',
      reason: 'Page does not belong to session',
    });
    throw new AppError('Unauthorized access to page', 403);
  }

  const page = pages.get(pageId);
  if (!page || page.isClosed()) {
    await pageStore.delete(pageId);
    pages.delete(pageId);
    throw new AppError('Page is closed', 410);
  }

  // Update activity
  await pageStore.touchActivity(pageId);

  return page;
}

/**
 * Get page info with access control
 * @nist ac-3 "Access enforcement"
 */
export async function getPageInfoWithAccessControl(
  pageId: string,
  sessionId: string,
  pageStore: PageInfoStore,
): Promise<PageInfo> {
  const pageInfo = await pageStore.get(pageId);
  if (!pageInfo) {
    throw new AppError('Page not found', 404);
  }

  if (pageInfo.sessionId !== sessionId) {
    await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
      userId: sessionId,
      resource: `page:${pageId}`,
      result: 'failure',
      reason: 'Page does not belong to session',
    });
    throw new AppError('Unauthorized access to page', 403);
  }

  return pageInfo;
}
