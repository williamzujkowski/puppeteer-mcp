/**
 * Scroll action dispatcher
 * @module puppeteer/actions/handlers/scroll-dispatch
 */

import type { Page } from 'puppeteer';
import type { ScrollAction, ActionContext } from '../../interfaces/action-executor.interface.js';
import { handleScrollToElement, handleScrollWithinElement } from './scroll-element.js';
import { handleScrollPage, handleScrollToCoordinates, handleSmoothScroll } from './scroll-page.js';

/**
 * Dispatch scroll action to appropriate handler
 * @param action - Scroll action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Scroll result
 */
// eslint-disable-next-line @typescript-eslint/require-await, require-await
export async function dispatchScrollAction(
  action: ScrollAction,
  page: Page,
  context: ActionContext
): Promise<unknown> {
  if (action.toElement && action.selector) {
    // Scroll to element
    return handleScrollToElement(action.selector, page, context);
  }

  if (action.selector) {
    // Scroll within element
    return handleScrollWithinElement({
      selector: action.selector,
      direction: action.direction ?? 'down',
      distance: action.distance ?? 100,
      page,
      context
    });
  }

  if (action.x !== undefined && action.y !== undefined) {
    // Scroll to coordinates
    return handleScrollToCoordinates(action.x, action.y, page, context);
  }

  if (action.smooth) {
    // Smooth scroll
    return handleSmoothScroll(action, page, context, action.duration);
  }

  // Normal page scroll
  return handleScrollPage(action, page, context);
}