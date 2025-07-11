/**
 * Mouse action handler
 * @module puppeteer/actions/execution/interaction/mouse-handler
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  MouseAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import { BaseInteractionHandler } from './base-handler.js';

/**
 * Mouse action handler implementation
 * @nist ac-3 "Access enforcement"
 */
export class MouseHandler extends BaseInteractionHandler<MouseAction> {
  protected actionType = 'mouse';

  /**
   * Execute mouse action
   * @param action - Mouse action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  async execute(action: MouseAction, page: Page, context: ActionContext): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      this.log('debug', 'Executing mouse action', context, {
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

      this.log('info', 'Mouse action completed', context, {
        action: action.action,
        duration,
      });

      return this.createActionResult(true, this.actionType, {
        data: {
          action: action.action,
          x: action.x,
          y: action.y,
          button: action.button,
          deltaX: action.deltaX,
          deltaY: action.deltaY,
        },
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Mouse action failed';

      this.log('error', 'Mouse action failed', context, {
        action: action.action,
        error: errorMessage,
        duration,
      });

      return this.createActionResult(false, this.actionType, {
        error: errorMessage,
        duration,
        metadata: {
          action: action.action,
          x: action.x,
          y: action.y,
        },
      });
    }
  }
}
