/**
 * Main action validator orchestrator using Strategy pattern
 * @module puppeteer/actions/execution/validation
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import type {
  BrowserAction,
  ActionContext,
  ValidationResult,
} from '../../../interfaces/action-executor.interface.js';
import type { ValidationError } from '../types.js';
import { ValidatorFactory } from './validator-factory.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:validation-orchestrator');

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Skip certain validator types */
  skipValidators?: string[];
  /** Run validators in parallel */
  parallel?: boolean;
  /** Stop on first error */
  stopOnFirstError?: boolean;
  /** Custom timeout for validation */
  timeout?: number;
}

/**
 * Main validation orchestrator using Strategy pattern
 * @nist si-10 "Information input validation"
 */
export class ValidationOrchestrator {
  /**
   * Validate an action using all applicable validators
   * @param action - Action to validate
   * @param context - Execution context
   * @param options - Validation options
   * @returns Combined validation result
   */
  async validate(
    action: BrowserAction,
    context: ActionContext,
    options: ValidationOptions = {},
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      logger.debug('Starting action validation', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        options,
      });

      // Get applicable validators
      const validators = ValidatorFactory.getValidatorsForAction(action).filter(
        (v) => !options.skipValidators?.includes(v.constructor.name),
      );

      if (validators.length === 0) {
        logger.warn('No validators found for action', {
          actionType: action.type,
        });
        return { valid: true, errors: [], warnings: [] };
      }

      // Run validation
      const results = options.parallel
        ? await this.runParallel(validators, action, context, options)
        : await this.runSequential(validators, action, context, options);

      // Combine results
      const combined = this.combineResults(results);

      const duration = Date.now() - startTime;
      logger.debug('Action validation completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        valid: combined.valid,
        errorCount: combined.errors.length,
        warningCount: combined.warnings?.length ?? 0,
        duration,
      });

      return combined;
    } catch (error) {
      logger.error('Validation orchestration failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        valid: false,
        errors: [
          {
            field: 'validation',
            message: error instanceof Error ? error.message : 'Validation failed',
            code: 'VALIDATION_ORCHESTRATION_ERROR',
          },
        ],
      };
    }
  }

  /**
   * Validate multiple actions
   * @param actions - Actions to validate
   * @param context - Execution context
   * @param options - Validation options
   * @returns Array of validation results
   */
  async validateBatch(
    actions: BrowserAction[],
    context: ActionContext,
    options: ValidationOptions = {},
  ): Promise<ValidationResult[]> {
    logger.debug('Starting batch validation', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionCount: actions.length,
    });

    const results = await Promise.all(
      actions.map((action) => this.validate(action, context, options)),
    );

    const validCount = results.filter((r) => r.valid).length;
    logger.debug('Batch validation completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      totalActions: actions.length,
      validActions: validCount,
      invalidActions: actions.length - validCount,
    });

    return results;
  }

  /**
   * Run validators in parallel
   * @param validators - Validators to run
   * @param action - Action to validate
   * @param context - Execution context
   * @param options - Validation options
   * @returns Validation results
   */
  private async runParallel(
    validators: Array<{
      validate: (action: BrowserAction, context: ActionContext) => Promise<ValidationResult>;
    }>,
    action: BrowserAction,
    context: ActionContext,
    options: ValidationOptions,
  ): Promise<ValidationResult[]> {
    const timeout = options.timeout ?? 5000;

    const promises = validators.map((validator) =>
      Promise.race([validator.validate(action, context), this.createTimeoutPromise(timeout)]),
    );

    return Promise.all(promises);
  }

  /**
   * Run validators sequentially
   * @param validators - Validators to run
   * @param action - Action to validate
   * @param context - Execution context
   * @param options - Validation options
   * @returns Validation results
   */
  private async runSequential(
    validators: Array<{
      validate: (action: BrowserAction, context: ActionContext) => Promise<ValidationResult>;
    }>,
    action: BrowserAction,
    context: ActionContext,
    options: ValidationOptions,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const timeout = options.timeout ?? 5000;

    for (const validator of validators) {
      const result = await Promise.race([
        validator.validate(action, context),
        this.createTimeoutPromise(timeout),
      ]);

      results.push(result);

      // Stop on first error if requested
      if (options.stopOnFirstError && !result.valid) {
        logger.debug('Stopping validation on first error', {
          validator: validator.constructor.name,
          errors: result.errors,
        });
        break;
      }
    }

    return results;
  }

  /**
   * Create timeout promise
   * @param timeout - Timeout in milliseconds
   * @returns Promise that rejects after timeout
   */
  private createTimeoutPromise(timeout: number): Promise<ValidationResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Validation timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Combine multiple validation results
   * @param results - Results to combine
   * @returns Combined result
   */
  private combineResults(results: ValidationResult[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const processedErrors = new Set<string>();
    const processedWarnings = new Set<string>();

    for (const result of results) {
      // Combine errors (deduplicate by field + code)
      for (const error of result.errors) {
        const key = `${error.field}:${error.code}`;
        if (!processedErrors.has(key)) {
          errors.push(error);
          processedErrors.add(key);
        }
      }

      // Combine warnings (deduplicate by field + code)
      if (result.warnings) {
        for (const warning of result.warnings) {
          const key = `${warning.field}:${warning.code}`;
          if (!processedWarnings.has(key)) {
            warnings.push(warning);
            processedWarnings.add(key);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

// Export commonly used items for convenience
export { ValidatorFactory, ValidatorType } from './validator-factory.js';
export type { IActionValidator } from './base-validator.js';

// Create and export default orchestrator instance
export const actionValidator = new ValidationOrchestrator();
