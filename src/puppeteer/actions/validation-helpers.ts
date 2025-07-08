/**
 * Validation helper functions
 * @module puppeteer/actions/validation-helpers
 */

import type { BrowserAction } from '../interfaces/action-executor.interface.js';

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validate evaluate action security
 */
export function validateEvaluateAction(
  action: BrowserAction,
  errors: ValidationError[],
  validateJavaScriptCode: (code: string) => void,
): void {
  if (action.type === 'evaluate' && action.function) {
    try {
      validateJavaScriptCode(action.function);
    } catch (error) {
      errors.push({
        field: 'function',
        message: error instanceof Error ? error.message : 'Invalid JavaScript code',
        code: 'UNSAFE_CODE',
      });
    }
  }
}

/**
 * Check for suspicious timeout values
 */
export function checkTimeoutWarnings(action: BrowserAction, warnings: ValidationError[]): void {
  if (action.timeout !== undefined && action.timeout > 300000) {
    // 5 minutes
    warnings.push({
      field: 'timeout',
      message: 'Timeout value is very high, consider reducing it',
      code: 'HIGH_TIMEOUT',
    });
  }
}
