/**
 * Control flow validators (wait, scroll, evaluate)
 * @module puppeteer/actions/execution/validation/control-flow-validator
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
  WaitAction,
  ScrollAction,
  EvaluateAction,
} from '../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../types.js';
import { BaseValidator } from './base-validator.js';

/**
 * Valid wait types
 */
const VALID_WAIT_TYPES = ['selector', 'navigation', 'timeout', 'function'] as const;

/**
 * Valid scroll directions
 */
const VALID_SCROLL_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

/**
 * Dangerous JavaScript patterns for evaluation
 */
const DANGEROUS_PATTERNS = [
  { pattern: /eval\s*\(/, name: 'eval' },
  { pattern: /Function\s*\(/, name: 'Function constructor' },
  { pattern: /setTimeout\s*\(/, name: 'setTimeout' },
  { pattern: /setInterval\s*\(/, name: 'setInterval' },
  { pattern: /import\s*\(/, name: 'dynamic import' },
  { pattern: /require\s*\(/, name: 'require' },
  { pattern: /fetch\s*\(/, name: 'fetch' },
  { pattern: /XMLHttpRequest/, name: 'XMLHttpRequest' },
  { pattern: /\.innerHTML\s*=/, name: 'innerHTML assignment' },
  { pattern: /document\.write/, name: 'document.write' },
  { pattern: /window\.location/, name: 'location manipulation' },
  { pattern: /document\.cookie/, name: 'cookie access' },
];

/**
 * Validates control flow actions
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 */
export class ControlFlowValidator extends BaseValidator {
  /**
   * Supported action types
   */
  private readonly supportedTypes = ['wait', 'scroll', 'evaluate'];

  /**
   * Validate control flow action
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    this.logger.debug('Validating control flow action', {
      sessionId: context.sessionId,
      actionType: action.type,
    });

    switch (action.type) {
      case 'wait':
        this.validateWaitAction(action, errors);
        break;
      case 'scroll':
        this.validateScrollAction(action, errors, warnings);
        break;
      case 'evaluate':
        await this.validateEvaluateAction(action, context, errors, warnings);
        break;
    }

    return this.createResult(errors, warnings);
  }

  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns True if action is control flow type
   */
  canValidate(action: BrowserAction): boolean {
    return this.supportedTypes.includes(action.type);
  }

  /**
   * Validate wait action
   * @param action - Wait action
   * @param errors - Error collection
   */
  private validateWaitAction(action: WaitAction, errors: ValidationError[]): void {
    // Validate wait type
    if (!action.waitType) {
      this.addError(errors, 'waitType', 'Wait type is required', 'MISSING_WAIT_TYPE');
      return;
    }

    this.validateEnum(
      action.waitType,
      'waitType',
      VALID_WAIT_TYPES,
      errors,
      'INVALID_WAIT_TYPE'
    );

    // Type-specific validation
    switch (action.waitType) {
      case 'selector':
        if (!this.validateRequiredString(action.selector, 'selector', errors, 'MISSING_SELECTOR_FOR_WAIT')) {
          break;
        }
        // Validate visible/hidden options
        if (action.visible === true && action.hidden === true) {
          this.addError(
            errors,
            'visible/hidden',
            'Cannot wait for element to be both visible and hidden',
            'CONFLICTING_VISIBILITY'
          );
        }
        break;

      case 'timeout':
        if (action.duration === undefined || action.duration === null) {
          this.addError(errors, 'duration', 'Duration required for timeout wait', 'MISSING_DURATION_FOR_WAIT');
        } else {
          this.validateNumericRange(
            action.duration,
            'duration',
            0,
            300000, // 5 minutes max
            errors,
            'INVALID_DURATION'
          );
        }
        break;

      case 'function':
        if (!this.validateRequiredString(action.function, 'function', errors, 'MISSING_FUNCTION_FOR_WAIT')) {
          break;
        }
        // Additional function validation
        this.validateJavaScriptFunction(action.function, errors);
        break;

      case 'navigation':
        // Navigation wait has no additional required fields
        if (action.waitUntil && !['load', 'domcontentloaded', 'networkidle0', 'networkidle2'].includes(action.waitUntil)) {
          this.addError(
            errors,
            'waitUntil',
            'Invalid waitUntil value for navigation wait',
            'INVALID_WAIT_UNTIL'
          );
        }
        break;
    }
  }

  /**
   * Validate scroll action
   * @param action - Scroll action
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private validateScrollAction(
    action: ScrollAction,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // At least one scroll parameter required
    if (!action.direction && !action.selector && action.x === undefined && action.y === undefined) {
      this.addError(
        errors,
        'scroll',
        'At least one scroll parameter required (direction, selector, or coordinates)',
        'MISSING_SCROLL_PARAMS'
      );
      return;
    }

    // Validate direction
    if (action.direction) {
      this.validateEnum(
        action.direction,
        'direction',
        VALID_SCROLL_DIRECTIONS,
        errors,
        'INVALID_SCROLL_DIRECTION'
      );
    }

    // Validate distance
    if (action.distance !== undefined) {
      this.validateNumericRange(
        action.distance,
        'distance',
        0,
        Number.MAX_SAFE_INTEGER,
        errors,
        'INVALID_DISTANCE'
      );
    }

    // Validate coordinates
    if (action.x !== undefined || action.y !== undefined) {
      if (action.x !== undefined && typeof action.x !== 'number') {
        this.addError(errors, 'x', 'X coordinate must be a number', 'INVALID_X_COORDINATE');
      }
      if (action.y !== undefined && typeof action.y !== 'number') {
        this.addError(errors, 'y', 'Y coordinate must be a number', 'INVALID_Y_COORDINATE');
      }
    }

    // Warn about conflicting parameters
    if (action.selector && (action.x !== undefined || action.y !== undefined)) {
      this.addWarning(
        warnings,
        'scroll',
        'Both selector and coordinates provided; coordinates will be ignored',
        'CONFLICTING_SCROLL_PARAMS'
      );
    }

    // Validate duration for smooth scrolling
    if (action.smooth && action.duration !== undefined) {
      this.validateNumericRange(
        action.duration,
        'duration',
        0,
        10000, // 10 seconds max
        errors,
        'INVALID_SCROLL_DURATION'
      );
    }
  }

  /**
   * Validate evaluate action
   * @param action - Evaluate action
   * @param context - Execution context
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private async validateEvaluateAction(
    action: EvaluateAction,
    context: ActionContext,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): Promise<void> {
    // Validate function
    if (!this.validateRequiredString(action.function, 'function', errors, 'MISSING_FUNCTION')) {
      return;
    }

    // Basic syntax validation
    this.validateJavaScriptFunction(action.function, errors);

    // Security validation
    await this.validateEvaluationSecurity(action, context, errors, warnings);

    // Validate arguments
    if (action.args !== undefined) {
      if (!Array.isArray(action.args)) {
        this.addError(errors, 'args', 'Arguments must be an array', 'INVALID_ARGS');
      } else {
        // Check for non-serializable arguments
        action.args.forEach((arg, index) => {
          if (!this.isSerializable(arg)) {
            this.addError(
              errors,
              `args[${index}]`,
              'Argument contains non-serializable values',
              'NON_SERIALIZABLE_ARG'
            );
          }
        });
      }
    }
  }

  /**
   * Validate JavaScript function syntax
   * @param func - Function string
   * @param errors - Error collection
   */
  private validateJavaScriptFunction(func: string, errors: ValidationError[]): void {
    // Check for basic syntax errors
    try {
      // Simple syntax check - try to parse as function
      new Function(func);
    } catch (error) {
      this.addError(
        errors,
        'function',
        'Invalid JavaScript syntax',
        'INVALID_JAVASCRIPT'
      );
    }

    // Check length
    if (func.length > 50000) {
      this.addError(
        errors,
        'function',
        'Function is too long (max 50000 characters)',
        'FUNCTION_TOO_LONG'
      );
    }
  }

  /**
   * Validate evaluation security
   * @param action - Evaluate action
   * @param context - Execution context
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private async validateEvaluationSecurity(
    action: EvaluateAction,
    context: ActionContext,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): Promise<void> {
    const func = action.function;

    // Check for dangerous patterns
    for (const { pattern, name } of DANGEROUS_PATTERNS) {
      if (pattern.test(func)) {
        this.addWarning(
          warnings,
          'function',
          `Function contains potentially dangerous pattern: ${name}`,
          'DANGEROUS_FUNCTION'
        );
      }
    }

    // Check for potential XSS patterns
    const xssPatterns = [
      /<script[\s>]/i,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(func)) {
        this.addError(
          errors,
          'function',
          'Function contains potential XSS patterns',
          'POTENTIAL_XSS'
        );
        break;
      }
    }

    // Warn about DOM manipulation
    if (/\.innerHTML|\.outerHTML|document\.write/.test(func)) {
      this.addWarning(
        warnings,
        'function',
        'Function performs DOM manipulation which may have security implications',
        'DOM_MANIPULATION'
      );
    }

    // Check if evaluation is allowed in context
    if (context.restrictedMode && !context.allowEvaluation) {
      this.addError(
        errors,
        'function',
        'JavaScript evaluation is not allowed in restricted mode',
        'EVALUATION_RESTRICTED'
      );
    }
  }

  /**
   * Check if value is serializable
   * @param value - Value to check
   * @returns True if serializable
   */
  private isSerializable(value: unknown): boolean {
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }
}