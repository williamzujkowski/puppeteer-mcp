/**
 * Page operation handlers
 * @module puppeteer/pages/page-operations
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page, Cookie } from 'puppeteer';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { 
  PageInfo,
  ScreenshotOptions 
} from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';

/**
 * Get page metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export async function getPageMetrics(
  pageId: string,
  sessionId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore
): Promise<Record<string, unknown>> {
  const pageInfo = await pageStore.get(pageId);
  if (!pageInfo || pageInfo.sessionId !== sessionId) {
    throw new AppError('Page not found or access denied', 404);
  }

  const page = pages.get(pageId);
  if (!page) {
    throw new AppError('Page instance not found', 404);
  }

  const metrics = await page.metrics();
  return metrics as Record<string, unknown>;
}

/**
 * Set page cookies
 */
export async function setCookies(
  pageId: string,
  cookies: Cookie[],
  sessionId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore
): Promise<void> {
  const pageInfo = await pageStore.get(pageId);
  if (!pageInfo || pageInfo.sessionId !== sessionId) {
    throw new AppError('Page not found or access denied', 404);
  }

  const page = pages.get(pageId);
  if (!page) {
    throw new AppError('Page instance not found', 404);
  }

  await page.setCookie(...cookies);
  await pageStore.touchActivity(pageId);
}

/**
 * Get page cookies
 */
export async function getCookies(
  pageId: string,
  sessionId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore
): Promise<Cookie[]> {
  const pageInfo = await pageStore.get(pageId);
  if (!pageInfo || pageInfo.sessionId !== sessionId) {
    throw new AppError('Page not found or access denied', 404);
  }

  const page = pages.get(pageId);
  if (!page) {
    throw new AppError('Page instance not found', 404);
  }

  const cookies = await page.cookies();
  return cookies;
}

/**
 * Clear page data
 */
export async function clearPageData(
  pageId: string,
  sessionId: string,
  options: {
    cookies?: boolean;
    cache?: boolean;
    localStorage?: boolean;
    sessionStorage?: boolean;
  } | undefined,
  pages: Map<string, Page>,
  pageStore: PageInfoStore
): Promise<void> {
  const pageInfo = await pageStore.get(pageId);
  if (!pageInfo || pageInfo.sessionId !== sessionId) {
    throw new AppError('Page not found or access denied', 404);
  }

  const page = pages.get(pageId);
  if (!page) {
    throw new AppError('Page instance not found', 404);
  }

  if (options?.cookies) {
    await page.deleteCookie(...await page.cookies());
  }

  if (options?.localStorage || options?.sessionStorage) {
    await page.evaluate((opts) => {
      if (opts?.localStorage) {
        // @ts-ignore - window is available in browser context
        window.localStorage.clear();
      }
      if (opts?.sessionStorage) {
        // @ts-ignore - window is available in browser context
        window.sessionStorage.clear();
      }
    }, options);
  }

  await pageStore.touchActivity(pageId);
}

/**
 * Take screenshot
 * @nist ac-3 "Access enforcement"
 */
export async function takeScreenshot(
  pageId: string,
  sessionId: string,
  options: ScreenshotOptions | undefined,
  pages: Map<string, Page>,
  pageStore: PageInfoStore
): Promise<Buffer> {
  const pageInfo = await pageStore.get(pageId);
  if (!pageInfo || pageInfo.sessionId !== sessionId) {
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

  const screenshot = await page.screenshot({
    type: options?.type ?? 'png',
    fullPage: options?.fullPage ?? false,
    quality: options?.quality,
    clip: options?.clip,
    encoding: 'binary',
  });

  // Update activity
  await pageStore.touchActivity(pageId);

  return Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
}

/**
 * Check if page is active
 */
export async function isPageActive(
  pageId: string,
  pageStore: PageInfoStore
): Promise<boolean> {
  const pageInfo = await pageStore.get(pageId);
  return pageInfo?.state === 'active';
}

/**
 * Clean up idle pages
 */
export async function cleanupIdlePages(
  idleTimeout: number,
  pageStore: PageInfoStore
): Promise<number> {
  const now = Date.now();
  const predicate = (pageInfo: PageInfo) => {
    const idleTime = now - pageInfo.lastActivityAt.getTime();
    return idleTime > idleTimeout;
  };

  const cleanedCount = await pageStore.cleanup(predicate);
  
  return cleanedCount;
}