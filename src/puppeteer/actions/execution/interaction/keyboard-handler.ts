/**
 * Keyboard action handler
 * @module puppeteer/actions/execution/interaction/keyboard-handler
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  KeyboardAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import { BaseInteractionHandler } from './base-handler.js';

/**
 * Keyboard action handler implementation
 * @nist ac-3 "Access enforcement"
 */
export class KeyboardHandler extends BaseInteractionHandler<KeyboardAction> {
  protected actionType = 'keyboard';

  /**
   * Execute keyboard action
   * @param action - Keyboard action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  async execute(action: KeyboardAction, page: Page, context: ActionContext): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      this.log('debug', 'Executing keyboard action', context, {
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

      this.log('info', 'Keyboard action completed', context, {
        key: action.key,
        action: action.action,
        duration,
      });

      return this.createActionResult(true, this.actionType, {
        data: {
          key: action.key,
          action: action.action,
        },
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Keyboard action failed';

      this.log('error', 'Keyboard action failed', context, {
        key: action.key,
        action: action.action,
        error: errorMessage,
        duration,
      });

      return this.createActionResult(false, this.actionType, {
        error: errorMessage,
        duration,
        metadata: {
          key: action.key,
          action: action.action,
        },
      });
    }
  }
}
