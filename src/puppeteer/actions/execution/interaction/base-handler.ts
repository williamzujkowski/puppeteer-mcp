/**
 * Base handler for interaction actions
 * @module puppeteer/actions/execution/interaction/base-handler
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page, ElementHandle } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../../interfaces/action-executor.interface.js';
import { DEFAULT_CONFIG } from '../types.js';
import { sanitizeSelector } from '../../validation.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:interaction:base-handler');

/**
 * Base interaction handler interface
 * @nist ac-3 "Access enforcement"
 */
export interface InteractionHandler<T> {
  /**
   * Execute the interaction action
   * @param action - Action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  execute(action: T, page: Page, context: ActionContext): Promise<ActionResult>;

  /**
   * Get the action type this handler supports
   * @returns Action type string
   */
  getActionType(): string;
}

/**
 * Abstract base class for interaction handlers
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */
export abstract class BaseInteractionHandler<T> implements InteractionHandler<T> {
  protected abstract actionType: string;

  /**
   * Get the action type this handler supports
   * @returns Action type string
   */
  getActionType(): string {
    return this.actionType;
  }

  /**
   * Execute the interaction action
   * @param action - Action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  abstract execute(action: T, page: Page, context: ActionContext): Promise<ActionResult>;

  /**
   * Prepare element for interaction
   * @param page - Page instance
   * @param selector - Element selector
   * @param timeout - Wait timeout
   * @returns Element handle
   * @nist ac-3 "Access enforcement"
   */
  protected async prepareElementForInteraction(
    page: Page,
    selector: string,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.element,
  ): Promise<ElementHandle> {
    // Wait for element to be present
    await page.waitForSelector(selector, { timeout });

    // Get element handle
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    // Check if element is visible and interactable
    const isVisible = await element.isIntersectingViewport();
    if (!isVisible) {
      // Scroll element into view
      await element.scrollIntoView();

      // Wait a bit for scroll to complete
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });
    }

    // Check if element is enabled (for form elements)
    try {
      const isDisabled = await element.evaluate((el) => {
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLButtonElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        ) {
          return el.disabled;
        }
        return false;
      });

      if (isDisabled === true) {
        throw new Error(`Element is disabled: ${selector}`);
      }
    } catch (error) {
      // Non-form elements or evaluation error - continue
      logger.debug('Could not check element disabled state', {
        selector,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return element;
  }

  /**
   * Create a standard action result
   * @param success - Whether the action succeeded
   * @param actionType - Type of action
   * @param options - Result options (data, error, duration, metadata)
   * @returns Action result
   */
  protected createActionResult(
    success: boolean,
    actionType: string,
    options?: {
      data?: Record<string, unknown>;
      error?: string;
      duration?: number;
      metadata?: Record<string, unknown>;
    },
  ): ActionResult {
    return {
      success,
      actionType,
      data: options?.data,
      error: options?.error,
      duration: options?.duration ?? 0,
      timestamp: new Date(),
      metadata: options?.metadata,
    };
  }

  /**
   * Log action execution
   * @param level - Log level
   * @param message - Log message
   * @param context - Execution context
   * @param data - Additional data
   */
  protected log(
    level: 'debug' | 'info' | 'error',
    message: string,
    context: ActionContext,
    data?: Record<string, unknown>,
  ): void {
    if (level === 'debug') {
      logger.debug(message, {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: this.actionType,
        ...data,
      });
    } else if (level === 'info') {
      logger.info(message, {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: this.actionType,
        ...data,
      });
    } else {
      logger.error(message, {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: this.actionType,
        ...data,
      });
    }
  }

  /**
   * Sanitize selector for safe logging
   * @param selector - Selector to sanitize
   * @returns Sanitized selector
   */
  protected sanitize(selector: string): string {
    return sanitizeSelector(selector);
  }
}
