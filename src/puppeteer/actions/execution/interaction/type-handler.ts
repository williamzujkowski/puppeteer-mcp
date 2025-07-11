/**
 * Type action handler
 * @module puppeteer/actions/execution/interaction/type-handler
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  TypeAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import { BaseInteractionHandler } from './base-handler.js';
import { DEFAULT_CONFIG } from '../types.js';

/**
 * Type action handler implementation
 * @nist ac-3 "Access enforcement"
 */
export class TypeHandler extends BaseInteractionHandler<TypeAction> {
  protected actionType = 'type';

  /**
   * Execute type action
   * @param action - Type action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  async execute(action: TypeAction, page: Page, context: ActionContext): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      this.log('debug', 'Executing type action', context, {
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
      const sanitizedSelector = this.sanitize(action.selector);

      this.log('info', 'Type action completed', context, {
        selector: sanitizedSelector,
        textLength: action.text.length,
        duration,
      });

      return this.createActionResult(true, this.actionType, {
        data: {
          selector: sanitizedSelector,
          textLength: action.text.length,
          clearFirst: action.clearFirst !== false,
        },
        duration,
        metadata: {
          originalSelector: action.selector,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Type action failed';

      this.log('error', 'Type action failed', context, {
        selector: action.selector,
        error: errorMessage,
        duration,
      });

      return this.createActionResult(false, this.actionType, {
        error: errorMessage,
        duration,
        metadata: {
          selector: action.selector,
          textLength: action.text?.length || 0,
        },
      });
    }
  }
}
