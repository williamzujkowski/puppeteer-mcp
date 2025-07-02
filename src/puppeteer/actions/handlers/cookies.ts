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