/**
 * Keyboard action handlers for browser automation
 * @module puppeteer/actions/handlers/keyboard
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  KeyboardAction,
  ActionResult,
  ActionContext,
} from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';
import { isValidKey } from './keyboard-validation.js';
export {
  handleKeyboardShortcut,
  handleKeyCombination,
  handleKeyboardType,
} from './keyboard-shortcuts.js';

const logger = createLogger('puppeteer:keyboard');

/**
 * Handle keyboard action
 * @param action - Keyboard action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */
export async function handleKeyboard(
  action: KeyboardAction,
  page: Page,
  context: ActionContext,
): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    logger.info('Executing keyboard action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      key: action.key,
      action: action.action,
    });

    // Validate key input
    if (!isValidKey(action.key)) {
      throw new Error(`Invalid key: ${action.key}`);
    }

    // Execute keyboard action
    switch (action.action) {
      case 'press':
        await page.keyboard.press(action.key);
        break;
      case 'down':
        await page.keyboard.down(action.key);
        break;
      case 'up':
        await page.keyboard.up(action.key);
        break;
      default:
        throw new Error(`Unsupported keyboard action: ${String(action.action)}`);
    }

    const duration = Date.now() - startTime;

    logger.info('Keyboard action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown keyboard error';

    logger.error('Keyboard action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
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
