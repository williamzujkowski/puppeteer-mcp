/**
 * PDF action sub-validator
 * @module puppeteer/actions/execution/validation/content/pdf-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type {
  PDFAction,
  ActionContext,
  ValidationResult,
} from '../../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../../types.js';
import { BaseValidator } from '../base-validator.js';

/**
 * Valid PDF formats
 */
const VALID_PDF_FORMATS = [
  'letter', 'legal', 'tabloid', 'ledger',
  'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'
] as const;

/**
 * PDF-specific validator
 * @nist si-10 "Information input validation"
 */
export class PDFSubValidator extends BaseValidator {
  /**
   * Validate PDF action
   * @param action - PDF action
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: PDFAction, context: ActionContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    this.logger.debug('Validating PDF action', {
      sessionId: context.sessionId,
      format: action.format,
      scale: action.scale,
    });

    // Validate format
    this.validateFormat(action, errors);

    // Validate scale
    this.validateScale(action, errors);

    // Validate margins
    if (action.margin) {
      this.validateMargins(action.margin, errors);
    }

    // Validate page ranges
    if (action.pageRanges) {
      this.validatePageRanges(action.pageRanges, errors);
    }

    // Validate dimensions
    this.validateDimensions(action, errors);

    // Validate print options
    this.validatePrintOptions(action, errors, warnings);

    // Validate header/footer
    this.validateHeaderFooter(action, errors);

    return this.createResult(errors, warnings);
  }

  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns True for PDF actions
   */
  canValidate(action: { type: string }): boolean {
    return action.type === 'pdf';
  }

  /**
   * Validate PDF format
   */
  private validateFormat(action: PDFAction, errors: ValidationError[]): void {
    if (action.format) {
      this.validateEnum(
        action.format,
        'format',
        VALID_PDF_FORMATS,
        errors,
        'INVALID_PDF_FORMAT'
      );
    }
  }

  /**
   * Validate scale
   */
  private validateScale(action: PDFAction, errors: ValidationError[]): void {
    if (action.scale !== undefined) {
      this.validateNumericRange(
        action.scale,
        'scale',
        0.1,
        2,
        errors,
        'INVALID_SCALE'
      );
    }
  }

  /**
   * Validate margins
   */
  private validateMargins(
    margin: { top?: string | number; right?: string | number; bottom?: string | number; left?: string | number },
    errors: ValidationError[]
  ): void {
    const marginFields = ['top', 'right', 'bottom', 'left'];
    
    for (const field of marginFields) {
      const value = margin[field as keyof typeof margin];
      if (value !== undefined) {
        if (typeof value === 'number' && value < 0) {
          this.addError(
            errors,
            `margin.${field}`,
            `Margin ${field} must be non-negative`,
            'NEGATIVE_MARGIN'
          );
        } else if (typeof value === 'string' && !this.isValidCSSUnit(value)) {
          this.addError(
            errors,
            `margin.${field}`,
            `Invalid margin ${field} format`,
            'INVALID_MARGIN_FORMAT'
          );
        }
      }
    }
  }

  /**
   * Validate page ranges
   */
  private validatePageRanges(pageRanges: string, errors: ValidationError[]): void {
    const rangePattern = /^(\d+(-\d+)?)(,\d+(-\d+)?)*$/;
    if (!rangePattern.test(pageRanges)) {
      this.addError(
        errors,
        'pageRanges',
        'Invalid page range format. Use format like "1-5, 8, 11-13"',
        'INVALID_PAGE_RANGES'
      );
    }
  }

  /**
   * Validate dimensions
   */
  private validateDimensions(action: PDFAction, errors: ValidationError[]): void {
    // Check if width/height properties exist on the action
    const dimensions = action as any;
    
    if ('width' in dimensions || 'height' in dimensions) {
      const fields = ['width', 'height'] as const;
      
      for (const field of fields) {
        const value = dimensions[field];
        if (value !== undefined) {
          if (typeof value === 'number' && value <= 0) {
            this.addError(
              errors,
              field,
              `${field} must be positive`,
              `INVALID_${field.toUpperCase()}`
            );
          } else if (typeof value === 'string' && !this.isValidCSSUnit(value)) {
            this.addError(
              errors,
              field,
              `Invalid ${field} format`,
              `INVALID_${field.toUpperCase()}_FORMAT`
            );
          }
        }
      }
    }
  }

  /**
   * Validate print options
   */
  private validatePrintOptions(
    action: PDFAction,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // Warn about print background
    if (action.printBackground) {
      this.addWarning(
        warnings,
        'printBackground',
        'Printing backgrounds may increase file size',
        'PRINT_BACKGROUND_WARNING'
      );
    }

    // Validate landscape option
    if (action.landscape !== undefined && typeof action.landscape !== 'boolean') {
      this.addError(
        errors,
        'landscape',
        'Landscape must be a boolean',
        'INVALID_LANDSCAPE'
      );
    }

    // Validate preferCSSPageSize
    if (action.preferCSSPageSize !== undefined && typeof action.preferCSSPageSize !== 'boolean') {
      this.addError(
        errors,
        'preferCSSPageSize',
        'PreferCSSPageSize must be a boolean',
        'INVALID_PREFER_CSS_PAGE_SIZE'
      );
    }
  }

  /**
   * Validate header/footer templates
   */
  private validateHeaderFooter(action: PDFAction, errors: ValidationError[]): void {
    if (action.displayHeaderFooter) {
      if (action.headerTemplate && action.headerTemplate.length > 5000) {
        this.addError(
          errors,
          'headerTemplate',
          'Header template is too long',
          'HEADER_TOO_LONG'
        );
      }
      if (action.footerTemplate && action.footerTemplate.length > 5000) {
        this.addError(
          errors,
          'footerTemplate',
          'Footer template is too long',
          'FOOTER_TOO_LONG'
        );
      }
    }
  }

  /**
   * Check if value is valid CSS unit
   */
  private isValidCSSUnit(value: string): boolean {
    return /^\d+(\.\d+)?(px|in|cm|mm|pt|pc|em|ex|ch|rem|vw|vh|vmin|vmax|%)$/.test(value);
  }
}