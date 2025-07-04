/**
 * Action executor implementation for browser automation
 * @module puppeteer/actions/action-executor
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type { 
  ActionExecutor,
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult
} from '../interfaces/action-executor.interface.js';
import type { PageManager } from '../interfaces/page-manager.interface.js';
import { validateAction } from './validation.js';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { ActionHistoryManager } from './history-manager.js';
import { BatchActionExecutor, type BatchExecutionOptions } from './batch-executor.js';
import { ActionHandlerRegistry } from './handler-registry.js';
import { 
  handleValidationFailure, 
  handleExecutionError, 
  createPageNotFoundResult 
} from './execution-helper.js';

const logger = createLogger('puppeteer:action-executor');

/**
 * Browser action executor implementation
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class BrowserActionExecutor implements ActionExecutor {
  private readonly historyManager: ActionHistoryManager;
  private readonly batchExecutor: BatchActionExecutor;
  private readonly handlerRegistry: ActionHandlerRegistry;
  private pageManager?: PageManager;

  constructor(pageManager?: PageManager) {
    this.pageManager = pageManager;
    this.historyManager = new ActionHistoryManager();
    this.batchExecutor = new BatchActionExecutor(this);
    this.handlerRegistry = new ActionHandlerRegistry();
  }

  /**
   * Execute a browser action
   * @param action - Browser action to execute
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute<T = unknown>(
    action: BrowserAction,
    context: ActionContext
  ): Promise<ActionResult<T>> {
    const startTime = Date.now();
    
    try {
      // Log security event for action execution
      await logSecurityEvent(SecurityEventType.COMMAND_EXECUTED, {
        userId: context.userId,
        resource: `page:${action.pageId}`,
        action: action.type,
        result: 'success',
        metadata: {
          sessionId: context.sessionId,
          contextId: context.contextId,
          actionType: action.type,
        },
      });

      logger.info('Executing browser action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        pageId: action.pageId,
      });

      // Validate action
      const validationResult = await this.validate(action, context);
      if (!validationResult.valid) {
        const result = await handleValidationFailure<T>(
          action, 
          context, 
          validationResult, 
          Date.now() - startTime
        );
        this.historyManager.addToHistory(context, result);
        return result;
      }

      // Get page instance
      const page = await this.getPageInstance(action.pageId, context);
      if (!page) {
        const result = createPageNotFoundResult<T>(action, Date.now() - startTime);
        this.historyManager.addToHistory(context, result);
        return result;
      }

      // Execute action with retry logic
      const result = await this.executeWithRetry(action, page, context);

      // Add to history
      this.historyManager.addToHistory(context, result);

      logger.info('Browser action executed successfully', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        success: result.success,
        duration: result.duration,
      });

      return result as ActionResult<T>;

    } catch (error) {
      const result = await handleExecutionError<T>(
        action, 
        context, 
        error, 
        Date.now() - startTime
      );
      
      logger.error('Browser action execution failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        error: result.error,
        duration: result.duration,
      });

      this.historyManager.addToHistory(context, result);
      return result;
    }
  }

  /**
   * Execute multiple actions in sequence or parallel
   * @param actions - Array of browser actions
   * @param context - Execution context
   * @param options - Execution options
   * @returns Array of action results
   */
  executeBatch(
    actions: BrowserAction[],
    context: ActionContext,
    options?: BatchExecutionOptions
  ): Promise<ActionResult[]> {
    return this.batchExecutor.executeBatch(actions, context, options);
  }

  /**
   * Validate an action before execution
   * @param action - Browser action to validate
   * @param context - Execution context
   * @returns Validation result
   * @nist si-10 "Information input validation"
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    try {
      logger.debug('Validating browser action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
      });

      // Check if action type is supported
      if (!this.isActionSupported(action.type)) {
        return {
          valid: false,
          errors: [{
            field: 'type',
            message: `Unsupported action type: ${action.type}`,
            code: 'UNSUPPORTED_ACTION',
          }],
        };
      }

      // Perform detailed validation
      const result = validateAction(action);

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
        errors: [{
          field: 'unknown',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'VALIDATION_ERROR',
        }],
      };
    }
  }

  /**
   * Validate multiple actions
   * @param actions - Array of browser actions
   * @param context - Execution context
   * @returns Array of validation results
   */
   
  async validateBatch(
    actions: BrowserAction[],
    context: ActionContext
  ): Promise<ValidationResult[]> {
    return Promise.all(actions.map(action => this.validate(action, context)));
  }

  /**
   * Register custom action handler
   * @param actionType - Action type identifier
   * @param handler - Action handler function
   */
  registerHandler<T extends BrowserAction>(
    actionType: string,
    handler: (action: T, context: ActionContext) => Promise<ActionResult>
  ): void {
    // Wrap the handler to include page retrieval
    this.handlerRegistry.registerHandler(actionType, (action, _page, context) => {
      return handler(action as T, context);
    });
  }

  /**
   * Unregister action handler
   * @param actionType - Action type identifier
   */
  unregisterHandler(actionType: string): void {
    this.handlerRegistry.unregisterHandler(actionType);
  }

  /**
   * Get supported action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return this.handlerRegistry.getSupportedActions();
  }

  /**
   * Check if action type is supported
   * @param actionType - Action type to check
   * @returns True if supported
   */
  isActionSupported(actionType: string): boolean {
    return this.handlerRegistry.isActionSupported(actionType);
  }

  /**
   * Get action execution history
   * @param context - Execution context
   * @param options - Query options
   * @returns Array of historical action results
   * @nist au-7 "Audit reduction and report generation"
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getHistory(
    context: ActionContext,
    options?: {
      limit?: number;
      offset?: number;
      actionTypes?: string[];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<ActionResult[]> {
    return this.historyManager.getHistory(context, options);
  }

  /**
   * Clear action history
   * @param context - Execution context
   * @param before - Clear history before this date
   * @nist au-4 "Audit storage capacity"
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async clearHistory(context: ActionContext, before?: Date): Promise<void> {
    this.historyManager.clearHistory(context, before);
  }

  /**
   * Get action metrics
   * @param context - Execution context
   * @returns Action execution metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getMetrics(context: ActionContext): Promise<{
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    averageDuration: number;
    actionTypeBreakdown: Record<string, number>;
  }> {
    return this.historyManager.getMetrics(context);
  }

  /**
   * Get handler registry for testing purposes
   * @internal
   */
  getHandlerRegistry(): ActionHandlerRegistry {
    return this.handlerRegistry;
  }

  /**
   * Execute action with retry logic
   */
  private async executeWithRetry(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
    maxRetries: number = 3
  ): Promise<ActionResult> {
    const handler = this.handlerRegistry.getHandler(action.type);
    if (!handler) {
      throw new Error(`No handler found for action type: ${action.type}`);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await handler(action, page, context);
        
        if (result.success || attempt === maxRetries) {
          return result;
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise<void>(resolve => { setTimeout(resolve, delay); });
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retry
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise<void>(resolve => { setTimeout(resolve, delay); });
      }
    }

    // If we get here, all retries failed
    throw lastError ?? new Error('Action execution failed after retries');
  }

  /**
   * Get page instance from page manager
   */
  private async getPageInstance(pageId: string, context: ActionContext): Promise<Page | null> {
    if (!this.pageManager) {
      throw new Error('Page manager not configured');
    }

    try {
      const page = await this.pageManager.getPage(pageId, context.sessionId);
      return page ?? null;
    } catch (error) {
      logger.error('Failed to get page instance', {
        pageId,
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }
}