/**
 * Action validation and parameter checking module
 * @module puppeteer/actions/execution/action-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 * 
 * This file maintains backward compatibility while delegating to modular validators
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
} from '../../interfaces/action-executor.interface.js';
import { 
  ValidationOrchestrator, 
  actionValidator as orchestrator
} from './validation/index.js';
import { validateAction as originalValidateAction } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:action-validator');

/**
 * Comprehensive action validator
 * @nist si-10 "Information input validation"
 * @deprecated Use ValidationOrchestrator from ./validation/index.js instead
 */
export class ActionValidator {
  private readonly orchestrator: ValidationOrchestrator;

  constructor() {
    this.orchestrator = new ValidationOrchestrator();
    logger.warn('ActionValidator is deprecated. Use ValidationOrchestrator from ./validation/index.js instead');
  }

  /**
   * Validate a browser action
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  validate(action: BrowserAction, _context: ActionContext): ValidationResult {
    // For now, use the original validation function to maintain compatibility
    // Note: context parameter is preserved for API compatibility
    return originalValidateAction(action);
  }

  /**
   * Validate multiple actions
   * @param actions - Actions to validate
   * @param context - Execution context
   * @returns Array of validation results
   */
  async validateBatch(
    actions: BrowserAction[],
    context: ActionContext,
  ): Promise<ValidationResult[]> {
    return this.orchestrator.validateBatch(actions, context);
  }
}

// Re-export everything from the modular validators for backward compatibility
export * from './validation/index.js';
export * from './validation/base-validator.js';
export * from './validation/validator-factory.js';

// Export singleton instance for backward compatibility
export const actionValidator = orchestrator;

/**
 * Validate action function for backward compatibility
 * @param action - Browser action to validate
 * @returns Validation result
 * @deprecated Use actionValidator.validate() or ValidationOrchestrator instead
 */
export function validateAction(action: BrowserAction): ValidationResult {
  // Use the original validation function for backward compatibility
  return originalValidateAction(action);
}