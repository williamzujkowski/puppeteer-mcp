/**
 * Cookie management action handlers for browser automation
 * @module puppeteer/actions/handlers/cookies
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page, Cookie } from 'puppeteer';
import type { 
  CookieAction,
  ActionResult, 
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:cookies');

/**
 * Handle cookie action
 * @param action - Cookie action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */
export async function handleCookie(
  action: CookieAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing cookie action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      operation: action.operation,
      cookieCount: action.cookies?.length ?? 0,
    });

    let result: unknown;

    switch (action.operation) {
      case 'set':
        result = await handleSetCookies(action, page, context);
        break;
      case 'get':
        result = await handleGetCookies(page, context);
        break;
      case 'delete':
        result = await handleDeleteCookies(action, page, context);
        break;
      case 'clear':
        result = await handleClearCookies(page, context);
        break;
      default:
        throw new Error(`Unsupported cookie operation: ${action.operation as string}`);
    }

    const duration = Date.now() - startTime;

    logger.info('Cookie action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      operation: action.operation,
      duration,
    });

    return {
      success: true,
      actionType: 'cookie',
      data: result,
      duration,
      timestamp: new Date(),
      metadata: {
        operation: action.operation,
        cookieCount: action.cookies?.length ?? 0,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown cookie error';

    logger.error('Cookie action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      operation: action.operation,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'cookie',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        operation: action.operation,
        cookieCount: action.cookies?.length ?? 0,
      },
    };
  }
}

/**
 * Handle set cookies operation
 * @param action - Cookie action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Set operation result
 */
async function handleSetCookies(
  action: CookieAction,
  page: Page,
  context: ActionContext
): Promise<{ setCookies: number }> {
  if (!action.cookies || action.cookies.length === 0) {
    throw new Error('No cookies provided for set operation');
  }

  // Validate and convert cookies
  const validatedCookies = action.cookies.map(cookie => validateCookie(cookie, page.url()));

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
async function handleGetCookies(
  page: Page,
  context: ActionContext
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
async function handleDeleteCookies(
  action: CookieAction,
  page: Page,
  context: ActionContext
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
async function handleClearCookies(
  page: Page,
  context: ActionContext
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

/**
 * Validate cookie name
 * @param name - Cookie name to validate
 * @throws Error if name is invalid
 */
function validateCookieName(name: string): void {
  if (!name || name.trim() === '') {
    throw new Error('Cookie name is required');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Invalid cookie name format');
  }

  if (name.length > 255) {
    throw new Error('Cookie name too long');
  }
}

/**
 * Validate cookie value
 * @param value - Cookie value to validate
 * @throws Error if value is invalid
 */
function validateCookieValue(value?: string): void {
  if (value && value.length > 4096) {
    throw new Error('Cookie value too long');
  }
}

/**
 * Validate and normalize cookie domain
 * @param domain - Cookie domain to validate
 * @param currentUrl - Current page URL for domain validation
 * @returns Normalized domain
 * @throws Error if domain is invalid
 */
function validateCookieDomain(domain: string | undefined, currentUrl: string): string | undefined {
  if (!domain) {
    return undefined;
  }

  // Remove leading dot if present
  const normalizedDomain = domain.replace(/^\./, '');
  
  // Validate domain format
  if (!/^[a-zA-Z0-9.-]+$/.test(normalizedDomain)) {
    throw new Error('Invalid cookie domain format');
  }

  // Check if domain is related to current URL
  const currentDomain = new URL(currentUrl).hostname;
  if (!currentDomain.endsWith(normalizedDomain) && normalizedDomain !== currentDomain) {
    throw new Error('Cookie domain does not match current page domain');
  }

  return normalizedDomain;
}

/**
 * Validate cookie path
 * @param path - Cookie path to validate
 * @throws Error if path is invalid
 */
function validateCookiePath(path?: string): void {
  if (path && (path.length > 255 || !path.startsWith('/'))) {
    throw new Error('Invalid cookie path');
  }
}

/**
 * Validate cookie expiration
 * @param expires - Cookie expiration time
 * @throws Error if expiration is invalid
 */
function validateCookieExpiration(expires?: number): void {
  if (expires !== undefined && expires < 0) {
    throw new Error('Invalid cookie expiration time');
  }
}

/**
 * Validate cookie SameSite and security settings
 * @param sameSite - SameSite attribute
 * @param secure - Secure flag
 * @throws Error if settings are invalid
 */
function validateCookieSecurity(sameSite?: 'Strict' | 'Lax' | 'None', secure?: boolean): void {
  if (sameSite && !['Strict', 'Lax', 'None'].includes(sameSite)) {
    throw new Error('Invalid SameSite value');
  }

  if (sameSite === 'None' && !secure) {
    throw new Error('SameSite=None requires Secure flag');
  }
}

/**
 * Validate cookie data for security and correctness
 * @param cookie - Cookie to validate
 * @param currentUrl - Current page URL for domain validation
 * @returns Validated cookie
 * @nist si-10 "Information input validation"
 */
function validateCookie(
  cookie: {
    name: string;
    value?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  },
  currentUrl: string
): Cookie {
  // Validate individual components
  validateCookieName(cookie.name);
  validateCookieValue(cookie.value);
  const domain = validateCookieDomain(cookie.domain, currentUrl);
  validateCookiePath(cookie.path);
  validateCookieExpiration(cookie.expires);
  validateCookieSecurity(cookie.sameSite, cookie.secure);

  // Build validated cookie object
  const result: Cookie = {
    name: cookie.name,
    value: cookie.value ?? '',
    domain: domain ?? new URL(currentUrl).hostname,
    path: cookie.path ?? '/',
    expires: cookie.expires ?? -1,
    size: (cookie.name.length + (cookie.value ?? '').length),
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? false,
    session: cookie.expires === undefined,
    sameSite: cookie.sameSite ?? 'Lax',
  };

  return result;
}

/**
 * Handle cookie filtering by domain
 * @param domain - Domain to filter by
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Filtered cookies
 */
export async function handleGetCookiesByDomain(
  domain: string,
  page: Page,
  context: ActionContext
): Promise<ActionResult<Cookie[]>> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing get cookies by domain action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      domain,
    });

    // Validate domain
    if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
      throw new Error('Invalid domain format');
    }

    // Get all cookies
    const allCookies = await page.cookies();
    
    // Filter by domain
    const filteredCookies = allCookies.filter(cookie => 
      cookie.domain === domain || cookie.domain === `.${domain}`
    );

    const duration = Date.now() - startTime;

    logger.info('Get cookies by domain action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      domain,
      totalCookies: allCookies.length,
      filteredCookies: filteredCookies.length,
      duration,
    });

    return {
      success: true,
      actionType: 'getCookiesByDomain',
      data: filteredCookies,
      duration,
      timestamp: new Date(),
      metadata: {
        domain,
        totalCookies: allCookies.length,
        filteredCookies: filteredCookies.length,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown get cookies by domain error';

    logger.error('Get cookies by domain action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      domain,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'getCookiesByDomain',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        domain,
      },
    };
  }
}