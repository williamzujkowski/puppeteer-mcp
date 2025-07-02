/**
 * Keyboard action handlers for browser automation
 * @module puppeteer/actions/handlers/keyboard
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page, KeyInput } from 'puppeteer';
import type { 
  KeyboardAction,
  ActionResult, 
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:keyboard');

/**
 * Valid key inputs for security validation
 */
const VALID_KEYS: KeyInput[] = [
  'Backspace', 'Tab', 'Enter', 'Shift', 'Control', 'Alt', 'Pause', 'CapsLock',
  'Escape', 'Space', 'PageUp', 'PageDown', 'End', 'Home', 'ArrowLeft', 'ArrowUp',
  'ArrowRight', 'ArrowDown', 'Insert', 'Delete', 'Digit0', 'Digit1', 'Digit2',
  'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
  'KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyH', 'KeyI',
  'KeyJ', 'KeyK', 'KeyL', 'KeyM', 'KeyN', 'KeyO', 'KeyP', 'KeyQ', 'KeyR',
  'KeyS', 'KeyT', 'KeyU', 'KeyV', 'KeyW', 'KeyX', 'KeyY', 'KeyZ',
  'MetaLeft', 'MetaRight', 'ContextMenu', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'NumLock', 'ScrollLock',
  'Semicolon', 'Equal', 'Comma', 'Minus', 'Period', 'Slash', 'Backquote',
  'BracketLeft', 'Backslash', 'BracketRight', 'Quote',
];

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
  context: ActionContext
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
      delay: delay || 0,
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
        delay: delay || 0,
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
 * Validate if a key is valid and safe
 * @param key - Key to validate
 * @returns True if valid
 * @nist si-10 "Information input validation"
 */
function isValidKey(key: KeyInput): boolean {
  // Allow standard keys and single characters
  if (VALID_KEYS.includes(key)) {
    return true;
  }

  // Allow single printable characters
  if (typeof key === 'string' && key.length === 1) {
    const charCode = key.charCodeAt(0);
    // Allow printable ASCII characters (32-126)
    return charCode >= 32 && charCode <= 126;
  }

  return false;
}