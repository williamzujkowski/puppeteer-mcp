/**
 * Content extraction action sub-validator
 * @module puppeteer/actions/execution/validation/content/content-extraction-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type {
  ContentAction,
  ActionContext,
  ValidationResult,
} from '../../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../../types.js';
import { BaseValidator } from '../base-validator.js';

/**
 * Valid content types
 */
const VALID_CONTENT_TYPES = ['text', 'html', 'markdown'] as const;

/**
 * Content extraction validator
 * @nist si-10 "Information input validation"
 */
export class ContentExtractionValidator extends BaseValidator {
  /**
   * Validate content extraction action
   * @param action - Content action
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: ContentAction, context: ActionContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    this.logger.debug('Validating content extraction action', {
      sessionId: context.sessionId,
      selector: action.selector,
    });

    // Validate selector
    this.validateSelector(action, errors);

    // Validate content type
    this.validateContentType(action, errors);

    // Additional validation for specific content types
    this.validateContentTypeSpecific(action, errors, warnings);

    return this.createResult(errors, warnings);
  }

  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns True for content actions
   */
  canValidate(action: { type: string }): boolean {
    return action.type === 'content';
  }

  /**
   * Validate selector
   */
  private validateSelector(action: ContentAction, errors: ValidationError[]): void {
    if (action.selector && typeof action.selector !== 'string') {
      this.addError(
        errors,
        'selector',
        'Selector must be a string',
        'INVALID_SELECTOR_TYPE'
      );
    }

    // Warn about complex selectors
    if (action.selector && action.selector.length > 500) {
      this.addError(
        errors,
        'selector',
        'Selector is too complex',
        'SELECTOR_TOO_COMPLEX'
      );
    }
  }

  /**
   * Validate content type
   */
  private validateContentType(action: ContentAction, errors: ValidationError[]): void {
    // Check if contentType exists on the action
    const contentAction = action as any;
    
    if ('contentType' in contentAction && contentAction.contentType) {
      this.validateEnum(
        contentAction.contentType,
        'contentType',
        VALID_CONTENT_TYPES,
        errors,
        'INVALID_CONTENT_TYPE'
      );
    }
  }

  /**
   * Validate content type specific options
   */
  private validateContentTypeSpecific(
    action: ContentAction,
    _errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    const contentAction = action as any;
    
    // If markdown is requested, warn about potential formatting issues
    if (contentAction.contentType === 'markdown') {
      this.addWarning(
        warnings,
        'contentType',
        'Markdown extraction may not preserve all formatting',
        'MARKDOWN_FORMATTING_WARNING'
      );
    }

    // If no selector is provided, warn about full page extraction
    if (!action.selector) {
      this.addWarning(
        warnings,
        'selector',
        'No selector provided - will extract full page content',
        'FULL_PAGE_EXTRACTION'
      );
    }

    // Check for potentially slow selectors
    if (action.selector) {
      const slowPatterns = [
        ':contains',
        ':has',
        '*',
        '> *',
        '+ *',
        '~ *'
      ];
      
      if (slowPatterns.some(pattern => action.selector!.includes(pattern))) {
        this.addWarning(
          warnings,
          'selector',
          'Selector may be slow on large pages',
          'POTENTIALLY_SLOW_SELECTOR'
        );
      }
    }
  }
}