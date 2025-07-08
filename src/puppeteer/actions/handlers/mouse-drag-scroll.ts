/**
 * Mouse drag and scroll action handlers
 * @module puppeteer/actions/handlers/mouse-drag-scroll
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:mouse-drag-scroll');

/**
 * Parameters for mouse drag action
 */
interface MouseDragParams {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  page: Page;
  context: ActionContext;
  steps?: number;
}

/**
 * Parameters for mouse scroll action
 */
interface MouseScrollParams {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  page: Page;
  context: ActionContext;
}

/**
 * Handle mouse drag action
 * @param params - Mouse drag parameters
 * @returns Action result
 */
export async function handleMouseDrag(params: MouseDragParams): Promise<ActionResult> {
  const { fromX, fromY, toX, toY, page, context, steps = 10 } = params;
  const startTime = Date.now();

  try {
    logger.info('Executing mouse drag action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      fromX,
      fromY,
      toX,
      toY,
      steps,
    });

    // Validate coordinates
    const coords = [fromX, fromY, toX, toY];
    if (coords.some((coord) => coord < 0 || coord > 10000)) {
      throw new Error('Invalid coordinates');
    }

    // Validate steps
    if (steps < 1 || steps > 100) {
      throw new Error('Steps must be between 1 and 100');
    }

    // Move to start position
    await page.mouse.move(fromX, fromY);

    // Start drag
    await page.mouse.down();

    // Perform drag in steps
    const deltaX = (toX - fromX) / steps;
    const deltaY = (toY - fromY) / steps;

    for (let i = 1; i <= steps; i++) {
      const currentX = fromX + deltaX * i;
      const currentY = fromY + deltaY * i;
      await page.mouse.move(currentX, currentY);

      // Small delay for smooth movement
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // End drag
    await page.mouse.up();

    const duration = Date.now() - startTime;

    logger.info('Mouse drag action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      fromX,
      fromY,
      toX,
      toY,
      duration,
    });

    return {
      success: true,
      actionType: 'mouseDrag',
      data: {
        fromX,
        fromY,
        toX,
        toY,
        steps,
        distance: Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2)),
      },
      duration,
      timestamp: new Date(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown mouse drag error';

    logger.error('Mouse drag action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      fromX,
      fromY,
      toX,
      toY,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'mouseDrag',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        fromX,
        fromY,
        toX,
        toY,
        steps,
      },
    };
  }
}

/**
 * Handle mouse scroll action
 * @param params - Mouse scroll parameters
 * @returns Action result
 */
export async function handleMouseScroll(params: MouseScrollParams): Promise<ActionResult> {
  const { x, y, deltaX, deltaY, page, context } = params;
  const startTime = Date.now();

  try {
    logger.info('Executing mouse scroll action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      x,
      y,
      deltaX,
      deltaY,
    });

    // Validate coordinates
    if (x < 0 || x > 10000 || y < 0 || y > 10000) {
      throw new Error('Invalid coordinates');
    }

    // Validate scroll deltas
    if (Math.abs(deltaX) > 1000 || Math.abs(deltaY) > 1000) {
      throw new Error('Scroll delta too large');
    }

    // Move to position and scroll
    await page.mouse.move(x, y);
    await page.mouse.wheel({ deltaX, deltaY });

    const duration = Date.now() - startTime;

    logger.info('Mouse scroll action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      x,
      y,
      deltaX,
      deltaY,
      duration,
    });

    return {
      success: true,
      actionType: 'mouseScroll',
      data: {
        x,
        y,
        deltaX,
        deltaY,
      },
      duration,
      timestamp: new Date(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown mouse scroll error';

    logger.error('Mouse scroll action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      x,
      y,
      deltaX,
      deltaY,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'mouseScroll',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        x,
        y,
        deltaX,
        deltaY,
      },
    };
  }
}
