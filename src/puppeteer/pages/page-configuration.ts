/**
 * Page Configuration Utilities
 * @module puppeteer/pages/page-configuration
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import type { Page, Viewport, Cookie } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { PageOptions } from '../interfaces/page-manager.interface.js';

const logger = createLogger('page-configuration');

/**
 * Configure page options
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export async function configurePageOptions(
  page: Page,
  options: PageOptions
): Promise<void> {
  // Set viewport
  if (options.viewport) {
    await configureViewport(page, options.viewport);
  }

  // Set user agent
  if (options.userAgent) {
    await page.setUserAgent(options.userAgent);
  }

  // Set extra HTTP headers
  if (options.extraHeaders) {
    await page.setExtraHTTPHeaders(options.extraHeaders);
  }

  // Set JavaScript enabled/disabled
  if (options.javaScriptEnabled !== undefined) {
    await page.setJavaScriptEnabled(options.javaScriptEnabled);
  }

  // Set offline mode
  if (options.offline !== undefined) {
    await page.setOfflineMode(options.offline);
  }

  // Set cookies
  if (options.cookies && options.cookies.length > 0) {
    await setCookies(page, options.cookies);
  }

  // Set cache enabled/disabled
  if (options.cacheEnabled !== undefined) {
    await page.setCacheEnabled(options.cacheEnabled);
  }
}

/**
 * Configure viewport settings
 */
async function configureViewport(page: Page, viewport: Viewport): Promise<void> {
  await page.setViewport({
    width: Math.max(1, Math.min(viewport.width, 10000)),
    height: Math.max(1, Math.min(viewport.height, 10000)),
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.hasTouch ?? false,
    isLandscape: viewport.isLandscape ?? false,
  });
}

/**
 * Set cookies with validation
 */
async function setCookies(page: Page, cookies: Cookie[]): Promise<void> {
  const validCookies = cookies.filter(cookie => {
    if (!cookie.name || !cookie.value) {
      logger.warn({ cookie }, 'Invalid cookie - missing name or value');
      return false;
    }
    return true;
  });

  if (validCookies.length > 0) {
    await page.setCookie(...validCookies);
  }
}

