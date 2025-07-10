/**
 * Base validator interface and abstract class
 * @module puppeteer/actions/execution/validation/base-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
} from '../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../types.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:base-validator');

/**
 * Validator interface
 * @nist si-10 "Information input validation"
 */
export interface IActionValidator {
  /**
   * Validate an action
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult>;
  
  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns True if validator can handle action
   */
  canValidate(action: BrowserAction): boolean;
}

/**
 * Base validator with common functionality
 * @nist si-10 "Information input validation"
 */
export abstract class BaseValidator implements IActionValidator {
  protected readonly logger = logger;

  /**
   * Validate an action
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  abstract validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult>;
  
  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns True if validator can handle action
   */
  abstract canValidate(action: BrowserAction): boolean;

  /**
   * Create validation result
   * @param errors - Validation errors
   * @param warnings - Validation warnings
   * @returns Validation result
   */
  protected createResult(
    errors: ValidationError[],
    warnings: ValidationError[] = []
  ): ValidationResult {
    return {
      valid: errors.length === 0,
      errors: errors.map(e => ({
        field: e.field,
        message: e.message,
        code: e.code || 'VALIDATION_ERROR',
      })),
      warnings: warnings.map(w => ({
        field: w.field,
        message: w.message,
        code: w.code || 'VALIDATION_WARNING',
      })),
    };
  }

  /**
   * Add error to collection
   * @param errors - Error collection
   * @param field - Field name
   * @param message - Error message
   * @param code - Error code
   */
  protected addError(
    errors: ValidationError[],
    field: string,
    message: string,
    code: string
  ): void {
    errors.push({ field, message, code });
  }

  /**
   * Add warning to collection
   * @param warnings - Warning collection
   * @param field - Field name
   * @param message - Warning message
   * @param code - Warning code
   */
  protected addWarning(
    warnings: ValidationError[],
    field: string,
    message: string,
    code: string
  ): void {
    warnings.push({ field, message, code });
  }

  /**
   * Validate required string field
   * @param value - Field value
   * @param fieldName - Field name
   * @param errors - Error collection
   * @param errorCode - Error code
   * @returns True if valid
   */
  protected validateRequiredString(
    value: unknown,
    fieldName: string,
    errors: ValidationError[],
    errorCode: string = 'MISSING_FIELD'
  ): value is string {
    if (!value || typeof value !== 'string') {
      this.addError(errors, fieldName, `${fieldName} is required`, errorCode);
      return false;
    }
    return true;
  }

  /**
   * Validate numeric range
   * @param value - Field value
   * @param fieldName - Field name
   * @param min - Minimum value
   * @param max - Maximum value
   * @param errors - Error collection
   * @param errorCode - Error code
   * @returns True if valid
   */
  protected validateNumericRange(
    value: unknown,
    fieldName: string,
    min: number,
    max: number,
    errors: ValidationError[],
    errorCode: string = 'INVALID_RANGE'
  ): boolean {
    if (typeof value !== 'number') {
      return true; // Not a number, skip range validation
    }
    
    if (value < min || value > max) {
      this.addError(
        errors,
        fieldName,
        `${fieldName} must be between ${min} and ${max}`,
        errorCode
      );
      return false;
    }
    return true;
  }

  /**
   * Validate enum value
   * @param value - Field value
   * @param fieldName - Field name
   * @param validValues - Valid enum values
   * @param errors - Error collection
   * @param errorCode - Error code
   * @returns True if valid
   */
  protected validateEnum<T>(
    value: unknown,
    fieldName: string,
    validValues: readonly T[],
    errors: ValidationError[],
    errorCode: string = 'INVALID_VALUE'
  ): value is T {
    if (!validValues.includes(value as T)) {
      this.addError(
        errors,
        fieldName,
        `Invalid ${fieldName} value. Must be one of: ${validValues.join(', ')}`,
        errorCode
      );
      return false;
    }
    return true;
  }

  /**
   * Validate array field
   * @param value - Field value
   * @param fieldName - Field name
   * @param errors - Error collection
   * @param errorCode - Error code
   * @param minLength - Minimum array length
   * @returns True if valid
   */
  protected validateArray<T>(
    value: unknown,
    fieldName: string,
    errors: ValidationError[],
    errorCode: string = 'INVALID_ARRAY',
    minLength: number = 1
  ): value is T[] {
    if (!Array.isArray(value)) {
      this.addError(errors, fieldName, `${fieldName} must be an array`, errorCode);
      return false;
    }
    
    if (value.length < minLength) {
      this.addError(
        errors,
        fieldName,
        `${fieldName} must have at least ${minLength} item(s)`,
        errorCode
      );
      return false;
    }
    
    return true;
  }
}