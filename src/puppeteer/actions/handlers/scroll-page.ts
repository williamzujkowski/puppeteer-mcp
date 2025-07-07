/**
 * Page scroll handlers for browser automation
 * @module puppeteer/actions/handlers/scroll-page
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { 
  ScrollAction,
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { calculateScrollValues, calculateTargetPosition, validateScrollParams } from './scroll-helpers.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:scroll-page');

/**
 * Handle page scroll
 * @param action - Scroll action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Scroll result
 */
export async function handleScrollPage(
  action: ScrollAction,
  page: Page,
  context: ActionContext
): Promise<{ scrolledDistance: number; direction: string; pagePosition: { x: number; y: number } }> {
  const direction = action.direction ?? 'down';
  const distance = action.distance ?? 100;

  // Validate distance
  validateScrollParams(distance);

  // Get current scroll position
   
  const beforePosition = await page.evaluate(() => ({
    x: globalThis.pageXOffset ?? 0,
    y: globalThis.pageYOffset ?? 0,
  }));

  // Calculate scroll amounts
  const { scrollX, scrollY } = calculateScrollValues(direction, distance);

  // Perform scroll
  await page.evaluate((x: number, y: number) => {
    globalThis.scrollBy(x, y);
  }, scrollX, scrollY);

  // Get new scroll position
   
  const afterPosition = await page.evaluate(() => ({
    x: globalThis.pageXOffset ?? 0,
    y: globalThis.pageYOffset ?? 0,
  }));

  // Calculate actual scrolled distance
  const actualDistance = Math.abs(afterPosition.x - beforePosition.x) + 
                       Math.abs(afterPosition.y - beforePosition.y);

  logger.info('Page scrolled', {
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
 * Handle scroll to coordinates
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Scroll result
 */
export async function handleScrollToCoordinates(
  x: number,
  y: number,
  page: Page,
  context: ActionContext
): Promise<{ scrolledToPosition: { x: number; y: number }; scrollDistance: number }> {
  // Validate coordinates
  if (x < 0 || y < 0 || x > 100000 || y > 100000) {
    throw new Error('Invalid scroll coordinates');
  }

  // Get current position
  const beforePosition = await page.evaluate(() => ({
    x: globalThis.pageXOffset ?? 0,
    y: globalThis.pageYOffset ?? 0,
  }));

  // Scroll to position
  await page.evaluate((targetX: number, targetY: number) => {
    globalThis.scrollTo(targetX, targetY);
  }, x, y);

  // Get new position
  const afterPosition = await page.evaluate(() => ({
    x: globalThis.pageXOffset ?? 0,
    y: globalThis.pageYOffset ?? 0,
  }));

  // Calculate distance scrolled
  const scrollDistance = Math.abs(afterPosition.x - beforePosition.x) + 
                        Math.abs(afterPosition.y - beforePosition.y);

  logger.info('Scrolled to coordinates', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    targetPosition: { x, y },
    actualPosition: afterPosition,
    scrollDistance,
  });

  return {
    scrolledToPosition: afterPosition,
    scrollDistance,
  };
}

/**
 * Handle smooth scroll
 * @param action - Scroll action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param duration - Animation duration in milliseconds
 * @returns Scroll result
 */
export async function handleSmoothScroll(
  action: ScrollAction,
  page: Page,
  context: ActionContext,
  duration: number = 500
): Promise<{ scrolledDistance: number; duration: number }> {
  const direction = action.direction ?? 'down';
  const distance = action.distance ?? 100;

  // Validate parameters
  validateScrollParams(distance, duration);

  const startTime = Date.now();

  // Get current position
  const startPosition = await page.evaluate(() => ({
    x: globalThis.pageXOffset ?? 0,
    y: globalThis.pageYOffset ?? 0,
  }));

  // Calculate target position
  const { targetX, targetY } = calculateTargetPosition(
    startPosition.x,
    startPosition.y,
    direction,
    distance
  );

  // Perform smooth scroll
  await page.evaluate(
    (tX: number, tY: number, dur: number) => {
      return new Promise<void>((resolve) => {
        const startX = globalThis.pageXOffset ?? 0;
        const startY = globalThis.pageYOffset ?? 0;
        const distanceX = tX - startX;
        const distanceY = tY - startY;
        const startTime = performance.now();

        function scrollStep(currentTime: number): void {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / dur, 1);
          
          // Easing function for smooth animation
          const easeProgress = progress < 0.5
            ? 2 * progress * progress
            : -1 + (4 - 2 * progress) * progress;

          const currentX = startX + distanceX * easeProgress;
          const currentY = startY + distanceY * easeProgress;

          globalThis.scrollTo(currentX, currentY);

          if (progress < 1) {
            globalThis.requestAnimationFrame(scrollStep);
          } else {
            resolve();
          }
        }

        globalThis.requestAnimationFrame(scrollStep);
      });
    },
    targetX,
    targetY,
    duration
  );

  // Get final position
  const endPosition = await page.evaluate(() => ({
    x: globalThis.pageXOffset ?? 0,
    y: globalThis.pageYOffset ?? 0,
  }));

  const actualDistance = Math.abs(endPosition.x - startPosition.x) + 
                        Math.abs(endPosition.y - startPosition.y);
  const actualDuration = Date.now() - startTime;

  logger.info('Smooth scroll completed', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    direction,
    requestedDistance: distance,
    actualDistance,
    duration: actualDuration,
  });

  return {
    scrolledDistance: actualDistance,
    duration: actualDuration,
  };
}