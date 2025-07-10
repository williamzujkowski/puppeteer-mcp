/**
 * Screenshot action sub-validator
 * @module puppeteer/actions/execution/validation/content/screenshot-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type {
  ScreenshotAction,
  ActionContext,
  ValidationResult,
} from '../../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../../types.js';
import { BaseValidator } from '../base-validator.js';

/**
 * Valid image formats for screenshots
 */
const VALID_IMAGE_FORMATS = ['png', 'jpeg', 'webp'] as const;

/**
 * Screenshot-specific validator
 * @nist si-10 "Information input validation"
 */
export class ScreenshotSubValidator extends BaseValidator {
  /**
   * Validate screenshot action
   * @param action - Screenshot action
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: ScreenshotAction, context: ActionContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    this.logger.debug('Validating screenshot action', {
      sessionId: context.sessionId,
      format: action.format,
      fullPage: action.fullPage,
    });

    // Validate quality
    this.validateQuality(action, errors, warnings);

    // Validate format
    this.validateFormat(action, errors);

    // Validate clip area
    if ('clip' in action) {
      this.validateClipArea(action.clip as any, errors);
    }

    // Validate selector
    this.validateSelector(action, errors);

    // Validate full page option
    this.validateFullPage(action, warnings);

    // Validate encoding
    this.validateEncoding(action, errors);

    return this.createResult(errors, warnings);
  }

  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns True for screenshot actions
   */
  canValidate(action: { type: string }): boolean {
    return action.type === 'screenshot';
  }

  /**
   * Validate quality setting
   */
  private validateQuality(
    action: ScreenshotAction,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (action.quality !== undefined) {
      this.validateNumericRange(
        action.quality,
        'quality',
        0,
        100,
        errors,
        'INVALID_QUALITY'
      );
      
      // Warn if quality is set for non-JPEG
      if (action.format && action.format !== 'jpeg' && action.quality !== undefined) {
        this.addWarning(
          warnings,
          'quality',
          'Quality setting only applies to JPEG format',
          'QUALITY_IGNORED'
        );
      }
    }
  }

  /**
   * Validate image format
   */
  private validateFormat(action: ScreenshotAction, errors: ValidationError[]): void {
    if (action.format) {
      this.validateEnum(
        action.format,
        'format',
        VALID_IMAGE_FORMATS,
        errors,
        'INVALID_FORMAT'
      );
    }
  }

  /**
   * Validate clip area
   */
  private validateClipArea(
    clip: { x?: number; y?: number; width?: number; height?: number },
    errors: ValidationError[]
  ): void {
    const requiredFields = ['x', 'y', 'width', 'height'];
    
    for (const field of requiredFields) {
      const value = clip[field as keyof typeof clip];
      if (value === undefined || typeof value !== 'number') {
        this.addError(
          errors,
          `clip.${field}`,
          `Clip ${field} must be a number`,
          'INVALID_CLIP_FIELD'
        );
      } else if (value < 0) {
        this.addError(
          errors,
          `clip.${field}`,
          `Clip ${field} must be non-negative`,
          'NEGATIVE_CLIP_VALUE'
        );
      }
    }
  }

  /**
   * Validate selector
   */
  private validateSelector(action: ScreenshotAction, errors: ValidationError[]): void {
    if (action.selector && typeof action.selector !== 'string') {
      this.addError(
        errors,
        'selector',
        'Selector must be a string',
        'INVALID_SELECTOR_TYPE'
      );
    }
  }

  /**
   * Validate full page option
   */
  private validateFullPage(action: ScreenshotAction, warnings: ValidationError[]): void {
    if (action.fullPage) {
      this.addWarning(
        warnings,
        'fullPage',
        'Full page screenshots may be memory intensive',
        'FULL_PAGE_WARNING'
      );
    }
  }

  /**
   * Validate encoding
   */
  private validateEncoding(action: ScreenshotAction, errors: ValidationError[]): void {
    if ('encoding' in action && action.encoding && !['base64', 'binary'].includes(action.encoding as string)) {
      this.addError(
        errors,
        'encoding',
        'Invalid encoding. Must be base64 or binary',
        'INVALID_ENCODING'
      );
    }
  }
}