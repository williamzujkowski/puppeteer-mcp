/**
 * Security validator for browser actions
 * @module puppeteer/actions/execution/validation/security-validator
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 * @nist sc-18 "Mobile code"
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
} from '../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../types.js';
import { BaseValidator } from './base-validator.js';

/**
 * Security patterns to check
 */
interface SecurityPattern {
  pattern: RegExp;
  severity: 'error' | 'warning';
  message: string;
  code: string;
}

/**
 * Validates security aspects of actions
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 * @nist sc-18 "Mobile code"
 */
export class SecurityValidator extends BaseValidator {
  /**
   * XSS patterns to check in selectors and content
   */
  private readonly xssPatterns: SecurityPattern[] = [
    {
      pattern: /javascript:/i,
      severity: 'error',
      message: 'JavaScript protocol detected',
      code: 'XSS_JAVASCRIPT_PROTOCOL',
    },
    {
      pattern: /vbscript:/i,
      severity: 'error',
      message: 'VBScript protocol detected',
      code: 'XSS_VBSCRIPT_PROTOCOL',
    },
    {
      pattern: /<script[\s>]/i,
      severity: 'error',
      message: 'Script tag detected',
      code: 'XSS_SCRIPT_TAG',
    },
    {
      pattern: /on\w+\s*=/i,
      severity: 'warning',
      message: 'Event handler detected',
      code: 'XSS_EVENT_HANDLER',
    },
    {
      pattern: /data:text\/html/i,
      severity: 'warning',
      message: 'Data URL with HTML detected',
      code: 'XSS_DATA_URL',
    },
  ];

  /**
   * SQL injection patterns
   */
  private readonly sqlPatterns: SecurityPattern[] = [
    {
      pattern: /(\b(union|select|insert|update|delete|drop|create)\b.*\b(from|into|where|table)\b)/i,
      severity: 'warning',
      message: 'Potential SQL injection pattern detected',
      code: 'SQL_INJECTION_PATTERN',
    },
    {
      pattern: /('|(--|\/\*|\*\/))/,
      severity: 'warning',
      message: 'SQL comment or quote detected',
      code: 'SQL_SPECIAL_CHARS',
    },
  ];

  /**
   * Command injection patterns
   */
  private readonly commandPatterns: SecurityPattern[] = [
    {
      pattern: /[;&|`$()]/,
      severity: 'warning',
      message: 'Shell metacharacters detected',
      code: 'COMMAND_INJECTION_CHARS',
    },
    {
      pattern: /\b(exec|system|spawn|fork)\b/i,
      severity: 'error',
      message: 'System command execution detected',
      code: 'COMMAND_EXECUTION',
    },
  ];

  /**
   * Validate security aspects
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    this.logger.debug('Performing security validation', {
      sessionId: context.sessionId,
      actionType: action.type,
    });

    // Check action permissions
    this.validateActionPermissions(action, context, errors);

    // Validate against XSS patterns
    this.validateAgainstPatterns(action, this.xssPatterns, errors, warnings);

    // Check for SQL injection patterns in relevant fields
    if (this.hasUserInput(action)) {
      this.validateAgainstPatterns(action, this.sqlPatterns, errors, warnings);
    }

    // Check for command injection patterns
    if (action.type === 'evaluate' || action.type === 'upload') {
      this.validateAgainstPatterns(action, this.commandPatterns, errors, warnings);
    }

    // Validate URL safety
    if ('url' in action && action.url) {
      this.validateUrlSafety(action.url as string, errors, warnings);
    }

    // Check for sensitive data exposure
    this.checkSensitiveDataExposure(action, warnings);

    // Validate rate limiting
    this.validateRateLimiting(action, context, warnings);

    return this.createResult(errors, warnings);
  }

  /**
   * Check if this validator can handle the action
   * @param action - Action to check
   * @returns Always true for security validation
   */
  canValidate(action: BrowserAction): boolean {
    return true; // Security validation applies to all actions
  }

  /**
   * Validate action permissions
   * @param action - Action to validate
   * @param context - Execution context
   * @param errors - Error collection
   */
  private validateActionPermissions(
    action: BrowserAction,
    context: ActionContext,
    errors: ValidationError[]
  ): void {
    // Check if action requires elevated permissions
    const elevatedActions = ['evaluate', 'upload', 'cookie'];
    if (elevatedActions.includes(action.type) && context.restrictedMode) {
      if (!context.permissions?.includes(action.type)) {
        this.addError(
          errors,
          'permissions',
          `Action '${action.type}' requires elevated permissions`,
          'INSUFFICIENT_PERMISSIONS'
        );
      }
    }

    // Check domain restrictions
    if (context.allowedDomains && 'url' in action && action.url) {
      try {
        const url = new URL(action.url as string);
        const allowed = context.allowedDomains.some(domain => 
          url.hostname === domain || url.hostname.endsWith(`.${domain}`)
        );
        
        if (!allowed) {
          this.addError(
            errors,
            'url',
            'URL domain not in allowed list',
            'DOMAIN_NOT_ALLOWED'
          );
        }
      } catch {
        // URL validation handled elsewhere
      }
    }
  }

  /**
   * Validate against security patterns
   * @param action - Action to validate
   * @param patterns - Patterns to check
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private validateAgainstPatterns(
    action: BrowserAction,
    patterns: SecurityPattern[],
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    const fieldsToCheck = this.getFieldsToCheck(action);

    for (const [field, value] of fieldsToCheck) {
      if (typeof value !== 'string') continue;

      for (const { pattern, severity, message, code } of patterns) {
        if (pattern.test(value)) {
          if (severity === 'error') {
            this.addError(errors, field, message, code);
          } else {
            this.addWarning(warnings, field, message, code);
          }
        }
      }
    }
  }

  /**
   * Get fields to check for security patterns
   * @param action - Action to get fields from
   * @returns Field entries
   */
  private getFieldsToCheck(action: BrowserAction): Array<[string, unknown]> {
    const fields: Array<[string, unknown]> = [];

    // Common fields
    if ('selector' in action) fields.push(['selector', action.selector]);
    if ('text' in action) fields.push(['text', action.text]);
    if ('url' in action) fields.push(['url', action.url]);
    if ('function' in action) fields.push(['function', action.function]);
    if ('headerTemplate' in action) fields.push(['headerTemplate', action.headerTemplate]);
    if ('footerTemplate' in action) fields.push(['footerTemplate', action.footerTemplate]);

    // Values in arrays
    if ('values' in action && Array.isArray(action.values)) {
      action.values.forEach((value, i) => fields.push([`values[${i}]`, value]));
    }
    if ('filePaths' in action && Array.isArray(action.filePaths)) {
      action.filePaths.forEach((path, i) => fields.push([`filePaths[${i}]`, path]));
    }

    return fields;
  }

  /**
   * Check if action has user input
   * @param action - Action to check
   * @returns True if action contains user input
   */
  private hasUserInput(action: BrowserAction): boolean {
    const inputActions = ['type', 'select', 'evaluate', 'upload'];
    return inputActions.includes(action.type);
  }

  /**
   * Validate URL safety
   * @param url - URL to validate
   * @param errors - Error collection
   * @param warnings - Warning collection
   */
  private validateUrlSafety(url: string, errors: ValidationError[], warnings: ValidationError[]): void {
    try {
      const parsed = new URL(url);

      // Check for suspicious ports
      const suspiciousPorts = ['21', '22', '23', '25', '110', '143', '3389'];
      if (suspiciousPorts.includes(parsed.port)) {
        this.addWarning(
          warnings,
          'url',
          `Suspicious port detected: ${parsed.port}`,
          'SUSPICIOUS_PORT'
        );
      }

      // Check for IP addresses (except localhost)
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipPattern.test(parsed.hostname) && 
          parsed.hostname !== '127.0.0.1' && 
          !parsed.hostname.startsWith('192.168.')) {
        this.addWarning(
          warnings,
          'url',
          'Direct IP address access detected',
          'DIRECT_IP_ACCESS'
        );
      }

      // Check for suspicious TLDs
      const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf'];
      if (suspiciousTlds.some(tld => parsed.hostname.endsWith(tld))) {
        this.addWarning(
          warnings,
          'url',
          'Suspicious top-level domain detected',
          'SUSPICIOUS_TLD'
        );
      }

    } catch {
      // URL parsing errors handled elsewhere
    }
  }

  /**
   * Check for sensitive data exposure
   * @param action - Action to check
   * @param warnings - Warning collection
   */
  private checkSensitiveDataExposure(action: BrowserAction, warnings: ValidationError[]): void {
    const sensitivePatterns = [
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: 'SSN' },
      { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, name: 'credit card' },
      { pattern: /\b[A-Z]{2}\d{2}\s?[A-Z0-9]{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3}\b/, name: 'IBAN' },
      { pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/, name: 'email' },
      { pattern: /\+?1?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/, name: 'phone number' },
    ];

    const fieldsToCheck = this.getFieldsToCheck(action);

    for (const [field, value] of fieldsToCheck) {
      if (typeof value !== 'string') continue;

      for (const { pattern, name } of sensitivePatterns) {
        if (pattern.test(value)) {
          this.addWarning(
            warnings,
            field,
            `Potential ${name} detected in action data`,
            'SENSITIVE_DATA_DETECTED'
          );
          break;
        }
      }
    }
  }

  /**
   * Validate rate limiting
   * @param action - Action to validate
   * @param context - Execution context
   * @param warnings - Warning collection
   */
  private validateRateLimiting(
    action: BrowserAction,
    context: ActionContext,
    warnings: ValidationError[]
  ): void {
    // Check for rapid automation indicators
    if (action.type === 'click' || action.type === 'type') {
      const typedAction = action as { delay?: number };
      if (typedAction.delay === 0 || typedAction.delay === undefined) {
        this.addWarning(
          warnings,
          'delay',
          'No delay specified - may trigger rate limiting or bot detection',
          'NO_DELAY_WARNING'
        );
      }
    }

    // Check for bulk operations
    if ('values' in action && Array.isArray(action.values) && action.values.length > 100) {
      this.addWarning(
        warnings,
        'values',
        'Large number of values may trigger rate limiting',
        'BULK_OPERATION_WARNING'
      );
    }
  }
}