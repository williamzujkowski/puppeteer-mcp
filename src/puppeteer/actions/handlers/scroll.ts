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
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

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
  context: ActionContext
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

    let result: unknown;

    if (action.toElement && action.selector) {
      // Scroll to element
      result = await handleScrollToElement(action.selector, page, context);
    } else if (action.selector) {
      // Scroll within element
      result = await handleScrollWithinElement(action, page, context);
    } else {
      // Scroll page
      result = await handleScrollPage(action, page, context);
    }

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
      metadata: {
        direction: action.direction,
        distance: action.distance,
        selector: action.selector,
        toElement: action.toElement,
      },
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

/**
 * Handle scroll to element
 * @param selector - Element selector
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Scroll result
 */
async function handleScrollToElement(
  selector: string,
  page: Page,
  context: ActionContext
): Promise<{ scrolledToElement: boolean; elementPosition: { x: number; y: number } }> {
  const sanitizedSelector = sanitizeSelector(selector);

  // Wait for element to be available
  await page.waitForSelector(sanitizedSelector, {
    timeout: 30000,
  });

  // Get element and scroll to it
  const element = await page.$(sanitizedSelector);
  if (!element) {
    throw new Error(`Element not found: ${sanitizedSelector}`);
  }

  // Get element position before scrolling
  const beforePosition = await element.boundingBox();

  // Scroll to element
  await element.scrollIntoView();

  // Wait a bit for smooth scrolling to complete
  await new Promise(resolve => setTimeout(resolve, 500));

  // Get element position after scrolling
  const afterPosition = await element.boundingBox();

  logger.info('Scrolled to element', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    selector: sanitizedSelector,
    beforePosition,
    afterPosition,
  });

  return {
    scrolledToElement: true,
    elementPosition: {
      x: afterPosition?.x || 0,
      y: afterPosition?.y || 0,
    },
  };
}

/**
 * Handle scroll within element
 * @param action - Scroll action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Scroll result
 */
async function handleScrollWithinElement(
  action: ScrollAction,
  page: Page,
  context: ActionContext
): Promise<{ scrolledDistance: number; direction: string }> {
  if (!action.selector) {
    throw new Error('Selector is required for element scrolling');
  }

  const sanitizedSelector = sanitizeSelector(action.selector);
  const direction = action.direction || 'down';
  const distance = action.distance || 100;

  // Validate distance
  if (distance < 1 || distance > 10000) {
    throw new Error('Scroll distance must be between 1 and 10000 pixels');
  }

  // Wait for element to be available
  await page.waitForSelector(sanitizedSelector, {
    timeout: 30000,
  });

  // Scroll within element
  const actualDistance = await page.$eval(
    sanitizedSelector,
    (element: any, scrollDirection: string, scrollDistance: number) => {
      const el = element;
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

/**
 * Handle page scroll
 * @param action - Scroll action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Scroll result
 */
async function handleScrollPage(
  action: ScrollAction,
  page: Page,
  context: ActionContext
): Promise<{ scrolledDistance: number; direction: string; pagePosition: { x: number; y: number } }> {
  const direction = action.direction || 'down';
  const distance = action.distance || 100;

  // Validate distance
  if (distance < 1 || distance > 10000) {
    throw new Error('Scroll distance must be between 1 and 10000 pixels');
  }

  // Get current scroll position
  const beforePosition = await page.evaluate(() => ({
    x: (globalThis as any).pageXOffset || 0,
    y: (globalThis as any).pageYOffset || 0,
  }));

  // Calculate scroll amounts
  let scrollX = 0;
  let scrollY = 0;

  switch (direction) {
    case 'up':
      scrollY = -distance;
      break;
    case 'down':
      scrollY = distance;
      break;
    case 'left':
      scrollX = -distance;
      break;
    case 'right':
      scrollX = distance;
      break;
    default:
      throw new Error(`Invalid scroll direction: ${direction}`);
  }

  // Perform scroll
  await page.evaluate((x: number, y: number) => {
    (globalThis as any).scrollBy(x, y);
  }, scrollX, scrollY);

  // Wait a bit for scrolling to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Get new scroll position
  const afterPosition = await page.evaluate(() => ({
    x: (globalThis as any).pageXOffset || 0,
    y: (globalThis as any).pageYOffset || 0,
  }));

  // Calculate actual scrolled distance
  const actualScrollX = afterPosition.x - beforePosition.x;
  const actualScrollY = afterPosition.y - beforePosition.y;
  const actualDistance = Math.abs(actualScrollX) + Math.abs(actualScrollY);

  logger.info('Scrolled page', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    direction,
    requestedDistance: distance,
    actualDistance,
    beforePosition,
    afterPosition,
  });

  return {
    scrolledDistance: actualDistance,
    direction,
    pagePosition: afterPosition,
  };
}

/**
 * Handle scroll to top of page
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 */
export async function handleScrollToTop(
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing scroll to top action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });

    // Get current position
    const beforePosition = await page.evaluate(() => ({
      x: (globalThis as any).pageXOffset || 0,
      y: (globalThis as any).pageYOffset || 0,
    }));

    // Scroll to top
    await page.evaluate(() => {
      (globalThis as any).scrollTo(0, 0);
    });

    // Wait for scrolling to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const duration = Date.now() - startTime;

    logger.info('Scroll to top action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      beforePosition,
      duration,
    });

    return {
      success: true,
      actionType: 'scrollToTop',
      data: {
        beforePosition,
        afterPosition: { x: 0, y: 0 },
      },
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown scroll to top error';

    logger.error('Scroll to top action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'scrollToTop',
      error: errorMessage,
      duration,
      timestamp: new Date(),
    };
  }
}

/**
 * Handle scroll to bottom of page
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 */
export async function handleScrollToBottom(
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing scroll to bottom action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });

    // Get current position and page height
    const beforeInfo = await page.evaluate(() => ({
      position: {
        x: (globalThis as any).pageXOffset || 0,
        y: (globalThis as any).pageYOffset || 0,
      },
      pageHeight: (globalThis as any).document?.body?.scrollHeight || 0,
      viewportHeight: (globalThis as any).innerHeight || 0,
    }));

    // Scroll to bottom
    await page.evaluate(() => {
      const doc = (globalThis as any).document;
      if (doc && doc.body) {
        (globalThis as any).scrollTo(0, doc.body.scrollHeight);
      }
    });

    // Wait for scrolling to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get final position
    const afterPosition = await page.evaluate(() => ({
      x: (globalThis as any).pageXOffset || 0,
      y: (globalThis as any).pageYOffset || 0,
    }));

    const duration = Date.now() - startTime;

    logger.info('Scroll to bottom action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      beforePosition: beforeInfo.position,
      afterPosition,
      pageHeight: beforeInfo.pageHeight,
      duration,
    });

    return {
      success: true,
      actionType: 'scrollToBottom',
      data: {
        beforePosition: beforeInfo.position,
        afterPosition,
        pageHeight: beforeInfo.pageHeight,
        viewportHeight: beforeInfo.viewportHeight,
      },
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown scroll to bottom error';

    logger.error('Scroll to bottom action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'scrollToBottom',
      error: errorMessage,
      duration,
      timestamp: new Date(),
    };
  }
}