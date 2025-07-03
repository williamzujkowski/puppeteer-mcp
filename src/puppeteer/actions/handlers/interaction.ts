/**
 * Interaction action handlers for browser automation
 * @module puppeteer/actions/handlers/interaction
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { 
  ClickAction,
  TypeAction,
  SelectAction,
  ActionResult, 
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';
import { prepareElementForInteraction } from './interaction-helpers.js';

const logger = createLogger('puppeteer:interaction');
// Re-export focus-related handlers
export { handleHover, handleFocus, handleBlur } from './interaction-focus.js';
/**
 * Handle click action
 * @param action - Click action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */
export async function handleClick(
  action: ClickAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  try {
    logger.info('Executing click action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: action.selector,
      button: action.button,
      clickCount: action.clickCount,
    });

    // Prepare element for interaction
    const element = await prepareElementForInteraction(page, action.selector, action.timeout);

    // Perform click action
    await element.click({
      button: action.button ?? 'left',
      clickCount: action.clickCount ?? 1,
      delay: action.delay ?? 0,
    });

    const duration = Date.now() - startTime;
    const sanitizedSelector = sanitizeSelector(action.selector);

    logger.info('Click action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: sanitizedSelector,
      duration,
    });

    return {
      success: true,
      actionType: 'click',
      data: {
        selector: sanitizedSelector,
        clickCount: action.clickCount ?? 1,
        button: action.button ?? 'left',
      },
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: action.selector,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown click error';
    logger.error('Click action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: action.selector,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'click',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: action.selector,
      },
    };
  }
}

/**
 * Handle type action
 * @param action - Type action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */
export async function handleType(
  action: TypeAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  try {
    logger.info('Executing type action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: action.selector,
      textLength: action.text.length,
      clearFirst: action.clearFirst,
    });

    // Sanitize selector for security
    const sanitizedSelector = sanitizeSelector(action.selector);

    // Wait for element to be available
    await page.waitForSelector(sanitizedSelector, {
      timeout: action.timeout ?? 30000,
      visible: true,
    });

    // Get element
    const element = await page.$(sanitizedSelector);
    if (element === null || element === undefined) {
      throw new Error(`Element not found: ${sanitizedSelector}`);
    }

    // Focus on element
    await element.focus();

    // Clear existing content if requested
    if (action.clearFirst === true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await element.evaluate((el: any) => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = '';
        } else {
          el.textContent = '';
        }
      });
    }

    // Type text with optional delay
    await element.type(action.text, {
      delay: action.delay ?? 0,
    });

    const duration = Date.now() - startTime;

    logger.info('Type action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: sanitizedSelector,
      textLength: action.text.length,
      duration,
    });

    return {
      success: true,
      actionType: 'type',
      data: {
        selector: sanitizedSelector,
        textLength: action.text.length,
        clearFirst: action.clearFirst,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: action.selector,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown type error';
    logger.error('Type action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: action.selector,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'type',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: action.selector,
      },
    };
  }
}

/**
 * Handle select action
 * @param action - Select action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */
export async function handleSelect(
  action: SelectAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  try {
    logger.info('Executing select action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: action.selector,
      values: action.values,
    });

    // Sanitize selector for security
    const sanitizedSelector = sanitizeSelector(action.selector);

    // Wait for element to be available
    await page.waitForSelector(sanitizedSelector, {
      timeout: action.timeout ?? 30000,
      visible: true,
    });

    // Select values
    const selectedValues = await page.select(sanitizedSelector, ...action.values);

    const duration = Date.now() - startTime;

    logger.info('Select action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: sanitizedSelector,
      selectedValues,
      duration,
    });

    return {
      success: true,
      actionType: 'select',
      data: {
        selector: sanitizedSelector,
        requestedValues: action.values,
        selectedValues,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: action.selector,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown select error';
    logger.error('Select action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: action.selector,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'select',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: action.selector,
      },
    };
  }
}