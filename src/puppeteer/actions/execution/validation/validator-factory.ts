/**
 * Factory for creating action validators
 * @module puppeteer/actions/execution/validation/validator-factory
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type { IActionValidator } from './base-validator.js';
import { StructuralValidator } from './structural-validator.js';
import { NavigationValidator } from './navigation-validator.js';
import { InteractionValidator } from './interaction-validator.js';
import { ContentValidator } from './content-validator.js';
import { ControlFlowValidator } from './control-flow-validator.js';
import { DataValidator } from './data-validator.js';
import { SecurityValidator } from './security-validator.js';
import type { BrowserAction } from '../../../interfaces/action-executor.interface.js';

/**
 * Validator types enum
 */
export enum ValidatorType {
  STRUCTURAL = 'structural',
  NAVIGATION = 'navigation',
  INTERACTION = 'interaction',
  CONTENT = 'content',
  CONTROL_FLOW = 'control_flow',
  DATA = 'data',
  SECURITY = 'security',
}

/**
 * Factory for creating validators
 * @nist si-10 "Information input validation"
 */
export class ValidatorFactory {
  private static validators: Map<ValidatorType, IActionValidator> = new Map();
  private static initialized = false;

  /**
   * Initialize validators (lazy loading)
   */
  private static initialize(): void {
    if (this.initialized) return;

    this.validators.set(ValidatorType.STRUCTURAL, new StructuralValidator());
    this.validators.set(ValidatorType.NAVIGATION, new NavigationValidator());
    this.validators.set(ValidatorType.INTERACTION, new InteractionValidator());
    this.validators.set(ValidatorType.CONTENT, new ContentValidator());
    this.validators.set(ValidatorType.CONTROL_FLOW, new ControlFlowValidator());
    this.validators.set(ValidatorType.DATA, new DataValidator());
    this.validators.set(ValidatorType.SECURITY, new SecurityValidator());

    this.initialized = true;
  }

  /**
   * Get validator by type
   * @param type - Validator type
   * @returns Validator instance
   */
  static getValidator(type: ValidatorType): IActionValidator {
    this.initialize();
    
    const validator = this.validators.get(type);
    if (!validator) {
      throw new Error(`Unknown validator type: ${type}`);
    }
    
    return validator;
  }

  /**
   * Get all validators
   * @returns All validator instances
   */
  static getAllValidators(): IActionValidator[] {
    this.initialize();
    return Array.from(this.validators.values());
  }

  /**
   * Get validators for specific action
   * @param action - Action to get validators for
   * @returns Applicable validators
   */
  static getValidatorsForAction(action: BrowserAction): IActionValidator[] {
    this.initialize();
    
    const validators: IActionValidator[] = [];
    
    // Always include structural and security validators
    validators.push(this.validators.get(ValidatorType.STRUCTURAL)!);
    validators.push(this.validators.get(ValidatorType.SECURITY)!);
    
    // Add type-specific validators
    for (const [type, validator] of this.validators) {
      if (type !== ValidatorType.STRUCTURAL && 
          type !== ValidatorType.SECURITY && 
          validator.canValidate(action)) {
        validators.push(validator);
      }
    }
    
    return validators;
  }

  /**
   * Register custom validator
   * @param type - Validator type
   * @param validator - Validator instance
   */
  static registerValidator(type: ValidatorType | string, validator: IActionValidator): void {
    this.initialize();
    this.validators.set(type as ValidatorType, validator);
  }

  /**
   * Clear all validators (mainly for testing)
   */
  static clear(): void {
    this.validators.clear();
    this.initialized = false;
  }
}