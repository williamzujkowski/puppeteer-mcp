/**
 * Data action validators (upload, cookie)
 * @module puppeteer/actions/execution/validation/data-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
  UploadAction,
  CookieAction,
} from '../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../types.js';
import { BaseValidator } from './base-validator.js';

/**
 * Valid cookie operations
 */
const VALID_COOKIE_OPERATIONS = ['set', 'get', 'delete', 'clear'] as const;

/**
 * Valid SameSite values
 */
const VALID_SAME_SITE = ['Strict', 'Lax', 'None'] as const;

/**
 * Maximum file size for uploads (100MB)
 */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Validates data-related actions
 * @nist si-10 "Information input validation"
 */
export class DataValidator extends BaseValidator {
  /**
   * Supported action types
   */
  private readonly supportedTypes = ['upload', 'cookie'];

  /**
   * Validate data action
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    this.logger.debug('Validating data action', {
      sessionId: context.sessionId,
      actionType: action.type,
    });

    switch (action.type) {
      case 'upload':
        await this.validateUploadAction(action as UploadAction, context, errors, warnings);
        break;
      case 'cookie':
        this.validateCookieAction(action as CookieAction, errors, warnings);
        break;
    }

    return this.createResult(errors, warnings);
  }

  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns True if action is data type
   */
  canValidate(action: BrowserAction): boolean {
    return this.supportedTypes.includes(action.type);
  }

  /**
   * Validate upload action
   * @param action - Upload action
   * @param context - Execution context
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private async validateUploadAction(
    action: UploadAction,
    context: ActionContext,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): Promise<void> {
    // Validate selector
    if (!this.validateRequiredString(action.selector, 'selector', errors, 'MISSING_SELECTOR')) {
      return;
    }

    // Validate file paths
    if (!this.validateArray<string>(action.filePaths, 'filePaths', errors, 'MISSING_FILE_PATHS')) {
      return;
    }

    // Validate each file path
    for (let i = 0; i < action.filePaths.length; i++) {
      const filePath = action.filePaths[i];
      
      if (typeof filePath !== 'string') {
        this.addError(
          errors,
          `filePaths[${i}]`,
          'File path must be a string',
          'INVALID_FILE_PATH_TYPE'
        );
        continue;
      }

      // Security validation
      await this.validateFilePath(filePath, i, context, errors, warnings);
    }

    // Warn about multiple files
    if (action.filePaths.length > 10) {
      this.addWarning(
        warnings,
        'filePaths',
        'Uploading many files may impact performance',
        'MANY_FILES_WARNING'
      );
    }

    // Check if selector is file input
    if (!action.selector.includes('input') || !action.selector.includes('file')) {
      this.addWarning(
        warnings,
        'selector',
        'Selector does not appear to target a file input element',
        'NON_FILE_INPUT_WARNING'
      );
    }
  }

  /**
   * Validate cookie action
   * @param action - Cookie action
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private validateCookieAction(
    action: CookieAction,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // Validate operation
    if (!action.operation) {
      this.addError(errors, 'operation', 'Cookie operation is required', 'MISSING_OPERATION');
      return;
    }

    this.validateEnum(
      action.operation,
      'operation',
      VALID_COOKIE_OPERATIONS,
      errors,
      'INVALID_COOKIE_OPERATION'
    );

    // Operation-specific validation
    switch (action.operation) {
      case 'set':
        this.validateSetCookies(action, errors, warnings);
        break;
      case 'delete':
        this.validateDeleteCookies(action, errors);
        break;
      case 'get':
      case 'clear':
        // No additional validation needed
        break;
    }
  }

  /**
   * Validate set cookie operation
   * @param action - Cookie action
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private validateSetCookies(
    action: CookieAction,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    if (!this.validateArray(action.cookies, 'cookies', errors, 'MISSING_COOKIES_FOR_SET')) {
      return;
    }

    action.cookies!.forEach((cookie, index) => {
      // Validate required fields
      if (!cookie.name) {
        this.addError(
          errors,
          `cookies[${index}].name`,
          'Cookie name is required',
          'MISSING_COOKIE_NAME'
        );
      }

      if (cookie.value === undefined || cookie.value === null) {
        this.addError(
          errors,
          `cookies[${index}].value`,
          'Cookie value is required',
          'MISSING_COOKIE_VALUE'
        );
      }

      // Validate domain
      if (cookie.domain && !this.isValidDomain(cookie.domain)) {
        this.addError(
          errors,
          `cookies[${index}].domain`,
          'Invalid cookie domain',
          'INVALID_COOKIE_DOMAIN'
        );
      }

      // Validate path
      if (cookie.path && !cookie.path.startsWith('/')) {
        this.addError(
          errors,
          `cookies[${index}].path`,
          'Cookie path must start with /',
          'INVALID_COOKIE_PATH'
        );
      }

      // Validate expires
      if (cookie.expires !== undefined) {
        if (typeof cookie.expires !== 'number' || cookie.expires < 0) {
          this.addError(
            errors,
            `cookies[${index}].expires`,
            'Cookie expires must be a positive number (Unix timestamp)',
            'INVALID_COOKIE_EXPIRES'
          );
        }
      }

      // Validate SameSite
      if (cookie.sameSite) {
        this.validateEnum(
          cookie.sameSite,
          `cookies[${index}].sameSite`,
          VALID_SAME_SITE,
          errors,
          'INVALID_SAME_SITE'
        );
      }

      // Security warnings
      if (cookie.secure && cookie.sameSite === 'None') {
        this.addWarning(
          warnings,
          `cookies[${index}]`,
          'SameSite=None requires Secure attribute',
          'SAME_SITE_SECURITY'
        );
      }

      if (cookie.httpOnly === false) {
        this.addWarning(
          warnings,
          `cookies[${index}].httpOnly`,
          'Setting httpOnly to false may have security implications',
          'HTTP_ONLY_WARNING'
        );
      }

      // Check for sensitive cookie names
      const sensitiveName = ['session', 'token', 'auth', 'key'].some(
        sensitive => cookie.name?.toLowerCase().includes(sensitive)
      );
      if (sensitiveName && !cookie.secure) {
        this.addWarning(
          warnings,
          `cookies[${index}].secure`,
          'Sensitive cookie should use secure flag',
          'INSECURE_SENSITIVE_COOKIE'
        );
      }
    });
  }

  /**
   * Validate delete cookie operation
   * @param action - Cookie action
   * @param errors - Error collection
   */
  private validateDeleteCookies(action: CookieAction, errors: ValidationError[]): void {
    if (!action.cookies && !action.names) {
      this.addError(
        errors,
        'cookies/names',
        'Either cookies array or names array is required for delete operation',
        'MISSING_DELETE_PARAMS'
      );
      return;
    }

    if (action.names) {
      if (!this.validateArray<string>(action.names, 'names', errors, 'INVALID_NAMES_ARRAY')) {
        return;
      }

      action.names.forEach((name, index) => {
        if (typeof name !== 'string') {
          this.addError(
            errors,
            `names[${index}]`,
            'Cookie name must be a string',
            'INVALID_NAME_TYPE'
          );
        }
      });
    }
  }

  /**
   * Validate file path
   * @param filePath - File path to validate
   * @param index - Index in array
   * @param context - Execution context
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private async validateFilePath(
    filePath: string,
    index: number,
    context: ActionContext,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): Promise<void> {
    // Check for path traversal
    if (filePath.includes('..') || filePath.includes('~')) {
      this.addError(
        errors,
        `filePaths[${index}]`,
        'File path contains potentially dangerous patterns',
        'DANGEROUS_FILE_PATH'
      );
    }

    // Check for absolute paths (security concern)
    if (filePath.startsWith('/') || filePath.match(/^[a-zA-Z]:\\/)) {
      this.addWarning(
        warnings,
        `filePaths[${index}]`,
        'Absolute file paths may have security implications',
        'ABSOLUTE_PATH_WARNING'
      );
    }

    // Validate file extension
    const allowedExtensions = [
      '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.png', '.jpg', '.jpeg', '.gif', '.webp',
      '.csv', '.json', '.xml', '.zip'
    ];
    
    const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && !allowedExtensions.includes(ext)) {
      this.addWarning(
        warnings,
        `filePaths[${index}]`,
        `Unusual file extension: ${ext}`,
        'UNUSUAL_FILE_EXTENSION'
      );
    }

    // Check for executable extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.app', '.dmg'];
    if (ext && dangerousExtensions.includes(ext)) {
      this.addError(
        errors,
        `filePaths[${index}]`,
        'Executable files are not allowed',
        'EXECUTABLE_FILE'
      );
    }
  }

  /**
   * Validate domain format
   * @param domain - Domain to validate
   * @returns True if valid domain
   */
  private isValidDomain(domain: string): boolean {
    // Simple domain validation
    const domainPattern = /^(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    return domain === 'localhost' || 
           domainPattern.test(domain) || 
           ipPattern.test(domain) ||
           domain.startsWith('.');
  }
}