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
  if (options.extraHTTPHeaders) {
    await page.setExtraHTTPHeaders(options.extraHTTPHeaders);
  }

  // Set JavaScript enabled/disabled
  if (options.javaScriptEnabled !== undefined) {
    await page.setJavaScriptEnabled(options.javaScriptEnabled);
  }

  // Set offline mode
  if (options.offline !== undefined) {
    await page.setOfflineMode(options.offline);
  }

  // Set HTTP credentials
  if (options.httpCredentials) {
    await page.authenticate(options.httpCredentials);
  }

  // Set geolocation
  if (options.geolocation) {
    await page.setGeolocation(options.geolocation);
  }

  // Set permissions
  if (options.permissions && options.permissions.length > 0) {
    const origin = page.url() || 'https://example.com';
    await page.browserContext().overridePermissions(origin, options.permissions);
  }

  // Set cookies
  if (options.cookies && options.cookies.length > 0) {
    await setCookies(page, options.cookies);
  }

  // Set cache enabled/disabled
  if (options.cacheEnabled !== undefined) {
    await page.setCacheEnabled(options.cacheEnabled);
  }

  // Configure request interception
  if (options.requestInterception) {
    await configureRequestInterception(page, options.requestInterception);
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

/**
 * Configure request interception
 */
async function configureRequestInterception(
  page: Page,
  config: NonNullable<PageOptions['requestInterception']>
): Promise<void> {
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    const url = request.url();
    
    // Check blocked patterns
    if (config.blockPatterns?.some(pattern => url.includes(pattern))) {
      void request.abort('blockedbyclient');
      return;
    }

    // Check resource types
    if (config.blockResourceTypes?.includes(request.resourceType())) {
      void request.abort('blockedbyclient');
      return;
    }

    void request.continue();
  });
}