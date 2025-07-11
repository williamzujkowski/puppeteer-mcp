/**
 * Interaction action validators (click, type, select, keyboard, mouse)
 * @module puppeteer/actions/execution/validation/interaction-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
  ClickAction,
  TypeAction,
  SelectAction,
  KeyboardAction,
  MouseAction,
} from '../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../types.js';
import { BaseValidator } from './base-validator.js';

/**
 * Valid mouse buttons
 */
const VALID_MOUSE_BUTTONS = ['left', 'right', 'middle'] as const;

/**
 * Valid keyboard actions
 */
const VALID_KEYBOARD_ACTIONS = ['press', 'down', 'up'] as const;

/**
 * Valid mouse actions
 */
const VALID_MOUSE_ACTIONS = ['move', 'down', 'up', 'wheel'] as const;

/**
 * Validates interaction actions
 * @nist si-10 "Information input validation"
 */
export class InteractionValidator extends BaseValidator {
  /**
   * Supported action types
   */
  private readonly supportedTypes = ['click', 'type', 'select', 'keyboard', 'mouse'];

  /**
   * Validate interaction action
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    this.logger.debug('Validating interaction action', {
      sessionId: context.sessionId,
      actionType: action.type,
    });

    switch (action.type) {
      case 'click':
        this.validateClickAction(action, errors);
        break;
      case 'type':
        this.validateTypeAction(action, errors, warnings);
        break;
      case 'select':
        this.validateSelectAction(action, errors);
        break;
      case 'keyboard':
        this.validateKeyboardAction(action, errors);
        break;
      case 'mouse':
        this.validateMouseAction(action, errors);
        break;
    }

    // Common selector validation
    this.validateSelector(action, warnings);

    return this.createResult(errors, warnings);
  }

  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns True if action is interaction type
   */
  canValidate(action: BrowserAction): boolean {
    return this.supportedTypes.includes(action.type);
  }

  /**
   * Validate click action
   * @param action - Click action
   * @param errors - Error collection
   */
  private validateClickAction(action: ClickAction, errors: ValidationError[]): void {
    // Validate selector
    this.validateRequiredString(action.selector, 'selector', errors, 'MISSING_SELECTOR');

    // Validate click count
    if (action.clickCount !== undefined) {
      this.validateNumericRange(
        action.clickCount,
        'clickCount',
        1,
        10,
        errors,
        'INVALID_CLICK_COUNT',
      );
    }

    // Validate button
    if (action.button) {
      this.validateEnum(
        action.button,
        'button',
        VALID_MOUSE_BUTTONS,
        errors,
        'INVALID_MOUSE_BUTTON',
      );
    }

    // Validate coordinates
    if (action.offsetX !== undefined || action.offsetY !== undefined) {
      if (typeof action.offsetX !== 'number' || typeof action.offsetY !== 'number') {
        this.addError(
          errors,
          'offset',
          'Both offsetX and offsetY must be numbers',
          'INVALID_OFFSET',
        );
      }
    }
  }

  /**
   * Validate type action
   * @param action - Type action
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private validateTypeAction(
    action: TypeAction,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    // Validate selector
    this.validateRequiredString(action.selector, 'selector', errors, 'MISSING_SELECTOR');

    // Validate text
    if (action.text === undefined || action.text === null) {
      this.addError(errors, 'text', 'Text is required for type action', 'MISSING_TEXT');
    } else {
      // Warn about very long text
      if (action.text.length > 10000) {
        this.addWarning(
          warnings,
          'text',
          'Text is very long and may cause performance issues',
          'LONG_TEXT',
        );
      }

      // Warn about potential sensitive data
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /api[_-]?key/i,
        /token/i,
        /credit[_-]?card/i,
        /ssn/i,
      ];

      if (sensitivePatterns.some((pattern) => pattern.test(action.selector))) {
        this.addWarning(
          warnings,
          'selector',
          'Selector suggests sensitive data entry',
          'SENSITIVE_DATA_WARNING',
        );
      }
    }

    // Validate delay
    if (action.delay !== undefined) {
      this.validateNumericRange(action.delay, 'delay', 0, 5000, errors, 'INVALID_DELAY');
    }
  }

  /**
   * Validate select action
   * @param action - Select action
   * @param errors - Error collection
   */
  private validateSelectAction(action: SelectAction, errors: ValidationError[]): void {
    // Validate selector
    this.validateRequiredString(action.selector, 'selector', errors, 'MISSING_SELECTOR');

    // Validate values
    if (!this.validateArray<string>(action.values, 'values', errors, 'MISSING_VALUES')) {
      return;
    }

    // Validate each value
    action.values.forEach((value, index) => {
      if (typeof value !== 'string') {
        this.addError(
          errors,
          `values[${index}]`,
          'Select value must be a string',
          'INVALID_SELECT_VALUE',
        );
      }
    });
  }

  /**
   * Validate keyboard action
   * @param action - Keyboard action
   * @param errors - Error collection
   */
  private validateKeyboardAction(action: KeyboardAction, errors: ValidationError[]): void {
    // Validate key
    this.validateRequiredString(action.key, 'key', errors, 'MISSING_KEY');

    // Validate action type
    if (!action.action) {
      this.addError(
        errors,
        'action',
        'Keyboard action type is required',
        'MISSING_KEYBOARD_ACTION',
      );
    } else {
      this.validateEnum(
        action.action,
        'action',
        VALID_KEYBOARD_ACTIONS,
        errors,
        'INVALID_KEYBOARD_ACTION',
      );
    }

    // Validate modifiers
    if (action.modifiers) {
      const validModifiers = ['Alt', 'Control', 'Meta', 'Shift'];
      if (!Array.isArray(action.modifiers)) {
        this.addError(errors, 'modifiers', 'Modifiers must be an array', 'INVALID_MODIFIERS');
      } else {
        action.modifiers.forEach((modifier, index) => {
          if (!validModifiers.includes(modifier)) {
            this.addError(
              errors,
              `modifiers[${index}]`,
              `Invalid modifier: ${modifier}`,
              'INVALID_MODIFIER',
            );
          }
        });
      }
    }
  }

  /**
   * Validate mouse action
   * @param action - Mouse action
   * @param errors - Error collection
   */
  private validateMouseAction(action: MouseAction, errors: ValidationError[]): void {
    // Validate action type
    if (!action.action) {
      this.addError(errors, 'action', 'Mouse action type is required', 'MISSING_MOUSE_ACTION');
    } else {
      this.validateEnum(
        action.action,
        'action',
        VALID_MOUSE_ACTIONS,
        errors,
        'INVALID_MOUSE_ACTION',
      );
    }

    // Validate coordinates for move action
    if (action.action === 'move' && (action.x === undefined || action.y === undefined)) {
      this.addError(errors, 'x/y', 'Coordinates required for move action', 'MISSING_COORDINATES');
    }

    // Validate wheel action
    if (action.action === 'wheel') {
      if (action.deltaX === undefined && action.deltaY === undefined) {
        this.addError(
          errors,
          'deltaX/deltaY',
          'Delta values required for wheel action',
          'MISSING_DELTA',
        );
      }
    }

    // Validate button
    if (action.button) {
      this.validateEnum(
        action.button,
        'button',
        VALID_MOUSE_BUTTONS,
        errors,
        'INVALID_MOUSE_BUTTON',
      );
    }
  }

  /**
   * Validate selector for suspicious content
   * @param action - Action with selector
   * @param warnings - Warning collection
   */
  private validateSelector(action: BrowserAction, warnings: ValidationError[]): void {
    const selector = (action as { selector?: string }).selector;
    if (!selector) return;

    const suspiciousPatterns = [
      /javascript:/i,
      /vbscript:/i,
      /data:/i,
      /<script/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(selector)) {
        this.addWarning(
          warnings,
          'selector',
          'Selector contains potentially suspicious content',
          'SUSPICIOUS_SELECTOR',
        );
        break;
      }
    }
  }
}
