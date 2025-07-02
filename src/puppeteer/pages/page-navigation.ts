/**
 * Page navigation handlers
 * @module puppeteer/pages/page-navigation
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import type { Page } from 'puppeteer';
import { AppError } from '../../core/errors/app-error.js';
import { createLogger } from '../../utils/logger.js';
import type { NavigationOptions } from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';

const logger = createLogger('page-navigation');

/**
 * Navigate page
 * @nist ac-3 "Access enforcement"
 */
export async function navigatePage(
  pageId: string,
  sessionId: string,
  url: string,
  options: NavigationOptions | undefined,
  pages: Map<string, Page>,
  pageStore: PageInfoStore
): Promise<void> {
  const pageInfo = await pageStore.get(pageId);
  if (!pageInfo || pageInfo.sessionId !== sessionId) {
    throw new AppError('Page not found or access denied', 404);
  }

  const page = pages.get(pageId);
  if (!page || page.isClosed()) {
    await pageStore.delete(pageId);
    pages.delete(pageId);
    throw new AppError('Page is closed', 410);
  }

  logger.debug({ pageId, url }, 'Navigating page');

  await page.goto(url, {
    waitUntil: options?.waitUntil ?? 'networkidle2',
    timeout: options?.timeout ?? 30000,
  });

  // Update activity
  await pageStore.touchActivity(pageId);
}

/**
 * Navigate to URL
 * @param pageId - Page identifier
 * @param url - Target URL
 * @param sessionId - Session identifier for validation
 * @param options - Navigation options
 * @nist ac-4 "Information flow enforcement"
 */
export async function navigateTo(
  pageId: string,
  url: string,
  sessionId: string,
  options: NavigationOptions | undefined,
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

  await pageStore.updateState(pageId, 'navigating');
  
  try {
    await page.goto(url, {
      timeout: options?.timeout ?? 30000,
      waitUntil: options?.waitUntil ?? 'load',
      referer: options?.referer,
    });
    
    const title = await page.title();
    await pageStore.updateUrl(pageId, url);
    await pageStore.updateTitle(pageId, title);
    await pageStore.addNavigationHistory(pageId, url);
    await pageStore.updateState(pageId, 'active');
    
  } catch (error) {
    await pageStore.updateState(pageId, 'active');
    await pageStore.incrementErrorCount(pageId);
    throw error;
  }
}

/**
 * Update page options
 * @param pageId - Page identifier
 * @param options - Page options to update
 * @param sessionId - Session identifier for validation
 */
export async function updatePageOptions(
  pageId: string,
  options: Partial<NavigationOptions>,
  sessionId: string,
  pages: Map<string, Page>,
  pageStore: PageInfoStore,
  configurePageOptions: (page: Page, options: any) => Promise<void>
): Promise<void> {
  const pageInfo = await pageStore.get(pageId);
  if (!pageInfo || pageInfo.sessionId !== sessionId) {
    throw new AppError('Page not found or access denied', 404);
  }

  const page = pages.get(pageId);
  if (!page) {
    throw new AppError('Page instance not found', 404);
  }

  await configurePageOptions(page, options);
  await pageStore.touchActivity(pageId);
}