/**
 * Batch action execution for browser automation
 * @module puppeteer/actions/batch-executor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { 
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
  ActionExecutor
} from '../interfaces/action-executor.interface.js';
import { validateActionBatch } from './validation.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('puppeteer:batch-executor');

/**
 * Batch execution options
 */
export interface BatchExecutionOptions {
  stopOnError?: boolean;
  parallel?: boolean;
  maxConcurrency?: number;
}

/**
 * Handles batch execution of browser actions
 * @nist ac-3 "Access enforcement"
 */
export class BatchActionExecutor {
  constructor(private readonly executor: ActionExecutor) {}

  /**
   * Execute multiple actions in sequence or parallel
   * @param actions - Array of browser actions
   * @param context - Execution context
   * @param options - Execution options
   * @returns Array of action results
   */
  async executeBatch(
    actions: BrowserAction[],
    context: ActionContext,
    options?: BatchExecutionOptions
  ): Promise<ActionResult[]> {
    logger.info('Executing action batch', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionCount: actions.length,
      parallel: options?.parallel,
      stopOnError: options?.stopOnError,
    });

    if (actions.length === 0) {
      return [];
    }

    if (actions.length > 100) {
      throw new Error('Too many actions in batch (max 100)');
    }

    // Validate all actions first
    const validationResults = await this.validateBatch(actions, context);
    const invalidActions = validationResults.filter(result => !result.valid);
    
    if (invalidActions.length > 0) {
      throw new Error(`Invalid actions in batch: ${invalidActions.length} of ${actions.length}`);
    }

    // Delegate to specific execution method based on mode
    const results = options?.parallel === true
      ? await this.executeParallel(actions, context, options)
      : await this.executeSequential(actions, context, options);

    logger.info('Action batch execution completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      totalActions: actions.length,
      executedActions: results.length,
      successfulActions: results.filter(r => r.success).length,
      failedActions: results.filter(r => !r.success).length,
    });

    return results;
  }

  /**
   * Execute actions in parallel
   */
  private async executeParallel(
    actions: BrowserAction[],
    context: ActionContext,
    options?: BatchExecutionOptions
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    const maxConcurrency = Math.min(options?.maxConcurrency ?? 5, 10);
    const chunks = this.chunkArray(actions, maxConcurrency);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(action => this.executor.execute(action, context))
      );
      results.push(...chunkResults);
      
      // Stop on error if requested
      if (options?.stopOnError === true && chunkResults.some(result => !result.success)) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Execute actions sequentially
   */
  private async executeSequential(
    actions: BrowserAction[],
    context: ActionContext,
    options?: BatchExecutionOptions
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    
    for (const action of actions) {
      const result = await this.executor.execute(action, context);
      results.push(result);
      
      // Stop on error if requested
      if (options?.stopOnError === true && !result.success) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Validate multiple actions
   * @param actions - Array of browser actions
   * @param context - Execution context
   * @returns Array of validation results
   */
  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  private async validateBatch(
    actions: BrowserAction[],
    context: ActionContext
  ): Promise<ValidationResult[]> {
    logger.debug('Validating action batch', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionCount: actions.length,
    });

    try {
      return validateActionBatch(actions);
    } catch (error) {
      logger.error('Batch validation failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionCount: actions.length,
        error: error instanceof Error ? error.message : 'Unknown batch validation error',
      });

      // Return error result for all actions
      return actions.map(() => ({
        valid: false,
        errors: [{
          field: 'batch',
          message: error instanceof Error ? error.message : 'Unknown batch validation error',
          code: 'BATCH_VALIDATION_ERROR',
        }],
      }));
    }
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}