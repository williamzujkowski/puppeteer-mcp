/**
 * Scroll action handlers for browser automation
 * @module puppeteer/actions/handlers/scroll
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  ScrollAction,
  ActionResult,
  ActionContext,
} from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';
import { dispatchScrollAction } from './scroll-dispatch.js';

const logger = createLogger('puppeteer:scroll');

/**
 * Handle scroll action
 * @param action - Scroll action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */
export async function handleScroll(
  action: ScrollAction,
  page: Page,
  context: ActionContext,
): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    logger.info('Executing scroll action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      direction: action.direction,
      distance: action.distance,
      selector: action.selector,
      toElement: action.toElement,
    });

    const result = await dispatchScrollAction(action, page, context);

    const duration = Date.now() - startTime;

    logger.info('Scroll action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      duration,
    });

    return {
      success: true,
      actionType: 'scroll',
      data: result,
      duration,
      timestamp: new Date(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown scroll error';

    logger.error('Scroll action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'scroll',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        direction: action.direction,
        distance: action.distance,
        selector: action.selector,
        toElement: action.toElement,
      },
    };
  }
}

// Re-export handlers from separate modules
export { handleScrollToElement, handleScrollWithinElement } from './scroll-element.js';
export { handleScrollPage, handleScrollToCoordinates, handleSmoothScroll } from './scroll-page.js';
