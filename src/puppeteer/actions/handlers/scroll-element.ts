/**
 * Element scroll handlers for browser automation
 * @module puppeteer/actions/handlers/scroll-element
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { ActionContext } from '../../interfaces/action-executor.interface.js';
import type { ScrollWithinElementParams } from './scroll-element-types.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:scroll-element');

/**
 * Handle scroll to element
 * @param selector - CSS selector
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Scroll result
 */
export async function handleScrollToElement(
  selector: string,
  page: Page,
  context: ActionContext
): Promise<{ scrolledToElement: string; elementPosition?: { x: number; y: number } }> {
  const sanitizedSelector = sanitizeSelector(selector);

  // Check if element exists
  const elementExists = await page.evaluate((sel: string) => {
    return (globalThis as any).document.querySelector(sel) !== null;
  }, sanitizedSelector);

  if (!elementExists) {
    throw new Error(`Element not found: ${sanitizedSelector}`);
  }

  // Scroll to element
  const elementPosition = await page.evaluate((sel: string) => {
    const element = (globalThis as any).document.querySelector(sel);
    if (!element) {
      throw new Error('Element not found');
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + ((globalThis as any).pageXOffset ?? 0),
      y: rect.top + ((globalThis as any).pageYOffset ?? 0),
    };
  }, sanitizedSelector);

  logger.info('Scrolled to element', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    selector: sanitizedSelector,
    elementPosition,
  });

  return {
    scrolledToElement: sanitizedSelector,
    elementPosition,
  };
}

/**
 * Handle scroll within element
 * @param params - Scroll within element parameters
 * @returns Scroll result
 */
export async function handleScrollWithinElement(
  params: ScrollWithinElementParams
): Promise<{ scrolledDistance: number; direction: string }> {
  const { selector, direction, distance, page, context } = params;
  const sanitizedSelector = sanitizeSelector(selector);

  // Validate distance
  if (distance < 1 || distance > 10000) {
    throw new Error('Scroll distance must be between 1 and 10000 pixels');
  }

  // Check if element exists
  const elementExists = await page.evaluate((sel: string) => {
    return (globalThis as any).document.querySelector(sel) !== null;
  }, sanitizedSelector);

  if (!elementExists) {
    throw new Error(`Element not found: ${sanitizedSelector}`);
  }

  // Scroll within the element
  const actualDistance = await page.evaluate(
    (sel: string, scrollDirection: string, scrollDistance: number) => {
      const el = (globalThis as any).document.querySelector(sel);
      if (el === null || el === undefined || !(el instanceof (globalThis as any).HTMLElement)) {
        throw new Error('Element not found or not scrollable');
      }

      let scrollX = 0;
      let scrollY = 0;

      switch (scrollDirection) {
        case 'up':
          scrollY = -scrollDistance;
          break;
        case 'down':
          scrollY = scrollDistance;
          break;
        case 'left':
          scrollX = -scrollDistance;
          break;
        case 'right':
          scrollX = scrollDistance;
          break;
        default:
          throw new Error(`Invalid scroll direction: ${scrollDirection}`);
      }

      const beforeScrollTop = el.scrollTop;
      const beforeScrollLeft = el.scrollLeft;

      el.scrollBy(scrollX, scrollY);

      const afterScrollTop = el.scrollTop;
      const afterScrollLeft = el.scrollLeft;

      const actualX = afterScrollLeft - beforeScrollLeft;
      const actualY = afterScrollTop - beforeScrollTop;

      return Math.abs(actualX) + Math.abs(actualY);
    },
    sanitizedSelector,
    direction,
    distance
  );

  logger.info('Scrolled within element', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    selector: sanitizedSelector,
    direction,
    requestedDistance: distance,
    actualDistance,
  });

  return {
    scrolledDistance: actualDistance,
    direction,
  };
}