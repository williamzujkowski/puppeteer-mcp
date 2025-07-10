/**
 * Content action validators (screenshot, PDF, content)
 * @module puppeteer/actions/execution/validation/content-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
  ScreenshotAction as _ScreenshotAction,
  PDFAction as _PDFAction,
  ContentAction as _ContentAction,
} from '../../../interfaces/action-executor.interface.js';
// import type { ValidationError } from '../types.js';
import { BaseValidator } from './base-validator.js';
import { ScreenshotSubValidator } from './content/screenshot-validator.js';
import { PDFSubValidator } from './content/pdf-validator.js';
import { ContentExtractionValidator } from './content/content-extraction-validator.js';

/**
 * Validates content-related actions
 * @nist si-10 "Information input validation"
 */
export class ContentValidator extends BaseValidator {
  /**
   * Supported action types
   */
  private readonly supportedTypes = ['screenshot', 'pdf', 'content'];
  
  private readonly screenshotValidator = new ScreenshotSubValidator();
  private readonly pdfValidator = new PDFSubValidator();
  private readonly contentExtractionValidator = new ContentExtractionValidator();

  /**
   * Validate content action
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    this.logger.debug('Validating content action', {
      sessionId: context.sessionId,
      actionType: action.type,
    });

    switch (action.type) {
      case 'screenshot':
        return this.screenshotValidator.validate(action, context);
      case 'pdf':
        return this.pdfValidator.validate(action, context);
      case 'content':
        return this.contentExtractionValidator.validate(action, context);
      default:
        return this.createResult([{
          field: 'type',
          message: `Unknown content action type: ${action.type}`,
          code: 'UNKNOWN_CONTENT_ACTION',
        }]);
    }
  }

  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns True if action is content type
   */
  canValidate(action: BrowserAction): boolean {
    return this.supportedTypes.includes(action.type);
  }

}

// Re-export sub-validators for direct use if needed
export { ScreenshotSubValidator } from './content/screenshot-validator.js';
export { PDFSubValidator } from './content/pdf-validator.js';
export { ContentExtractionValidator } from './content/content-extraction-validator.js';