/**
 * Click action handler
 * @module puppeteer/actions/execution/interaction/click-handler
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type { ClickAction, ActionResult, ActionContext } from '../../../interfaces/action-executor.interface.js';
import { BaseInteractionHandler } from './base-handler.js';
import { DEFAULT_CONFIG } from '../types.js';

/**
 * Click action handler implementation
 * @nist ac-3 "Access enforcement"
 */
export class ClickHandler extends BaseInteractionHandler<ClickAction> {
  protected actionType = 'click';

  /**
   * Execute click action
   * @param action - Click action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  async execute(
    action: ClickAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      this.log('debug', 'Executing click action', context, {
        selector: action.selector,
        button: action.button,
        clickCount: action.clickCount,
      });

      // Prepare element for interaction
      const element = await this.prepareElementForInteraction(
        page,
        action.selector,
        action.timeout ?? DEFAULT_CONFIG.TIMEOUT.element,
      );

      // Perform click
      await element.click({
        button: action.button ?? DEFAULT_CONFIG.INTERACTION.button,
        clickCount: action.clickCount ?? DEFAULT_CONFIG.INTERACTION.clickCount,
        delay: action.delay ?? DEFAULT_CONFIG.INTERACTION.delay,
      });

      const duration = Date.now() - startTime;
      const sanitizedSelector = this.sanitize(action.selector);

      this.log('info', 'Click action completed', context, {
        selector: sanitizedSelector,
        duration,
      });

      return this.createActionResult(
        true,
        this.actionType,
        {
          data: {
            selector: sanitizedSelector,
            clickCount: action.clickCount ?? 1,
            button: action.button ?? 'left',
          },
          duration,
          metadata: {
            originalSelector: action.selector,
          },
        },
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Click action failed';

      this.log('error', 'Click action failed', context, {
        selector: action.selector,
        error: errorMessage,
        duration,
      });

      return this.createActionResult(
        false,
        this.actionType,
        {
          error: errorMessage,
          duration,
          metadata: {
            selector: action.selector,
          },
        },
      );
    }
  }
}