/**
 * Mouse action handlers for browser automation
 * @module puppeteer/actions/handlers/mouse
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { 
  MouseAction,
  ActionResult, 
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';
import { validateMouseCoordinates, executeMouseAction } from './mouse-helpers.js';
export { handleMouseDrag, handleMouseScroll } from './mouse-drag-scroll.js';

const logger = createLogger('puppeteer:mouse');

/**
 * Handle mouse action
 * @param action - Mouse action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */
export async function handleMouse(
  action: MouseAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing mouse action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      action: action.action,
      x: action.x,
      y: action.y,
      button: action.button,
    });

    // Validate coordinates
    validateMouseCoordinates(action.x, action.y);

    // Execute mouse action
    await executeMouseAction(page, action);

    const duration = Date.now() - startTime;

    logger.info('Mouse action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      action: action.action,
      duration,
    });

    return {
      success: true,
      actionType: 'mouse',
      data: {
        action: action.action,
        x: action.x,
        y: action.y,
        button: action.button,
        deltaX: action.deltaX,
        deltaY: action.deltaY,
      },
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown mouse error';

    logger.error('Mouse action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      action: action.action,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'mouse',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        action: action.action,
        x: action.x,
        y: action.y,
        button: action.button,
      },
    };
  }
}

/**
 * Handle mouse click at coordinates
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param options - Click options
 * @returns Action result
 */
interface MouseClickParams {
  x: number;
  y: number;
  page: Page;
  context: ActionContext;
  options?: {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
  };
}

/**
 * Create mouse click result
 * @param success - Whether the action succeeded
 * @param params - Mouse click parameters
 * @param duration - Action duration
 * @param error - Optional error message
 * @returns Action result
 */
function createMouseClickResult(
  success: boolean,
  params: MouseClickParams,
  duration: number,
  error?: string
): ActionResult {
  const { x, y, options } = params;
  
  if (success) {
    return {
      success: true,
      actionType: 'mouseClick',
      data: {
        x,
        y,
        button: options?.button ?? 'left',
        clickCount: options?.clickCount ?? 1,
      },
      duration,
      timestamp: new Date(),
    };
  }
  
  return {
    success: false,
    actionType: 'mouseClick',
    error: error ?? 'Unknown mouse click error',
    duration,
    timestamp: new Date(),
    metadata: {
      x,
      y,
      button: options?.button,
      clickCount: options?.clickCount,
    },
  };
}

/**
 * Log mouse click action
 * @param message - Log message
 * @param params - Mouse click parameters
 * @param context - Action context
 * @param additional - Additional log data
 */
function logMouseClick(
  message: string,
  params: MouseClickParams,
  context: ActionContext,
  additional?: Record<string, unknown>
): void {
  const { x, y, options } = params;
  
  const logData = {
    sessionId: context.sessionId,
    contextId: context.contextId,
    x,
    y,
    button: options?.button,
    clickCount: options?.clickCount,
    ...additional,
  };
  
  if (message.includes('failed')) {
    logger.error(message, logData);
  } else {
    logger.info(message, logData);
  }
}

export async function handleMouseClick(params: MouseClickParams): Promise<ActionResult> {
  const { x, y, page, context, options } = params;
  const startTime = Date.now();
  
  try {
    logMouseClick('Executing mouse click action', params, context);

    // Validate coordinates
    validateMouseCoordinates(x, y);

    // Perform click
    await page.mouse.click(x, y, {
      button: options?.button ?? 'left',
      clickCount: options?.clickCount ?? 1,
      delay: options?.delay ?? 0,
    });

    const duration = Date.now() - startTime;
    logMouseClick('Mouse click action completed', params, context, { duration });

    return createMouseClickResult(true, params, duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown mouse click error';
    
    logMouseClick('Mouse click action failed', params, context, { error: errorMessage, duration });
    
    return createMouseClickResult(false, params, duration, errorMessage);
  }
}

