/**
 * User interaction actions executor
 * @module puppeteer/actions/execution/interaction-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page, ElementHandle } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ClickAction,
  TypeAction,
  SelectAction,
  KeyboardAction,
  MouseAction,
} from '../../interfaces/action-executor.interface.js';
import type { InteractionOptions } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:interaction-executor');

/**
 * Interaction action executor
 * @nist ac-3 "Access enforcement"
 */
export class InteractionExecutor {
  /**
   * Execute click action
   * @param action - Click action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeClick(
    action: ClickAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing click action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector,
        button: action.button,
        clickCount: action.clickCount,
      });

      // Prepare element for interaction
      const element = await this.prepareElementForInteraction(
        page,
        action.selector,
        action.timeout || DEFAULT_CONFIG.TIMEOUT.element,
      );

      // Perform click
      await element.click({
        button: action.button || DEFAULT_CONFIG.INTERACTION.button,
        clickCount: action.clickCount || DEFAULT_CONFIG.INTERACTION.clickCount,
        delay: action.delay || DEFAULT_CONFIG.INTERACTION.delay,
      });

      const duration = Date.now() - startTime;
      const sanitizedSelector = sanitizeSelector(action.selector);

      logger.info('Click action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: sanitizedSelector,
        duration,
      });

      return {
        success: true,
        actionType: 'click',
        data: {
          selector: sanitizedSelector,
          clickCount: action.clickCount || 1,
          button: action.button || 'left',
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalSelector: action.selector,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Click action failed';

      logger.error('Click action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
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
          selector: action.selector,
        },
      };
    }
  }

  /**
   * Execute type action
   * @param action - Type action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeType(
    action: TypeAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing type action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector,
        textLength: action.text.length,
        clearFirst: action.clearFirst,
      });

      // Prepare element for interaction
      const element = await this.prepareElementForInteraction(
        page,
        action.selector,
        action.timeout || DEFAULT_CONFIG.TIMEOUT.element,
      );

      // Clear field if requested
      if (action.clearFirst !== false) {
        await element.click({ clickCount: 3 }); // Select all
        await element.press('Backspace');
      }

      // Type text
      await element.type(action.text, {
        delay: action.delay || DEFAULT_CONFIG.INTERACTION.delay,
      });

      const duration = Date.now() - startTime;
      const sanitizedSelector = sanitizeSelector(action.selector);

      logger.info('Type action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
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
          clearFirst: action.clearFirst !== false,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalSelector: action.selector,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Type action failed';

      logger.error('Type action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
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
          selector: action.selector,
          textLength: action.text?.length || 0,
        },
      };
    }
  }

  /**
   * Execute select action
   * @param action - Select action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeSelect(
    action: SelectAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing select action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector,
        values: action.values,
      });

      // Select values
      const selectedValues = await page.select(action.selector, ...action.values);

      const duration = Date.now() - startTime;
      const sanitizedSelector = sanitizeSelector(action.selector);

      logger.info('Select action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: sanitizedSelector,
        selectedCount: selectedValues.length,
        duration,
      });

      return {
        success: true,
        actionType: 'select',
        data: {
          selector: sanitizedSelector,
          selectedValues,
          requestedValues: action.values,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalSelector: action.selector,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Select action failed';

      logger.error('Select action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
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
          selector: action.selector,
          values: action.values,
        },
      };
    }
  }

  /**
   * Execute keyboard action
   * @param action - Keyboard action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeKeyboard(
    action: KeyboardAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing keyboard action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        key: action.key,
        action: action.action,
      });

      const keyboard = page.keyboard;

      switch (action.action) {
        case 'press':
          await keyboard.press(action.key);
          break;
        case 'down':
          await keyboard.down(action.key);
          break;
        case 'up':
          await keyboard.up(action.key);
          break;
        default:
          throw new Error(`Unknown keyboard action: ${action.action}`);
      }

      const duration = Date.now() - startTime;

      logger.info('Keyboard action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        key: action.key,
        action: action.action,
        duration,
      });

      return {
        success: true,
        actionType: 'keyboard',
        data: {
          key: action.key,
          action: action.action,
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Keyboard action failed';

      logger.error('Keyboard action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        key: action.key,
        action: action.action,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'keyboard',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          key: action.key,
          action: action.action,
        },
      };
    }
  }

  /**
   * Execute mouse action
   * @param action - Mouse action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeMouse(
    action: MouseAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing mouse action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        action: action.action,
        x: action.x,
        y: action.y,
      });

      const mouse = page.mouse;

      switch (action.action) {
        case 'move':
          if (action.x !== undefined && action.y !== undefined) {
            await mouse.move(action.x, action.y);
          } else {
            throw new Error('Move action requires x and y coordinates');
          }
          break;
        case 'down':
          await mouse.down({
            button: action.button || 'left',
          });
          break;
        case 'up':
          await mouse.up({
            button: action.button || 'left',
          });
          break;
        case 'wheel':
          if (action.deltaX !== undefined || action.deltaY !== undefined) {
            await mouse.wheel({
              deltaX: action.deltaX || 0,
              deltaY: action.deltaY || 0,
            });
          } else {
            throw new Error('Wheel action requires deltaX or deltaY');
          }
          break;
        default:
          throw new Error(`Unknown mouse action: ${action.action}`);
      }

      const duration = Date.now() - startTime;

      logger.info('Mouse action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
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
      const errorMessage = error instanceof Error ? error.message : 'Mouse action failed';

      logger.error('Mouse action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
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
        },
      };
    }
  }

  /**
   * Execute hover action
   * @param selector - Element selector to hover over
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Action timeout
   * @returns Action result
   */
  async executeHover(
    selector: string,
    page: Page,
    context: ActionContext,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.element,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing hover action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector,
      });

      // Prepare element for interaction
      const element = await this.prepareElementForInteraction(page, selector, timeout);

      // Hover over element
      await element.hover();

      const duration = Date.now() - startTime;
      const sanitizedSelector = sanitizeSelector(selector);

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
      const errorMessage = error instanceof Error ? error.message : 'Hover action failed';

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
          selector,
        },
      };
    }
  }

  /**
   * Execute route handler for interaction actions
   * @param action - Browser action
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    switch (action.type) {
      case 'click':
        return this.executeClick(action as ClickAction, page, context);
      case 'type':
        return this.executeType(action as TypeAction, page, context);
      case 'select':
        return this.executeSelect(action as SelectAction, page, context);
      case 'keyboard':
        return this.executeKeyboard(action as KeyboardAction, page, context);
      case 'mouse':
        return this.executeMouse(action as MouseAction, page, context);
      case 'hover':
        return this.executeHover(
          (action as { selector: string }).selector,
          page,
          context,
          action.timeout,
        );
      default:
        throw new Error(`Unsupported interaction action: ${action.type}`);
    }
  }

  /**
   * Prepare element for interaction
   * @param page - Page instance
   * @param selector - Element selector
   * @param timeout - Wait timeout
   * @returns Element handle
   */
  private async prepareElementForInteraction(
    page: Page,
    selector: string,
    timeout: number,
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
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check if element is enabled (for form elements)
    try {
      const isDisabled = await element.evaluate((el) => {
        if (el instanceof HTMLInputElement || 
            el instanceof HTMLButtonElement || 
            el instanceof HTMLSelectElement || 
            el instanceof HTMLTextAreaElement) {
          return el.disabled;
        }
        return false;
      });

      if (isDisabled) {
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
   * Get supported interaction action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return ['click', 'type', 'select', 'keyboard', 'mouse', 'hover'];
  }
}