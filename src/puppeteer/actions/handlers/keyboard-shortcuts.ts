/**
 * Keyboard shortcut and combination handlers
 * @module puppeteer/actions/handlers/keyboard-shortcuts
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page, KeyInput } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';
import { isValidKey } from './keyboard-validation.js';

const logger = createLogger('puppeteer:keyboard-shortcuts');

/**
 * Handle keyboard shortcut action
 * @param keys - Array of keys to press simultaneously
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 */
export async function handleKeyboardShortcut(
  keys: KeyInput[],
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing keyboard shortcut action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      keys,
    });

    // Validate all keys
    for (const key of keys) {
      if (!isValidKey(key)) {
        throw new Error(`Invalid key in shortcut: ${key}`);
      }
    }

    // Press all keys down
    for (const key of keys) {
      await page.keyboard.down(key);
    }

    // Release all keys in reverse order
    for (let i = keys.length - 1; i >= 0; i--) {
      const keyToRelease = keys[i];
      if (keyToRelease) {
        await page.keyboard.up(keyToRelease);
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Keyboard shortcut action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      keys,
      duration,
    });

    return {
      success: true,
      actionType: 'keyboardShortcut',
      data: {
        keys,
      },
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown keyboard shortcut error';

    logger.error('Keyboard shortcut action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      keys,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'keyboardShortcut',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        keys,
      },
    };
  }
}

/**
 * Handle key combination action (like Ctrl+C, Ctrl+V)
 * @param modifiers - Modifier keys (Ctrl, Shift, Alt, Meta)
 * @param key - Main key to press
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 */
export async function handleKeyCombination(
  modifiers: Array<'Control' | 'Shift' | 'Alt' | 'Meta'>,
  key: KeyInput,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing key combination action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      modifiers,
      key,
    });

    // Validate key
    if (!isValidKey(key)) {
      throw new Error(`Invalid key: ${key}`);
    }

    // Press modifiers down
    for (const modifier of modifiers) {
      await page.keyboard.down(modifier);
    }

    // Press main key
    await page.keyboard.press(key);

    // Release modifiers
    for (let i = modifiers.length - 1; i >= 0; i--) {
      const modifier = modifiers[i];
      if (modifier) {
        await page.keyboard.up(modifier);
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Key combination action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      modifiers,
      key,
      duration,
    });

    return {
      success: true,
      actionType: 'keyCombination',
      data: {
        modifiers,
        key,
      },
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown key combination error';

    logger.error('Key combination action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      modifiers,
      key,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'keyCombination',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        modifiers,
        key,
      },
    };
  }
}

/**
 * Handle type text action with keyboard
 * @param text - Text to type
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param delay - Optional delay between keystrokes
 * @returns Action result
 */
export async function handleKeyboardType(
  text: string,
  page: Page,
  context: ActionContext,
  delay?: number
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing keyboard type action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      textLength: text.length,
      delay,
    });

    // Validate text length
    if (text.length > 10000) {
      throw new Error('Text is too long for keyboard typing');
    }

    // Type text with optional delay
    await page.keyboard.type(text, {
      delay: delay ?? 0,
    });

    const duration = Date.now() - startTime;

    logger.info('Keyboard type action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      textLength: text.length,
      duration,
    });

    return {
      success: true,
      actionType: 'keyboardType',
      data: {
        textLength: text.length,
        delay: delay ?? 0,
      },
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown keyboard type error';

    logger.error('Keyboard type action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      textLength: text.length,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'keyboardType',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        textLength: text.length,
        delay,
      },
    };
  }
}