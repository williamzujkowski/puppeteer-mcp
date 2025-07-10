/**
 * Select action handler
 * @module puppeteer/actions/execution/interaction/select-handler
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type { SelectAction, ActionResult, ActionContext } from '../../../interfaces/action-executor.interface.js';
import { BaseInteractionHandler } from './base-handler.js';

/**
 * Select action handler implementation
 * @nist ac-3 "Access enforcement"
 */
export class SelectHandler extends BaseInteractionHandler<SelectAction> {
  protected actionType = 'select';

  /**
   * Execute select action
   * @param action - Select action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  async execute(
    action: SelectAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      this.log('debug', 'Executing select action', context, {
        selector: action.selector,
        values: action.values,
      });

      // Select values
      const selectedValues = await page.select(action.selector, ...action.values);

      const duration = Date.now() - startTime;
      const sanitizedSelector = this.sanitize(action.selector);

      this.log('info', 'Select action completed', context, {
        selector: sanitizedSelector,
        selectedCount: selectedValues.length,
        duration,
      });

      return this.createActionResult(
        true,
        this.actionType,
        {
          selector: sanitizedSelector,
          selectedValues,
          requestedValues: action.values,
        },
        undefined,
        duration,
        {
          originalSelector: action.selector,
        },
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Select action failed';

      this.log('error', 'Select action failed', context, {
        selector: action.selector,
        error: errorMessage,
        duration,
      });

      return this.createActionResult(
        false,
        this.actionType,
        undefined,
        errorMessage,
        duration,
        {
          selector: action.selector,
          values: action.values,
        },
      );
    }
  }
}