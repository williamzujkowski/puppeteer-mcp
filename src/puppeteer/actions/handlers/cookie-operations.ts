/**
 * Cookie operation handlers
 * @module puppeteer/actions/handlers/cookie-operations
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page, Cookie } from 'puppeteer';
import type { CookieAction, ActionContext } from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';
import { validateCookie } from './cookie-validation.js';

const logger = createLogger('puppeteer:cookie-operations');

/**
 * Handle set cookies operation
 * @param action - Cookie action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Set operation result
 */
export async function handleSetCookies(
  action: CookieAction,
  page: Page,
  context: ActionContext,
): Promise<{ setCookies: number }> {
  if (!action.cookies || action.cookies.length === 0) {
    throw new Error('No cookies provided for set operation');
  }

  // Validate and convert cookies
  const validatedCookies = action.cookies.map((cookie) => validateCookie(cookie, page.url()));

  // Set cookies
  await page.setCookie(...validatedCookies);

  logger.info('Cookies set successfully', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    cookieCount: validatedCookies.length,
  });

  return { setCookies: validatedCookies.length };
}

/**
 * Handle get cookies operation
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Current cookies
 */
export async function handleGetCookies(
  page: Page,
  context: ActionContext,
): Promise<{ cookies: Cookie[] }> {
  const cookies = await page.cookies();

  logger.info('Cookies retrieved successfully', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    cookieCount: cookies.length,
  });

  return { cookies };
}

/**
 * Handle delete cookies operation
 * @param action - Cookie action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Delete operation result
 */
export async function handleDeleteCookies(
  action: CookieAction,
  page: Page,
  context: ActionContext,
): Promise<{ deletedCookies: number }> {
  if (!action.cookies || action.cookies.length === 0) {
    throw new Error('No cookies provided for delete operation');
  }

  let deletedCount = 0;

  for (const cookie of action.cookies) {
    if (!cookie.name) {
      throw new Error('Cookie name is required for delete operation');
    }

    try {
      await page.deleteCookie({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
      });
      deletedCount++;
    } catch (error) {
      logger.warn('Failed to delete cookie', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        cookieName: cookie.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('Cookies deleted successfully', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    deletedCount,
    requestedCount: action.cookies.length,
  });

  return { deletedCookies: deletedCount };
}

/**
 * Handle clear all cookies operation
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Clear operation result
 */
export async function handleClearCookies(
  page: Page,
  context: ActionContext,
): Promise<{ clearedCookies: number }> {
  // Get current cookies to count them
  const currentCookies = await page.cookies();
  const cookieCount = currentCookies.length;

  // Clear all cookies
  const client = await page.target().createCDPSession();
  await client.send('Network.clearBrowserCookies');

  logger.info('All cookies cleared successfully', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    clearedCount: cookieCount,
  });

  return { clearedCookies: cookieCount };
}
