/**
 * Navigation action validator
 * @module puppeteer/actions/execution/validation/navigation-validator
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
  NavigateAction,
} from '../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../types.js';
import { BaseValidator } from './base-validator.js';

/**
 * Valid wait until options for navigation
 */
const VALID_WAIT_UNTIL = ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'] as const;

/**
 * Dangerous URL protocols to block
 */
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:'] as const;

/**
 * Validates navigation actions
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 */
export class NavigationValidator extends BaseValidator {
  /**
   * Validate navigation action
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const navAction = action as NavigateAction;

    this.logger.debug('Validating navigation action', {
      sessionId: context.sessionId,
      url: navAction.url,
    });

    // Validate URL
    this.validateUrl(navAction, errors, warnings);

    // Validate wait until option
    this.validateWaitUntil(navAction, errors);

    // Validate referrer
    this.validateReferrer(navAction, errors);

    // Validate headers
    this.validateHeaders(navAction, warnings);

    return this.createResult(errors, warnings);
  }

  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns True if action is navigation type
   */
  canValidate(action: BrowserAction): boolean {
    return action.type === 'navigate';
  }

  /**
   * Validate URL
   * @param action - Navigation action
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private validateUrl(
    action: NavigateAction,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    // Check required URL
    if (!this.validateRequiredString(action.url, 'url', errors, 'MISSING_URL')) {
      return;
    }

    try {
      const url = new URL(action.url);

      // Check for dangerous protocols
      const isDangerousProtocol = DANGEROUS_PROTOCOLS.some((protocol) => url.protocol === protocol);
      
      // Allow data: URLs in test environments
      const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.CI === 'true';
      const isDataUrl = url.protocol === 'data:';
      
      if (isDangerousProtocol && !(isTestEnvironment && isDataUrl)) {
        this.addError(
          errors,
          'url',
          `Dangerous URL protocol detected: ${url.protocol}`,
          'DANGEROUS_URL_PROTOCOL',
        );
      }

      // Warn about local file access
      if (url.protocol === 'file:') {
        this.addWarning(
          warnings,
          'url',
          'Local file access may have security implications',
          'LOCAL_FILE_ACCESS',
        );
      }

      // Warn about non-HTTPS URLs
      if (
        url.protocol === 'http:' &&
        url.hostname !== 'localhost' &&
        url.hostname !== '127.0.0.1'
      ) {
        this.addWarning(
          warnings,
          'url',
          'Non-HTTPS URL may have security implications',
          'INSECURE_PROTOCOL',
        );
      }
    } catch {
      this.addError(errors, 'url', 'Invalid URL format', 'INVALID_URL');
    }
  }

  /**
   * Validate wait until option
   * @param action - Navigation action
   * @param errors - Error collection
   */
  private validateWaitUntil(action: NavigateAction, errors: ValidationError[]): void {
    if (action.waitUntil) {
      this.validateEnum(
        action.waitUntil,
        'waitUntil',
        VALID_WAIT_UNTIL,
        errors,
        'INVALID_WAIT_UNTIL',
      );
    }
  }

  /**
   * Validate referrer
   * @param action - Navigation action
   * @param errors - Error collection
   */
  private validateReferrer(action: NavigateAction, errors: ValidationError[]): void {
    if (action.referrer) {
      try {
        new URL(action.referrer);
      } catch {
        this.addError(errors, 'referrer', 'Invalid referrer URL format', 'INVALID_REFERRER');
      }
    }
  }

  /**
   * Validate custom headers
   * @param action - Navigation action
   * @param warnings - Warning collection
   */
  private validateHeaders(action: NavigateAction, warnings: ValidationError[]): void {
    if (action.headers) {
      const suspiciousHeaders = ['cookie', 'authorization', 'x-api-key'];

      for (const header of Object.keys(action.headers)) {
        if (suspiciousHeaders.includes(header.toLowerCase())) {
          this.addWarning(
            warnings,
            'headers',
            `Sensitive header detected: ${header}`,
            'SENSITIVE_HEADER',
          );
        }
      }
    }
  }
}
