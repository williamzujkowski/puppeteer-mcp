/**
 * Code execution strategy for page.evaluate operations
 * @module puppeteer/actions/execution/evaluation/code-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-11 "Error handling"
 * @nist sc-18 "Mobile code"
 */

import type { Page } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../../interfaces/action-executor.interface.js';
import type {
  BaseEvaluationStrategy,
  CodeEvaluationConfig,
  SecurityValidationResult,
  EvaluationMetrics,
} from './types.js';
import { EVALUATION_TIMEOUTS } from './types.js';
import { createSecurityValidator } from './security-validator.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:code-executor');

/**
 * Strategy for executing JavaScript code evaluation
 * @nist ac-3 "Access enforcement"
 * @nist sc-18 "Mobile code"
 */
export class CodeExecutionStrategy implements BaseEvaluationStrategy {
  private readonly securityValidator = createSecurityValidator();

  /**
   * Execute JavaScript code evaluation
   * @param config - Code evaluation configuration
   * @param page - Puppeteer page instance
   * @param context - Action execution context
   * @returns Promise resolving to action result
   * @nist sc-18 "Mobile code"
   */
  async execute(
    config: CodeEvaluationConfig,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const metrics = this.createMetrics(config);

    try {
      // Validate configuration first
      const validationResult = this.validateConfig(config);
      if (!validationResult.isValid) {
        return this.createErrorResult(
          'evaluate',
          validationResult.error ?? 'Code validation failed',
          metrics,
          context,
        );
      }

      // Execute the code evaluation
      const result = await this.executeCodeEvaluation(config, page, context);

      // Process and return successful result
      return this.createSuccessResult(result, config, metrics, context);
    } catch (error) {
      return this.handleEvaluationError(error, metrics, context);
    }
  }

  /**
   * Execute code evaluation with timeout management
   * @param config - Evaluation configuration
   * @param page - Puppeteer page instance
   * @param context - Action context
   * @returns Promise resolving to evaluation result
   */
  private async executeCodeEvaluation(
    config: CodeEvaluationConfig,
    page: Page,
    context: ActionContext,
  ): Promise<unknown> {
    logger.debug('Executing code evaluation', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      codeLength: config.functionToEvaluate.length,
      argsCount: config.args?.length ?? 0,
    });

    const timeout = config.timeout ?? EVALUATION_TIMEOUTS.CODE_EVALUATION;
    const originalTimeout = page.getDefaultTimeout();

    try {
      page.setDefaultTimeout(timeout);

      const preparedArgs = this.prepareArguments(config.args ?? []);
      return await page.evaluate(config.functionToEvaluate, ...preparedArgs);
    } finally {
      page.setDefaultTimeout(originalTimeout);
    }
  }

  /**
   * Create success result from evaluation
   * @param result - Evaluation result
   * @param config - Original configuration
   * @param metrics - Execution metrics
   * @param context - Action context
   * @returns Success action result
   */
  private createSuccessResult(
    result: unknown,
    config: CodeEvaluationConfig,
    metrics: EvaluationMetrics,
    context: ActionContext,
  ): ActionResult {
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.success = true;

    logger.info('Code evaluation completed successfully', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      duration: metrics.duration,
      resultType: typeof result,
    });

    // Handle large results safely
    const shouldTruncate = this.shouldTruncateResult(result);
    const finalResult = shouldTruncate ? this.truncateResult(result) : result;

    return {
      success: true,
      actionType: 'evaluate',
      data: finalResult, // Return actual result directly for test compatibility
      duration: metrics.duration,
      timestamp: new Date(),
      metadata: {
        result: finalResult,
        resultType: typeof result,
        argsCount: config.args?.length ?? 0,
        codeLength: config.functionToEvaluate.length,
        truncated: shouldTruncate,
        functionLength: config.functionToEvaluate.length,
        hasArgs: (config.args?.length ?? 0) > 0,
        executionTime: metrics.duration,
      },
    };
  }

  /**
   * Handle evaluation error
   * @param error - Error that occurred
   * @param metrics - Execution metrics
   * @param context - Action context
   * @returns Error action result
   */
  private handleEvaluationError(
    error: unknown,
    metrics: EvaluationMetrics,
    context: ActionContext,
  ): ActionResult {
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.success = false;

    const errorMessage = error instanceof Error ? error.message : 'Code evaluation failed';

    logger.error('Code evaluation failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      error: errorMessage,
      duration: metrics.duration,
    });

    return this.createErrorResult('evaluate', errorMessage, metrics, context);
  }

  /**
   * Validate code evaluation configuration
   * @param config - Configuration to validate
   * @returns Security validation result
   * @nist si-10 "Information input validation"
   */
  validateConfig(config: CodeEvaluationConfig): SecurityValidationResult {
    // Validate the JavaScript code
    const jsValidation = this.securityValidator.validateJavaScript(config.functionToEvaluate);

    if (!jsValidation.isValid) {
      return jsValidation;
    }

    // Additional configuration validation
    const args = config.args ?? [];
    if (args.length > 10) {
      return {
        isValid: false,
        error: 'Too many arguments provided (maximum 10)',
        issues: [
          {
            type: 'size_limit',
            message: `Argument count exceeds limit: ${args.length} > 10`,
            severity: 'medium',
          },
        ],
      };
    }

    // Validate argument sizes
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      const argSize = this.getArgumentSize(arg);
      if (argSize > 10000) {
        return {
          isValid: false,
          error: `Argument ${index} is too large (${argSize} bytes)`,
          issues: [
            {
              type: 'size_limit',
              message: `Argument ${index} exceeds size limit: ${argSize} bytes`,
              severity: 'medium',
            },
          ],
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Get supported evaluation types
   * @returns Array of supported types
   */
  getSupportedTypes(): string[] {
    return ['evaluate', 'code'];
  }

  /**
   * Create metrics object for tracking
   * @param config - Configuration being executed
   * @returns Metrics object
   */
  private createMetrics(config: CodeEvaluationConfig): EvaluationMetrics {
    return {
      startTime: Date.now(),
      codeSize: config.functionToEvaluate.length,
      argumentCount: config.args?.length ?? 0,
      success: false,
    };
  }

  /**
   * Calculate size of an argument for validation
   * @param arg - Argument to measure
   * @returns Size in bytes (approximate)
   */
  private getArgumentSize(arg: unknown): number {
    try {
      return JSON.stringify(arg).length;
    } catch {
      // If serialization fails, estimate based on type
      if (typeof arg === 'string') {
        return arg.length;
      } else if (typeof arg === 'number') {
        return 8; // Approximate size of a number
      } else if (typeof arg === 'boolean') {
        return 1;
      }
      return 100; // Conservative estimate for complex objects
    }
  }

  /**
   * Create standardized error result
   * @param actionType - Type of action that failed
   * @param errorMessage - Error message
   * @param metrics - Execution metrics
   * @param context - Action context
   * @returns Error action result
   */
  private createErrorResult(
    actionType: string,
    errorMessage: string,
    metrics: EvaluationMetrics,
    context: ActionContext,
  ): ActionResult {
    return {
      success: false,
      actionType,
      error: errorMessage,
      duration: metrics.duration ?? Date.now() - metrics.startTime,
      timestamp: new Date(),
      metadata: {
        sessionId: context.sessionId,
        contextId: context.contextId,
        codeSize: metrics.codeSize,
        argumentCount: metrics.argumentCount,
      },
    };
  }

  /**
   * Prepare arguments for evaluation (sanitization)
   * @param args - Raw arguments
   * @returns Sanitized arguments
   * @nist si-10 "Information input validation"
   */
  private prepareArguments(args: unknown[]): unknown[] {
    return args.map((arg) => {
      // For security, we avoid passing functions or complex objects
      // that might contain dangerous references
      if (typeof arg === 'function') {
        throw new Error('Function arguments are not allowed for security reasons');
      }

      // Deep clone simple objects to avoid reference issues
      if (arg !== null && typeof arg === 'object') {
        try {
          const serialized = JSON.stringify(arg);
          return JSON.parse(serialized) as unknown;
        } catch {
          throw new Error('Unable to serialize argument for evaluation');
        }
      }

      return arg;
    });
  }

  /**
   * Check if result should be truncated due to size
   * @param result - Result to check
   * @param maxSize - Maximum allowed size
   * @returns True if result should be truncated
   */
  private shouldTruncateResult(result: unknown, maxSize: number = 100000): boolean {
    try {
      const serialized = JSON.stringify(result);
      return serialized.length > maxSize;
    } catch {
      return false;
    }
  }

  /**
   * Truncate large results for security and performance
   * @param result - Result to truncate
   * @returns Truncated result with metadata
   */
  private truncateResult(result: unknown): { truncated: true; type: string; size: number } {
    const type = typeof result;
    let size = 0;

    try {
      size = JSON.stringify(result).length;
    } catch {
      size = -1; // Unable to measure
    }

    return {
      truncated: true,
      type,
      size,
    };
  }
}

/**
 * Create a new code execution strategy
 * @returns Code execution strategy instance
 * @nist ac-3 "Access enforcement"
 */
export function createCodeExecutionStrategy(): CodeExecutionStrategy {
  return new CodeExecutionStrategy();
}
