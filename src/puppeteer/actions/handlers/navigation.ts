/**
 * Navigation action handlers for browser automation
 * @module puppeteer/actions/handlers/navigation
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { 
  NavigateAction, 
  ActionResult, 
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { sanitizeUrl } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:navigation');

/**
 * Handle navigation action
 * @param action - Navigate action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */
export async function handleNavigate(
  action: NavigateAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing navigate action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      url: action.url,
      waitUntil: action.waitUntil,
    });

    // Sanitize URL for security
    const sanitizedUrl = sanitizeUrl(action.url);

    // Navigate to URL with optional wait condition
    const response = await page.goto(sanitizedUrl, {
      timeout: action.timeout || 30000,
      waitUntil: action.waitUntil || 'load',
    });

    const duration = Date.now() - startTime;

    if (!response) {
      return {
        success: false,
        actionType: 'navigate',
        error: 'Failed to navigate - no response received',
        duration,
        timestamp: new Date(),
      };
    }

    // Check if navigation was successful
    const status = response.status();
    const success = status >= 200 && status < 400;

    logger.info('Navigate action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      url: sanitizedUrl,
      status,
      success,
      duration,
    });

    return {
      success,
      actionType: 'navigate',
      data: {
        url: sanitizedUrl,
        status,
        statusText: response.statusText(),
        finalUrl: page.url(),
        headers: response.headers(),
      },
      duration,
      timestamp: new Date(),
      metadata: {
        originalUrl: action.url,
        waitUntil: action.waitUntil,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown navigation error';

    logger.error('Navigate action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      url: action.url,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'navigate',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        originalUrl: action.url,
        waitUntil: action.waitUntil,
      },
    };
  }
}

/**
 * Handle go back action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param timeout - Optional timeout
 * @returns Action result
 * @nist au-3 "Content of audit records"
 */
export async function handleGoBack(
  page: Page,
  context: ActionContext,
  timeout?: number
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing go back action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });

    const response = await page.goBack({
      timeout: timeout || 30000,
      waitUntil: 'load',
    });

    const duration = Date.now() - startTime;

    if (!response) {
      return {
        success: false,
        actionType: 'goBack',
        error: 'No previous page to go back to',
        duration,
        timestamp: new Date(),
      };
    }

    logger.info('Go back action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      finalUrl: page.url(),
      duration,
    });

    return {
      success: true,
      actionType: 'goBack',
      data: {
        url: page.url(),
        status: response.status(),
        statusText: response.statusText(),
      },
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown go back error';

    logger.error('Go back action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'goBack',
      error: errorMessage,
      duration,
      timestamp: new Date(),
    };
  }
}

/**
 * Handle go forward action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param timeout - Optional timeout
 * @returns Action result
 * @nist au-3 "Content of audit records"
 */
export async function handleGoForward(
  page: Page,
  context: ActionContext,
  timeout?: number
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing go forward action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });

    const response = await page.goForward({
      timeout: timeout || 30000,
      waitUntil: 'load',
    });

    const duration = Date.now() - startTime;

    if (!response) {
      return {
        success: false,
        actionType: 'goForward',
        error: 'No next page to go forward to',
        duration,
        timestamp: new Date(),
      };
    }

    logger.info('Go forward action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      finalUrl: page.url(),
      duration,
    });

    return {
      success: true,
      actionType: 'goForward',
      data: {
        url: page.url(),
        status: response.status(),
        statusText: response.statusText(),
      },
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown go forward error';

    logger.error('Go forward action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'goForward',
      error: errorMessage,
      duration,
      timestamp: new Date(),
    };
  }
}

/**
 * Handle reload action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param timeout - Optional timeout
 * @returns Action result
 * @nist au-3 "Content of audit records"
 */
export async function handleReload(
  page: Page,
  context: ActionContext,
  timeout?: number
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing reload action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      currentUrl: page.url(),
    });

    const response = await page.reload({
      timeout: timeout || 30000,
      waitUntil: 'load',
    });

    const duration = Date.now() - startTime;

    logger.info('Reload action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      url: page.url(),
      status: response?.status(),
      duration,
    });

    return {
      success: true,
      actionType: 'reload',
      data: {
        url: page.url(),
        status: response?.status(),
        statusText: response?.statusText(),
      },
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown reload error';

    logger.error('Reload action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'reload',
      error: errorMessage,
      duration,
      timestamp: new Date(),
    };
  }
}