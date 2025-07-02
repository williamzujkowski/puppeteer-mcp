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

const logger = createLogger('puppeteer:waiting');

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
        throw new Error(`Unsupported wait type: ${action.waitType}`);
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
async function handleWaitForSelector(action: WaitAction, page: Page) {
  if (!action.selector) {
    throw new Error('Selector is required for waitForSelector');
  }

  const sanitizedSelector = sanitizeSelector(action.selector);
  
  return await page.waitForSelector(sanitizedSelector, {
    timeout: action.timeout || 30000,
    visible: true,
  });
}

/**
 * Handle wait for navigation
 * @param action - Wait action
 * @param page - Puppeteer page instance
 * @returns Navigation response
 */
async function handleWaitForNavigation(action: WaitAction, page: Page) {
  return await page.waitForNavigation({
    timeout: action.timeout || 30000,
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

  await new Promise(resolve => setTimeout(resolve, action.duration));
}

/**
 * Handle wait for function
 * @param action - Wait action
 * @param page - Puppeteer page instance
 * @returns Function result
 */
async function handleWaitForFunction(action: WaitAction, page: Page) {
  if (!action.function) {
    throw new Error('Function is required for waitForFunction');
  }

  // Validate JavaScript code for security
  validateJavaScriptCode(action.function);

  // Create a safe evaluation function
  const safeFunction = createSafeWaitFunction(action.function);

  return await page.waitForFunction(safeFunction, {
    timeout: action.timeout || 30000,
    polling: 'mutation', // Poll on DOM mutations
  });
}

/**
 * Handle wait for load state
 * @param loadState - Load state to wait for
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param timeout - Optional timeout
 * @returns Action result
 */
export async function handleWaitForLoadState(
  loadState: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2',
  page: Page,
  context: ActionContext,
  timeout?: number
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing wait for load state action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      loadState,
    });

    // Use page.waitForLoadState if available, otherwise use navigation
    await page.waitForNavigation({
      timeout: timeout || 30000,
      waitUntil: loadState,
    });

    const duration = Date.now() - startTime;

    logger.info('Wait for load state action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      loadState,
      duration,
    });

    return {
      success: true,
      actionType: 'waitForLoadState',
      data: {
        loadState,
        url: page.url(),
      },
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown wait for load state error';

    logger.error('Wait for load state action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      loadState,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'waitForLoadState',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        loadState,
      },
    };
  }
}

/**
 * Handle wait for element state
 * @param selector - CSS selector
 * @param state - Element state to wait for
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param timeout - Optional timeout
 * @returns Action result
 */
export async function handleWaitForElementState(
  selector: string,
  state: 'visible' | 'hidden' | 'attached' | 'detached',
  page: Page,
  context: ActionContext,
  timeout?: number
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing wait for element state action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
      state,
    });

    const sanitizedSelector = sanitizeSelector(selector);

    switch (state) {
      case 'visible':
        await page.waitForSelector(sanitizedSelector, {
          timeout: timeout || 30000,
          visible: true,
        });
        break;
      case 'hidden':
        await page.waitForSelector(sanitizedSelector, {
          timeout: timeout || 30000,
          hidden: true,
        });
        break;
      case 'attached':
        await page.waitForSelector(sanitizedSelector, {
          timeout: timeout || 30000,
        });
        break;
      case 'detached':
        await page.waitForFunction(
          (sel: string) => !(globalThis as any).document?.querySelector(sel),
          {
            timeout: timeout || 30000,
            polling: 'mutation',
          },
          sanitizedSelector
        );
        break;
      default:
        throw new Error(`Unsupported element state: ${state}`);
    }

    const duration = Date.now() - startTime;

    logger.info('Wait for element state action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector: sanitizedSelector,
      state,
      duration,
    });

    return {
      success: true,
      actionType: 'waitForElementState',
      data: {
        selector: sanitizedSelector,
        state,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: selector,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown wait for element state error';

    logger.error('Wait for element state action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
      state,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'waitForElementState',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: selector,
        state,
      },
    };
  }
}

/**
 * Create a safe wait function wrapper
 * @param functionString - Function string to wrap
 * @returns Safe function string
 * @nist si-10 "Information input validation"
 */
function createSafeWaitFunction(functionString: string): string {
  // Remove any potential dangerous patterns
  const sanitizedFunction = functionString
    .replace(/eval\s*\(/gi, 'void(')
    .replace(/Function\s*\(/gi, 'void(')
    .replace(/constructor/gi, 'void')
    .replace(/prototype/gi, 'void')
    .replace(/__proto__/gi, 'void');

  // Wrap function in try-catch for safety
  return `
    (function() {
      try {
        return (${sanitizedFunction})();
      } catch (error) {
        console.error('Wait function error:', error);
        return false;
      }
    })
  `;
}