/**
 * Hover action handler
 * @module puppeteer/actions/execution/interaction/hover-handler
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  ActionResult,
  ActionContext,
  HoverAction,
} from '../../../interfaces/action-executor.interface.js';
import { BaseInteractionHandler } from './base-handler.js';
import { DEFAULT_CONFIG } from '../types.js';

/**
 * Hover action handler implementation
 * @nist ac-3 "Access enforcement"
 */
export class HoverHandler extends BaseInteractionHandler<HoverAction> {
  protected actionType = 'hover';

  /**
   * Execute hover action
   * @param action - Hover action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  async execute(action: HoverAction, page: Page, context: ActionContext): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      this.log('debug', 'Executing hover action', context, {
        selector: action.selector,
      });

      // Prepare element for interaction
      const element = await this.prepareElementForInteraction(
        page,
        action.selector,
        action.timeout || DEFAULT_CONFIG.TIMEOUT.element,
      );

      // Hover over element
      await element.hover();

      const duration = Date.now() - startTime;
      const sanitizedSelector = this.sanitize(action.selector);

      this.log('info', 'Hover action completed', context, {
        selector: sanitizedSelector,
        duration,
      });

      return this.createActionResult(true, this.actionType, {
        data: {
          selector: sanitizedSelector,
        },
        duration,
        metadata: {
          originalSelector: action.selector,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Hover action failed';

      this.log('error', 'Hover action failed', context, {
        selector: action.selector,
        error: errorMessage,
        duration,
      });

      return this.createActionResult(false, this.actionType, {
        error: errorMessage,
        duration,
        metadata: {
          selector: action.selector,
        },
      });
    }
  }
}
