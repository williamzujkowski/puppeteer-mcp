/**
 * Structural validation for basic action structure and context
 * @module puppeteer/actions/execution/validation/structural-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
} from '../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../types.js';
import { BaseValidator } from './base-validator.js';

/**
 * Validates basic action structure and context
 * @nist si-10 "Information input validation"
 */
export class StructuralValidator extends BaseValidator {
  /**
   * Validate action structure and context
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    this.logger.debug('Validating action structure', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType: action.type,
    });

    // Validate basic structure
    this.validateBasicStructure(action, errors);
    
    // Validate context
    this.validateContext(context, errors);
    
    // Validate timeout
    this.validateTimeout(action, errors);

    return this.createResult(errors, warnings);
  }

  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns Always true for structural validation
   */
  canValidate(action: BrowserAction): boolean {
    return true; // Structural validation applies to all actions
  }

  /**
   * Validate basic action structure
   * @param action - Action to validate
   * @param errors - Error collection
   */
  private validateBasicStructure(action: BrowserAction, errors: ValidationError[]): void {
    // Validate action type
    if (!action.type) {
      this.addError(errors, 'type', 'Action type is required', 'MISSING_TYPE');
    }

    // Validate page ID
    if (!action.pageId) {
      this.addError(errors, 'pageId', 'Page ID is required', 'MISSING_PAGE_ID');
    }
  }

  /**
   * Validate execution context
   * @param context - Context to validate
   * @param errors - Error collection
   */
  private validateContext(context: ActionContext, errors: ValidationError[]): void {
    // Validate session ID
    if (!context.sessionId) {
      this.addError(
        errors,
        'context.sessionId',
        'Session ID is required',
        'MISSING_SESSION_ID'
      );
    }

    // Validate context ID
    if (!context.contextId) {
      this.addError(
        errors,
        'context.contextId',
        'Context ID is required',
        'MISSING_CONTEXT_ID'
      );
    }

    // Validate user ID if authentication is required
    if (context.requiresAuth && !context.userId) {
      this.addError(
        errors,
        'context.userId',
        'User ID is required for authenticated actions',
        'MISSING_USER_ID'
      );
    }
  }

  /**
   * Validate timeout value
   * @param action - Action to validate
   * @param errors - Error collection
   */
  private validateTimeout(action: BrowserAction, errors: ValidationError[]): void {
    if (action.timeout !== undefined) {
      this.validateNumericRange(
        action.timeout,
        'timeout',
        0,
        300000, // 5 minutes max
        errors,
        'INVALID_TIMEOUT'
      );
    }
  }
}