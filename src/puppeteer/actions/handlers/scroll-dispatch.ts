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
  return (
    action.toElement === true &&
    action.selector !== null &&
    action.selector !== undefined &&
    action.selector !== ''
  );
}

/**
 * Check if action is scroll within element
 */
function isScrollWithinElement(action: ScrollAction): boolean {
  return (
    action.selector !== null &&
    action.selector !== undefined &&
    action.selector !== '' &&
    action.toElement !== true
  );
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
 * Handle scroll to element action
 */
function executeScrollToElement(
  action: ScrollAction,
  page: Page,
  context: ActionContext,
): Promise<unknown> {
  if (!action.selector) {
    throw new Error('Selector is required for scroll to element');
  }
  return handleScrollToElement(action.selector, page, context);
}

/**
 * Handle scroll within element action
 */
function executeScrollWithinElement(
  action: ScrollAction,
  page: Page,
  context: ActionContext,
): Promise<unknown> {
  if (!action.selector) {
    throw new Error('Selector is required for scroll within element');
  }
  return handleScrollWithinElement({
    selector: action.selector,
    direction: action.direction ?? 'down',
    distance: action.distance ?? 100,
    page,
    context,
  });
}

/**
 * Handle scroll to coordinates action
 */
function executeScrollToCoordinates(
  action: ScrollAction,
  page: Page,
  context: ActionContext,
): Promise<unknown> {
  if (action.x === undefined || action.y === undefined) {
    throw new Error('Both x and y coordinates are required');
  }
  return handleScrollToCoordinates(action.x, action.y, page, context);
}

/**
 * Dispatch scroll action to appropriate handler
 * @param action - Scroll action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Scroll result
 */
export function dispatchScrollAction(
  action: ScrollAction,
  page: Page,
  context: ActionContext,
): Promise<unknown> {
  // Scroll to element
  if (isScrollToElement(action)) {
    return executeScrollToElement(action, page, context);
  }

  // Scroll within element
  if (isScrollWithinElement(action)) {
    return executeScrollWithinElement(action, page, context);
  }

  // Scroll to coordinates
  if (isScrollToCoordinates(action)) {
    return executeScrollToCoordinates(action, page, context);
  }

  // Smooth scroll
  if (isSmoothScroll(action)) {
    return handleSmoothScroll(action, page, context, action.duration);
  }

  // Default: Normal page scroll
  return handleScrollPage(action, page, context);
}
