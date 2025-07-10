/**
 * Action validation and parameter checking module
 * @module puppeteer/actions/execution/action-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
  NavigateAction,
  ClickAction,
  TypeAction,
  SelectAction,
  KeyboardAction,
  MouseAction,
  ScreenshotAction,
  PDFAction,
  ContentAction,
  WaitAction,
  ScrollAction,
  EvaluateAction,
  UploadAction,
  CookieAction,
} from '../../interfaces/action-executor.interface.js';
import type { ValidationError } from './types.js';
import { validateAction as baseValidateAction } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:action-validator');

/**
 * Comprehensive action validator
 * @nist si-10 "Information input validation"
 */
export class ActionValidator {
  /**
   * Validate a browser action
   * @param action - Action to validate
   * @param context - Execution context
   * @returns Validation result
   */
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    try {
      logger.debug('Validating browser action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
      });

      const errors: ValidationError[] = [];
      const warnings: ValidationError[] = [];

      // Basic structure validation
      this.validateBasicStructure(action, errors);

      // Type-specific validation
      await this.validateActionType(action, errors, warnings);

      // Context validation
      this.validateContext(context, errors);

      // Security validation
      await this.validateSecurity(action, context, errors, warnings);

      const result: ValidationResult = {
        valid: errors.length === 0,
        errors: errors.map(e => ({
          field: e.field,
          message: e.message,
          code: e.code,
        })),
        warnings: warnings.map(w => ({
          field: w.field,
          message: w.message,
          code: w.code,
        })),
      };

      logger.debug('Action validation completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        valid: result.valid,
        errorCount: result.errors.length,
        warningCount: result.warnings?.length ?? 0,
      });

      return result;
    } catch (error) {
      logger.error('Action validation failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      });

      return {
        valid: false,
        errors: [
          {
            field: 'unknown',
            message: error instanceof Error ? error.message : 'Unknown validation error',
            code: 'VALIDATION_ERROR',
          },
        ],
      };
    }
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
    return Promise.all(actions.map(action => this.validate(action, context)));
  }

  /**
   * Validate basic action structure
   */
  private validateBasicStructure(action: BrowserAction, errors: ValidationError[]): void {
    if (!action.type) {
      errors.push({
        field: 'type',
        message: 'Action type is required',
        code: 'MISSING_TYPE',
      });
    }

    if (!action.pageId) {
      errors.push({
        field: 'pageId',
        message: 'Page ID is required',
        code: 'MISSING_PAGE_ID',
      });
    }

    if (action.timeout && (action.timeout < 0 || action.timeout > 300000)) {
      errors.push({
        field: 'timeout',
        message: 'Timeout must be between 0 and 300000ms',
        code: 'INVALID_TIMEOUT',
      });
    }
  }

  /**
   * Validate action type-specific requirements
   */
  private async validateActionType(
    action: BrowserAction,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): Promise<void> {
    switch (action.type) {
      case 'navigate':
        this.validateNavigateAction(action as NavigateAction, errors);
        break;
      case 'click':
        this.validateClickAction(action as ClickAction, errors);
        break;
      case 'type':
        this.validateTypeAction(action as TypeAction, errors, warnings);
        break;
      case 'select':
        this.validateSelectAction(action as SelectAction, errors);
        break;
      case 'keyboard':
        this.validateKeyboardAction(action as KeyboardAction, errors);
        break;
      case 'mouse':
        this.validateMouseAction(action as MouseAction, errors);
        break;
      case 'screenshot':
        this.validateScreenshotAction(action as ScreenshotAction, errors);
        break;
      case 'pdf':
        this.validatePDFAction(action as PDFAction, errors);
        break;
      case 'content':
        this.validateContentAction(action as ContentAction, errors);
        break;
      case 'wait':
        this.validateWaitAction(action as WaitAction, errors);
        break;
      case 'scroll':
        this.validateScrollAction(action as ScrollAction, errors);
        break;
      case 'evaluate':
        this.validateEvaluateAction(action as EvaluateAction, errors, warnings);
        break;
      case 'upload':
        this.validateUploadAction(action as UploadAction, errors);
        break;
      case 'cookie':
        this.validateCookieAction(action as CookieAction, errors);
        break;
      default:
        // Use base validation for unknown types
        const baseResult = baseValidateAction(action);
        if (!baseResult.valid) {
          errors.push(...baseResult.errors.map(e => ({
            field: e.field,
            message: e.message,
            code: e.code || 'VALIDATION_ERROR',
          })));
        }
    }
  }

  /**
   * Validate navigation action
   */
  private validateNavigateAction(action: NavigateAction, errors: ValidationError[]): void {
    if (!action.url) {
      errors.push({
        field: 'url',
        message: 'URL is required for navigate action',
        code: 'MISSING_URL',
      });
    } else {
      try {
        new URL(action.url);
      } catch {
        errors.push({
          field: 'url',
          message: 'Invalid URL format',
          code: 'INVALID_URL',
        });
      }
    }

    if (action.waitUntil && !['load', 'domcontentloaded', 'networkidle0', 'networkidle2'].includes(action.waitUntil)) {
      errors.push({
        field: 'waitUntil',
        message: 'Invalid waitUntil value',
        code: 'INVALID_WAIT_UNTIL',
      });
    }
  }

  /**
   * Validate click action
   */
  private validateClickAction(action: ClickAction, errors: ValidationError[]): void {
    if (!action.selector) {
      errors.push({
        field: 'selector',
        message: 'Selector is required for click action',
        code: 'MISSING_SELECTOR',
      });
    }

    if (action.clickCount && (action.clickCount < 1 || action.clickCount > 10)) {
      errors.push({
        field: 'clickCount',
        message: 'Click count must be between 1 and 10',
        code: 'INVALID_CLICK_COUNT',
      });
    }

    if (action.button && !['left', 'right', 'middle'].includes(action.button)) {
      errors.push({
        field: 'button',
        message: 'Invalid mouse button',
        code: 'INVALID_MOUSE_BUTTON',
      });
    }
  }

  /**
   * Validate type action
   */
  private validateTypeAction(
    action: TypeAction,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    if (!action.selector) {
      errors.push({
        field: 'selector',
        message: 'Selector is required for type action',
        code: 'MISSING_SELECTOR',
      });
    }

    if (!action.text && action.text !== '') {
      errors.push({
        field: 'text',
        message: 'Text is required for type action',
        code: 'MISSING_TEXT',
      });
    }

    if (action.text && action.text.length > 10000) {
      warnings.push({
        field: 'text',
        message: 'Text is very long and may cause performance issues',
        code: 'LONG_TEXT',
      });
    }
  }

  /**
   * Validate select action
   */
  private validateSelectAction(action: SelectAction, errors: ValidationError[]): void {
    if (!action.selector) {
      errors.push({
        field: 'selector',
        message: 'Selector is required for select action',
        code: 'MISSING_SELECTOR',
      });
    }

    if (!action.values || !Array.isArray(action.values) || action.values.length === 0) {
      errors.push({
        field: 'values',
        message: 'Values array is required for select action',
        code: 'MISSING_VALUES',
      });
    }
  }

  /**
   * Validate keyboard action
   */
  private validateKeyboardAction(action: KeyboardAction, errors: ValidationError[]): void {
    if (!action.key) {
      errors.push({
        field: 'key',
        message: 'Key is required for keyboard action',
        code: 'MISSING_KEY',
      });
    }

    if (!action.action || !['press', 'down', 'up'].includes(action.action)) {
      errors.push({
        field: 'action',
        message: 'Invalid keyboard action type',
        code: 'INVALID_KEYBOARD_ACTION',
      });
    }
  }

  /**
   * Validate mouse action
   */
  private validateMouseAction(action: MouseAction, errors: ValidationError[]): void {
    if (!action.action || !['move', 'down', 'up', 'wheel'].includes(action.action)) {
      errors.push({
        field: 'action',
        message: 'Invalid mouse action type',
        code: 'INVALID_MOUSE_ACTION',
      });
    }

    if (action.action === 'wheel' && (action.deltaX === undefined && action.deltaY === undefined)) {
      errors.push({
        field: 'deltaX/deltaY',
        message: 'Delta values required for wheel action',
        code: 'MISSING_DELTA',
      });
    }
  }

  /**
   * Validate screenshot action
   */
  private validateScreenshotAction(action: ScreenshotAction, errors: ValidationError[]): void {
    if (action.quality && (action.quality < 0 || action.quality > 100)) {
      errors.push({
        field: 'quality',
        message: 'Quality must be between 0 and 100',
        code: 'INVALID_QUALITY',
      });
    }

    if (action.format && !['png', 'jpeg', 'webp'].includes(action.format)) {
      errors.push({
        field: 'format',
        message: 'Invalid image format',
        code: 'INVALID_FORMAT',
      });
    }
  }

  /**
   * Validate PDF action
   */
  private validatePDFAction(action: PDFAction, errors: ValidationError[]): void {
    const validFormats = ['letter', 'legal', 'tabloid', 'ledger', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
    if (action.format && !validFormats.includes(action.format)) {
      errors.push({
        field: 'format',
        message: 'Invalid PDF format',
        code: 'INVALID_PDF_FORMAT',
      });
    }

    if (action.scale && (action.scale < 0.1 || action.scale > 2)) {
      errors.push({
        field: 'scale',
        message: 'Scale must be between 0.1 and 2',
        code: 'INVALID_SCALE',
      });
    }
  }

  /**
   * Validate content action
   */
  private validateContentAction(action: ContentAction, errors: ValidationError[]): void {
    // Content action is simple, just validate selector if provided
    if (action.selector && typeof action.selector !== 'string') {
      errors.push({
        field: 'selector',
        message: 'Selector must be a string',
        code: 'INVALID_SELECTOR_TYPE',
      });
    }
  }

  /**
   * Validate wait action
   */
  private validateWaitAction(action: WaitAction, errors: ValidationError[]): void {
    if (!action.waitType || !['selector', 'navigation', 'timeout', 'function'].includes(action.waitType)) {
      errors.push({
        field: 'waitType',
        message: 'Invalid wait type',
        code: 'INVALID_WAIT_TYPE',
      });
    }

    if (action.waitType === 'selector' && !action.selector) {
      errors.push({
        field: 'selector',
        message: 'Selector required for selector wait',
        code: 'MISSING_SELECTOR_FOR_WAIT',
      });
    }

    if (action.waitType === 'timeout' && !action.duration) {
      errors.push({
        field: 'duration',
        message: 'Duration required for timeout wait',
        code: 'MISSING_DURATION_FOR_WAIT',
      });
    }

    if (action.waitType === 'function' && !action.function) {
      errors.push({
        field: 'function',
        message: 'Function required for function wait',
        code: 'MISSING_FUNCTION_FOR_WAIT',
      });
    }
  }

  /**
   * Validate scroll action
   */
  private validateScrollAction(action: ScrollAction, errors: ValidationError[]): void {
    if (action.direction && !['up', 'down', 'left', 'right'].includes(action.direction)) {
      errors.push({
        field: 'direction',
        message: 'Invalid scroll direction',
        code: 'INVALID_SCROLL_DIRECTION',
      });
    }

    if (action.distance && action.distance < 0) {
      errors.push({
        field: 'distance',
        message: 'Distance must be positive',
        code: 'INVALID_DISTANCE',
      });
    }
  }

  /**
   * Validate evaluate action
   */
  private validateEvaluateAction(
    action: EvaluateAction,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    if (!action.function) {
      errors.push({
        field: 'function',
        message: 'Function is required for evaluate action',
        code: 'MISSING_FUNCTION',
      });
    } else {
      // Basic security check for dangerous patterns
      const dangerousPatterns = [
        /eval\s*\(/,
        /Function\s*\(/,
        /setTimeout\s*\(/,
        /setInterval\s*\(/,
        /import\s*\(/,
        /require\s*\(/,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(action.function)) {
          warnings.push({
            field: 'function',
            message: 'Function contains potentially dangerous patterns',
            code: 'DANGEROUS_FUNCTION',
          });
          break;
        }
      }
    }
  }

  /**
   * Validate upload action
   */
  private validateUploadAction(action: UploadAction, errors: ValidationError[]): void {
    if (!action.selector) {
      errors.push({
        field: 'selector',
        message: 'Selector is required for upload action',
        code: 'MISSING_SELECTOR',
      });
    }

    if (!action.filePaths || !Array.isArray(action.filePaths) || action.filePaths.length === 0) {
      errors.push({
        field: 'filePaths',
        message: 'File paths array is required for upload action',
        code: 'MISSING_FILE_PATHS',
      });
    }
  }

  /**
   * Validate cookie action
   */
  private validateCookieAction(action: CookieAction, errors: ValidationError[]): void {
    if (!action.operation || !['set', 'get', 'delete', 'clear'].includes(action.operation)) {
      errors.push({
        field: 'operation',
        message: 'Invalid cookie operation',
        code: 'INVALID_COOKIE_OPERATION',
      });
    }

    if (action.operation === 'set' && (!action.cookies || action.cookies.length === 0)) {
      errors.push({
        field: 'cookies',
        message: 'Cookies array is required for set operation',
        code: 'MISSING_COOKIES_FOR_SET',
      });
    }

    if (action.cookies) {
      for (const cookie of action.cookies) {
        if (!cookie.name) {
          errors.push({
            field: 'cookies.name',
            message: 'Cookie name is required',
            code: 'MISSING_COOKIE_NAME',
          });
        }
      }
    }
  }

  /**
   * Validate execution context
   */
  private validateContext(context: ActionContext, errors: ValidationError[]): void {
    if (!context.sessionId) {
      errors.push({
        field: 'context.sessionId',
        message: 'Session ID is required',
        code: 'MISSING_SESSION_ID',
      });
    }

    if (!context.contextId) {
      errors.push({
        field: 'context.contextId',
        message: 'Context ID is required',
        code: 'MISSING_CONTEXT_ID',
      });
    }
  }

  /**
   * Validate security aspects
   */
  private async validateSecurity(
    action: BrowserAction,
    context: ActionContext,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): Promise<void> {
    // Check for suspicious selectors
    const selector = (action as { selector?: string }).selector;
    if (selector) {
      const suspiciousPatterns = [
        /javascript:/i,
        /vbscript:/i,
        /data:/i,
        /<script/i,
        /onload=/i,
        /onerror=/i,
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(selector)) {
          warnings.push({
            field: 'selector',
            message: 'Selector contains potentially suspicious content',
            code: 'SUSPICIOUS_SELECTOR',
          });
          break;
        }
      }
    }

    // Check for suspicious URLs
    if (action.type === 'navigate') {
      const navAction = action as NavigateAction;
      if (navAction.url) {
        try {
          const url = new URL(navAction.url);
          if (url.protocol === 'javascript:' || url.protocol === 'data:') {
            errors.push({
              field: 'url',
              message: 'Dangerous URL protocol detected',
              code: 'DANGEROUS_URL_PROTOCOL',
            });
          }
        } catch {
          // URL validation already handled above
        }
      }
    }
  }
}