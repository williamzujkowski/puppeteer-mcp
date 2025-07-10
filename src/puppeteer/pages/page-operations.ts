/**
 * Page operation handlers
 * @module puppeteer/pages/page-operations
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page, Cookie } from 'puppeteer';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { PageInfo, ScreenshotOptions } from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';

/**
 * Get page metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export async function getPageMetrics(
  pageId: string,
  sessionId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
): Promise<Record<string, unknown>> {
  const pageInfo = await pageStore.get(pageId);
  if (pageInfo === null || pageInfo === undefined || pageInfo.sessionId !== sessionId) {
    throw new AppError('Page not found or access denied', 404);
  }

  const page = pages.get(pageId);
  if (page === null || page === undefined) {
    throw new AppError('Page instance not found', 404);
  }

  const metrics = await page.metrics();
  return metrics as Record<string, unknown>;
}

/**
 * Parameters for page operation functions
 */
export interface PageOperationParams {
  pageId: string;
  sessionId: string;
  pages: Map<string, Page>;
  pageStore: PageInfoStore;
}

/**
 * Parameters for setCookies
 */
export interface SetCookiesParams extends PageOperationParams {
  cookies: Cookie[];
}

/**
 * Set page cookies
 */
export async function setCookies(params: SetCookiesParams): Promise<void> {
  const { pageId, cookies, sessionId, pages, pageStore } = params;

  const pageInfo = await pageStore.get(pageId);
  if (pageInfo === null || pageInfo === undefined || pageInfo.sessionId !== sessionId) {
    throw new AppError('Page not found or access denied', 404);
  }

  const page = pages.get(pageId);
  if (page === null || page === undefined) {
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
  pageStore: PageInfoStore,
): Promise<Cookie[]> {
  const pageInfo = await pageStore.get(pageId);
  if (pageInfo === null || pageInfo === undefined || pageInfo.sessionId !== sessionId) {
    throw new AppError('Page not found or access denied', 404);
  }

  const page = pages.get(pageId);
  if (page === null || page === undefined) {
    throw new AppError('Page instance not found', 404);
  }

  const cookies = await page.cookies();
  return cookies;
}

/**
 * Parameters for clearPageData
 */
export interface ClearPageDataParams extends PageOperationParams {
  options:
    | {
        cookies?: boolean;
        cache?: boolean;
        localStorage?: boolean;
        sessionStorage?: boolean;
      }
    | undefined;
}

/**
 * Clear page data
 */
export async function clearPageData(params: ClearPageDataParams): Promise<void> {
  const { pageId, sessionId, options, pages, pageStore } = params;

  const pageInfo = await pageStore.get(pageId);
  if (pageInfo === null || pageInfo === undefined || pageInfo.sessionId !== sessionId) {
    throw new AppError('Page not found or access denied', 404);
  }

  const page = pages.get(pageId);
  if (page === null || page === undefined) {
    throw new AppError('Page instance not found', 404);
  }

  // Clear different types of data based on options
  await clearPageDataByType(page, options);
  await pageStore.touchActivity(pageId);
}

/**
 * Clear specific types of page data
 */
async function clearPageDataByType(
  page: Page,
  options: ClearPageDataParams['options'],
): Promise<void> {
  if (options?.cookies === true) {
    await page.deleteCookie(...(await page.cookies()));
  }

  if (options?.localStorage === true || options?.sessionStorage === true) {
    await page.evaluate((opts) => {
      if (opts?.localStorage === true) {
        window.localStorage.clear();
      }
      if (opts?.sessionStorage === true) {
        window.sessionStorage.clear();
      }
    }, options);
  }
}

/**
 * Parameters for takeScreenshot
 */
export interface TakeScreenshotParams extends PageOperationParams {
  options: ScreenshotOptions | undefined;
}

/**
 * Take screenshot
 * @nist ac-3 "Access enforcement"
 */
export async function takeScreenshot(params: TakeScreenshotParams): Promise<Buffer> {
  const { pageId, sessionId, pages, pageStore } = params;

  // Validate access
  await validatePageAccess(pageId, sessionId, pageStore);

  // Get and validate page instance
  const page = await getValidPageInstance(pageId, pages, pageStore);

  // Take screenshot with options
  const screenshot = await captureScreenshot(page, params.options);

  // Update activity
  await pageStore.touchActivity(pageId);

  return screenshot;
}

/**
 * Validate page access for security
 */
async function validatePageAccess(
  pageId: string,
  sessionId: string,
  pageStore: PageInfoStore,
): Promise<void> {
  const pageInfo = await pageStore.get(pageId);
  if (pageInfo === null || pageInfo === undefined || pageInfo.sessionId !== sessionId) {
    await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
      userId: sessionId,
      resource: `page:${pageId}`,
      result: 'failure',
      reason: 'Page does not belong to session',
    });
    throw new AppError('Unauthorized access to page', 403);
  }
}

/**
 * Get and validate page instance
 */
async function getValidPageInstance(
  pageId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
): Promise<Page> {
  const page = pages.get(pageId);
  if (!page || page.isClosed()) {
    await pageStore.delete(pageId);
    pages.delete(pageId);
    throw new AppError('Page is closed', 410);
  }
  return page;
}

/**
 * Capture screenshot with options
 */
async function captureScreenshot(
  page: Page,
  options: ScreenshotOptions | undefined,
): Promise<Buffer> {
  const screenshot = await page.screenshot({
    type: options?.type ?? 'png',
    fullPage: options?.fullPage ?? false,
    quality: options?.quality,
    clip: options?.clip,
    encoding: 'binary',
  });

  return Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
}

/**
 * Check if page is active
 */

export async function isPageActive(pageId: string, pageStore: PageInfoStore): Promise<boolean> {
  const pageInfo = await pageStore.get(pageId);
  return pageInfo?.state === 'active';
}

/**
 * Clean up idle pages
 */
export async function cleanupIdlePages(
  idleTimeout: number,
  pageStore: PageInfoStore,
): Promise<number> {
  const now = Date.now();
  const predicate = (pageInfo: PageInfo): boolean => {
    const idleTime = now - pageInfo.lastActivityAt.getTime();
    return idleTime > idleTimeout;
  };

  const cleanedCount = await pageStore.cleanup(predicate);

  return cleanedCount;
}
