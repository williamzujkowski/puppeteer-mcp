/**
 * State-based waiting handlers for browser automation
 * @module puppeteer/actions/handlers/waiting-states
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../interfaces/action-executor.interface.js';
import type {
  WaitForElementStateResultParams,
  WaitForElementStateLogParams,
  WaitForElementStateParams,
} from './waiting-states-types.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:waiting-states');

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
  timeout?: number,
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
      timeout: timeout ?? 30000,
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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown wait for load state error';

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
 * Wait for element based on state
 * @param page - Puppeteer page instance
 * @param sanitizedSelector - Sanitized selector
 * @param state - Element state
 * @param timeout - Timeout in milliseconds
 */
async function waitForElementByState(
  page: Page,
  sanitizedSelector: string,
  state: 'visible' | 'hidden' | 'attached' | 'detached',
  timeout: number,
): Promise<void> {
  switch (state) {
    case 'visible':
      await page.waitForSelector(sanitizedSelector, {
        timeout,
        visible: true,
      });
      break;
    case 'hidden':
      await page.waitForSelector(sanitizedSelector, {
        timeout,
        hidden: true,
      });
      break;
    case 'attached':
      await page.waitForSelector(sanitizedSelector, {
        timeout,
      });
      break;
    case 'detached':
      await page.waitForFunction(
        (sel: string) => {
          const win = globalThis as unknown as {
            document?: { querySelector: (selector: string) => unknown };
          };
          return !win.document?.querySelector(sel);
        },
        {
          timeout,
          polling: 'mutation',
        },
        sanitizedSelector,
      );
      break;
    default:
      throw new Error(`Unsupported element state: ${state as string}`);
  }
}

/**
 * Create wait for element state result
 * @param success - Whether the action succeeded
 * @param selector - Original selector
 * @param sanitizedSelector - Sanitized selector
 * @param state - Element state
 * @param duration - Action duration
 * @param error - Optional error message
 * @returns Action result
 */
function createWaitForElementStateResult(params: WaitForElementStateResultParams): ActionResult {
  const { success, selector, sanitizedSelector, state, duration, error } = params;
  if (success === true) {
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
  }

  return {
    success: false,
    actionType: 'waitForElementState',
    error: error ?? 'Unknown wait for element state error',
    duration,
    timestamp: new Date(),
    metadata: {
      originalSelector: selector,
      state,
    },
  };
}

/**
 * Log wait for element state action
 * @param message - Log message
 * @param context - Action context
 * @param selector - CSS selector
 * @param state - Element state
 * @param additional - Additional log data
 */
function logWaitForElementState(params: WaitForElementStateLogParams): void {
  const { message, context, selector, state, additional } = params;
  const logData = {
    sessionId: context.sessionId,
    contextId: context.contextId,
    selector,
    state,
    ...additional,
  };

  if (message.includes('failed')) {
    logger.error(message, logData);
  } else {
    logger.info(message, logData);
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
  params: WaitForElementStateParams,
): Promise<ActionResult> {
  const { selector, state, page, context, timeout } = params;
  const startTime = Date.now();
  const effectiveTimeout = timeout ?? 30000;

  try {
    logWaitForElementState({
      message: 'Executing wait for element state action',
      context,
      selector,
      state,
    });

    const sanitizedSelector = sanitizeSelector(selector);
    await waitForElementByState(page, sanitizedSelector, state, effectiveTimeout);

    const duration = Date.now() - startTime;
    logWaitForElementState({
      message: 'Wait for element state action completed',
      context,
      selector: sanitizedSelector,
      state,
      additional: { duration },
    });

    return createWaitForElementStateResult({
      success: true,
      selector,
      sanitizedSelector,
      state,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown wait for element state error';

    logWaitForElementState({
      message: 'Wait for element state action failed',
      context,
      selector,
      state,
      additional: { error: errorMessage, duration },
    });

    return createWaitForElementStateResult({
      success: false,
      selector,
      sanitizedSelector: selector,
      state,
      duration,
      error: errorMessage,
    });
  }
}

/**
 * Create a safe wait function wrapper
 * @param functionString - Function string to wrap
 * @returns Safe function string
 * @nist si-10 "Information input validation"
 */
export function createSafeWaitFunction(functionString: string): string {
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
