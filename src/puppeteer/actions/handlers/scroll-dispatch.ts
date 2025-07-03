/**
 * Scroll action dispatcher
 * @module puppeteer/actions/handlers/scroll-dispatch
 */

import type { Page } from 'puppeteer';
import type { ScrollAction, ActionContext } from '../../interfaces/action-executor.interface.js';
import { handleScrollToElement, handleScrollWithinElement } from './scroll-element.js';
import { handleScrollPage, handleScrollToCoordinates, handleSmoothScroll } from './scroll-page.js';

/**
 * Check if action is scroll to element
 */
function isScrollToElement(action: ScrollAction): boolean {
  return action.toElement === true && action.selector !== null && action.selector !== undefined && action.selector !== '';
}

/**
 * Check if action is scroll within element
 */
function isScrollWithinElement(action: ScrollAction): boolean {
  return action.selector !== null && action.selector !== undefined && action.selector !== '' && action.toElement !== true;
}

/**
 * Check if action is scroll to coordinates
 */
function isScrollToCoordinates(action: ScrollAction): boolean {
  return action.x !== undefined && action.y !== undefined;
}

/**
 * Check if action is smooth scroll
 */
function isSmoothScroll(action: ScrollAction): boolean {
  return action.smooth === true;
}

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
  // Scroll to element
  if (isScrollToElement(action)) {
    return handleScrollToElement(action.selector!, page, context);
  }

  // Scroll within element
  if (isScrollWithinElement(action)) {
    return handleScrollWithinElement({
      selector: action.selector!,
      direction: action.direction ?? 'down',
      distance: action.distance ?? 100,
      page,
      context
    });
  }

  // Scroll to coordinates
  if (isScrollToCoordinates(action)) {
    return handleScrollToCoordinates(action.x!, action.y!, page, context);
  }

  // Smooth scroll
  if (isSmoothScroll(action)) {
    return handleSmoothScroll(action, page, context, action.duration);
  }

  // Normal page scroll
  return handleScrollPage(action, page, context);
}