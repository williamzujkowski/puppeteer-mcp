/**
 * Waiting action handlers for browser automation
 * @module puppeteer/actions/handlers/waiting
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { 
  WaitAction,
  ActionResult, 
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { sanitizeSelector, validateJavaScriptCode } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';
import { createSafeWaitFunction } from './waiting-states.js';

const logger = createLogger('puppeteer:waiting');

// Re-export state-based waiting handlers
export { handleWaitForLoadState, handleWaitForElementState } from './waiting-states.js';

/**
 * Handle wait action
 * @param action - Wait action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */
export async function handleWait(
  action: WaitAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing wait action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      waitType: action.waitType,
      selector: action.selector,
      duration: action.duration,
    });

    let result: unknown;

    switch (action.waitType) {
      case 'selector':
        result = await handleWaitForSelector(action, page);
        break;
      case 'navigation':
        result = await handleWaitForNavigation(action, page);
        break;
      case 'timeout':
        result = await handleWaitForTimeout(action);
        break;
      case 'function':
        result = await handleWaitForFunction(action, page);
        break;
      default:
        throw new Error(`Unsupported wait type: ${String(action.waitType)}`);
    }

    const duration = Date.now() - startTime;

    logger.info('Wait action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      waitType: action.waitType,
      duration,
    });

    return {
      success: true,
      actionType: 'wait',
      data: {
        waitType: action.waitType,
        result,
        actualDuration: duration,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        selector: action.selector,
        requestedDuration: action.duration,
        function: action.function,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown wait error';

    logger.error('Wait action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      waitType: action.waitType,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'wait',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        waitType: action.waitType,
        selector: action.selector,
        requestedDuration: action.duration,
      },
    };
  }
}

/**
 * Handle wait for selector
 * @param action - Wait action
 * @param page - Puppeteer page instance
 * @returns Element handle or null
 */
function handleWaitForSelector(action: WaitAction, page: Page) {
  if (!action.selector) {
    throw new Error('Selector is required for waitForSelector');
  }

  const sanitizedSelector = sanitizeSelector(action.selector);
  
  return page.waitForSelector(sanitizedSelector, {
    timeout: action.timeout ?? 30000,
    visible: true,
  });
}

/**
 * Handle wait for navigation
 * @param action - Wait action
 * @param page - Puppeteer page instance
 * @returns Navigation response
 */
function handleWaitForNavigation(action: WaitAction, page: Page) {
  return page.waitForNavigation({
    timeout: action.timeout ?? 30000,
    waitUntil: 'load',
  });
}

/**
 * Handle wait for timeout
 * @param action - Wait action
 * @returns Promise that resolves after timeout
 */
async function handleWaitForTimeout(action: WaitAction): Promise<void> {
  if (!action.duration) {
    throw new Error('Duration is required for waitForTimeout');
  }

  if (action.duration > 300000) { // 5 minutes max
    throw new Error('Duration cannot exceed 5 minutes');
  }

  await new Promise<void>(resolve => {
    setTimeout(resolve, action.duration);
  });
}

/**
 * Handle wait for function
 * @param action - Wait action
 * @param page - Puppeteer page instance
 * @returns Function result
 */
function handleWaitForFunction(action: WaitAction, page: Page) {
  if (!action.function) {
    throw new Error('Function is required for waitForFunction');
  }

  // Validate JavaScript code for security
  validateJavaScriptCode(action.function);

  // Create a safe evaluation function
  const safeFunction = createSafeWaitFunction(action.function);

  return page.waitForFunction(safeFunction, {
    timeout: action.timeout ?? 30000,
    polling: 'mutation', // Poll on DOM mutations
  });
}