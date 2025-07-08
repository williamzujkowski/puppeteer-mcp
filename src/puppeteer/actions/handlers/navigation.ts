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
  ActionContext,
} from '../../interfaces/action-executor.interface.js';
import { sanitizeUrl } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:navigation');

// Re-export navigation history handlers
export { handleGoBack, handleGoForward, handleReload } from './navigation-history.js';

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
  context: ActionContext,
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
      timeout: action.timeout ?? 30000,
      waitUntil: action.waitUntil ?? 'load',
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
