/**
 * Focus-related interaction handlers for browser automation
 * @module puppeteer/actions/handlers/interaction-focus
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../interfaces/action-executor.interface.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:interaction-focus');

/**
 * Handle hover action
 * @param selector - CSS selector
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param timeout - Optional timeout
 * @returns Action result
 * @nist au-3 "Content of audit records"
 */
export async function handleHover(
  selector: string,
  page: Page,
  context: ActionContext,
  timeout?: number,
): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    logger.info('Executing hover action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
    });

    // Sanitize selector for security
    const sanitizedSelector = sanitizeSelector(selector);

    // Wait for element to be available
    await page.waitForSelector(sanitizedSelector, {
      timeout: timeout ?? 30000,
      visible: true,
    });

    // Hover over element
    await page.hover(sanitizedSelector);

    const duration = Date.now() - startTime;

    logger.info('Hover action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector: sanitizedSelector,
      duration,
    });

    return {
      success: true,
      actionType: 'hover',
      data: {
        selector: sanitizedSelector,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: selector,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown hover error';

    logger.error('Hover action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'hover',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: selector,
      },
    };
  }
}

/**
 * Handle focus action
 * @param selector - CSS selector
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param timeout - Optional timeout
 * @returns Action result
 * @nist au-3 "Content of audit records"
 */
export async function handleFocus(
  selector: string,
  page: Page,
  context: ActionContext,
  timeout?: number,
): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    logger.info('Executing focus action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
    });

    // Sanitize selector for security
    const sanitizedSelector = sanitizeSelector(selector);

    // Wait for element to be available
    await page.waitForSelector(sanitizedSelector, {
      timeout: timeout ?? 30000,
      visible: true,
    });

    // Focus on element
    await page.focus(sanitizedSelector);

    const duration = Date.now() - startTime;

    logger.info('Focus action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector: sanitizedSelector,
      duration,
    });

    return {
      success: true,
      actionType: 'focus',
      data: {
        selector: sanitizedSelector,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: selector,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown focus error';

    logger.error('Focus action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'focus',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: selector,
      },
    };
  }
}

/**
 * Handle blur action
 * @param selector - CSS selector
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param timeout - Optional timeout
 * @returns Action result
 * @nist au-3 "Content of audit records"
 */
export async function handleBlur(
  selector: string,
  page: Page,
  context: ActionContext,
  timeout?: number,
): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    logger.info('Executing blur action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
    });

    // Sanitize selector for security
    const sanitizedSelector = sanitizeSelector(selector);

    // Wait for element to be available
    await page.waitForSelector(sanitizedSelector, {
      timeout: timeout ?? 30000,
    });

    // Get element and blur it
    const element = await page.$(sanitizedSelector);
    if (!element) {
      throw new Error(`Element not found: ${sanitizedSelector}`);
    }

    await element.evaluate((el) => {
      const element = el as unknown as { blur?: () => void };
      if (element.blur) {
        element.blur();
      }
    });

    const duration = Date.now() - startTime;

    logger.info('Blur action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector: sanitizedSelector,
      duration,
    });

    return {
      success: true,
      actionType: 'blur',
      data: {
        selector: sanitizedSelector,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: selector,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown blur error';

    logger.error('Blur action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'blur',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: selector,
      },
    };
  }
}
