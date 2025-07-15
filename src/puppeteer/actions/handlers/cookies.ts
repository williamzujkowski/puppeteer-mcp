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
  ActionContext,
} from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';
import {
  handleSetCookies,
  handleGetCookies,
  handleDeleteCookies,
  handleClearCookies,
} from './cookie-operations.js';

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
/**
 * Execute cookie operation based on action type
 */
async function executeCookieOperation(
  action: CookieAction,
  page: Page,
  context: ActionContext,
): Promise<unknown> {
  switch (action.operation) {
    case 'set':
      return handleSetCookies(action, page, context);
    case 'get':
      return handleGetCookies(page, context, action.cookieName);
    case 'delete':
      return handleDeleteCookies(action, page, context);
    case 'clear':
      return handleClearCookies(page, context);
    default:
      throw new Error(`Unsupported cookie operation: ${action.operation as string}`);
  }
}

interface ActionResultParams {
  success: boolean;
  action: CookieAction;
  duration: number;
  data?: unknown;
  error?: string;
}

/**
 * Create action result object
 */
function createActionResult(params: ActionResultParams): ActionResult {
  const { success, action, duration, data, error } = params;
  return {
    success,
    actionType: 'cookie',
    ...(success ? { data } : { error }),
    duration,
    timestamp: new Date(),
    metadata: {
      operation: action.operation,
      cookieCount: action.cookies?.length ?? 0,
    },
  };
}

export async function handleCookie(
  action: CookieAction,
  page: Page,
  context: ActionContext,
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

    const result = await executeCookieOperation(action, page, context);
    const duration = Date.now() - startTime;

    logger.info('Cookie action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      operation: action.operation,
      duration,
    });

    return createActionResult({ success: true, action, duration, data: result });
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

    return createActionResult({ success: false, action, duration, error: errorMessage });
  }
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
  context: ActionContext,
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
    const filteredCookies = allCookies.filter(
      (cookie) => cookie.domain === domain || cookie.domain === `.${domain}`,
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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown get cookies by domain error';

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
