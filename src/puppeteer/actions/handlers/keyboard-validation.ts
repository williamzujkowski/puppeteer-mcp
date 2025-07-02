/**
 * Keyboard validation utilities
 * @module puppeteer/actions/handlers/keyboard-validation
 * @nist si-10 "Information input validation"
 */

import type { KeyInput } from 'puppeteer';

/**
 * Valid key inputs for security validation
 */
export const VALID_KEYS: KeyInput[] = [
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
 * Validate if a key is valid and safe
 * @param key - Key to validate
 * @returns True if valid
 * @nist si-10 "Information input validation"
 */
export function isValidKey(key: KeyInput): boolean {
  // Allow standard keys
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