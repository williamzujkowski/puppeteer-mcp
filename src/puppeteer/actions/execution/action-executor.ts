/**
 * Main action executor coordinator using modular components
 * @module puppeteer/actions/execution/action-executor
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
  ValidationResult,
} from '../../interfaces/action-executor.interface.js';
import type { PageManager } from '../../interfaces/page-manager.interface.js';
import type { BatchExecutionOptions } from '../batch-executor.js';
import { ActionValidator } from './action-validator.js';
import { ActionContextManager } from './context-manager.js';
import { ActionErrorHandler } from './error-handler.js';
import { ActionDispatcher } from './action-dispatcher.js';
import { ActionHistoryManager } from '../history-manager.js';
import { BatchActionExecutor } from '../batch-executor.js';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:modular-action-executor');

/**
 * Modular browser action executor implementation
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class ModularBrowserActionExecutor implements ActionExecutor {
  private readonly validator: ActionValidator;
  private readonly contextManager: ActionContextManager;
  private readonly errorHandler: ActionErrorHandler;
  private readonly dispatcher: ActionDispatcher;
  private readonly historyManager: ActionHistoryManager;
  private readonly batchExecutor: BatchActionExecutor;

  constructor(pageManager?: PageManager) {
    this.validator = new ActionValidator();
    this.contextManager = new ActionContextManager(pageManager);
    this.errorHandler = new ActionErrorHandler();
    this.dispatcher = new ActionDispatcher();
    this.historyManager = new ActionHistoryManager();
    this.batchExecutor = new BatchActionExecutor(this);
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
    context: ActionContext,
  ): Promise<ActionResult<T>> {
    const startTime = Date.now();

    try {
      // Log security event for action execution start
      await logSecurityEvent(SecurityEventType.COMMAND_EXECUTED, {
        userId: context.userId,
        resource: `page:${action.pageId}`,
        action: `${action.type}_start`,
        result: 'success',
        metadata: {
          sessionId: context.sessionId,
          contextId: context.contextId,
          actionType: action.type,
          actionId: `${action.type}-${Date.now()}`,
          startTime: new Date().toISOString(),
        },
      });

      logger.info('Executing browser action with modular components', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        pageId: action.pageId,
      });

      // Phase 1: Validation
      const validationResult = await this.validate(action, context);
      if (!validationResult.valid) {
        const result = await this.errorHandler.handleValidationFailure<T>(
          action,
          context,
          validationResult,
          Date.now() - startTime,
        );
        this.historyManager.addToHistory(context, result);
        return result;
      }

      // Phase 2: Context and Page Management
      const page = await this.contextManager.getPage(action.pageId, context);
      if (!page) {
        const result = this.errorHandler.createPageNotFoundResult<T>(
          action,
          Date.now() - startTime,
        );
        this.historyManager.addToHistory(context, result);
        return result;
      }

      // Validate page readiness
      const isPageReady = await this.contextManager.validatePageReady(page, context);
      if (!isPageReady) {
        const result = await this.errorHandler.handleExecutionError<T>(
          action,
          context,
          new Error('Page is not ready for action execution'),
          Date.now() - startTime,
        );
        this.historyManager.addToHistory(context, result);
        return result;
      }

      // Setup page for action
      await this.contextManager.setupPageForAction(page, context, action.timeout);

      // Phase 3: Action Execution with Error Handling
      const result = await this.errorHandler.executeWithRetry(
        (actionToExecute, pageInstance, executionContext) => 
          this.dispatcher.dispatch(actionToExecute, pageInstance, executionContext),
        action,
        page,
        context,
      );

      // Phase 4: Cleanup and History
      await this.contextManager.cleanupAfterAction(page, context, true);
      this.historyManager.addToHistory(context, result);

      logger.info('Browser action executed successfully with modular components', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        success: result.success,
        duration: result.duration,
      });

      // Log successful action completion
      await logSecurityEvent(SecurityEventType.COMMAND_EXECUTED, {
        userId: context.userId,
        resource: `page:${action.pageId}`,
        action: `${action.type}_complete`,
        result: result.success ? 'success' : 'failure',
        metadata: {
          sessionId: context.sessionId,
          contextId: context.contextId,
          actionType: action.type,
          actionId: `${action.type}-${Date.now()}`,
          duration: result.duration,
          success: result.success,
          error: result.error,
        },
      });

      return result as ActionResult<T>;
    } catch (error) {
      const result = await this.errorHandler.handleExecutionError<T>(
        action,
        context,
        error,
        Date.now() - startTime,
      );

      logger.error('Browser action execution failed with modular components', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        error: result.error,
        duration: result.duration,
      });

      // Log action execution failure
      await logSecurityEvent(SecurityEventType.COMMAND_EXECUTED, {
        userId: context.userId,
        resource: `page:${action.pageId}`,
        action: `${action.type}_error`,
        result: 'failure',
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          sessionId: context.sessionId,
          contextId: context.contextId,
          actionType: action.type,
          actionId: `${action.type}-${Date.now()}`,
          duration: result.duration,
          error: result.error,
        },
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
    options?: BatchExecutionOptions,
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
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    try {
      logger.debug('Validating browser action with modular validator', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
      });

      // Check if action type is supported by dispatcher
      if (!this.dispatcher.isActionSupported(action.type)) {
        return {
          valid: false,
          errors: [
            {
              field: 'type',
              message: `Unsupported action type: ${action.type}`,
              code: 'UNSUPPORTED_ACTION',
            },
          ],
        };
      }

      // Validate dispatcher action compatibility
      if (!this.dispatcher.validateActionForDispatch(action)) {
        return {
          valid: false,
          errors: [
            {
              field: 'action',
              message: 'Action is not valid for dispatch',
              code: 'INVALID_ACTION_FOR_DISPATCH',
            },
          ],
        };
      }

      // Perform detailed validation
      return await this.validator.validate(action, context);
    } catch (error) {
      logger.error('Action validation failed with modular validator', {
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
   * @param actions - Array of browser actions
   * @param context - Execution context
   * @returns Array of validation results
   */
  async validateBatch(
    actions: BrowserAction[],
    context: ActionContext,
  ): Promise<ValidationResult[]> {
    return this.validator.validateBatch(actions, context);
  }

  /**
   * Register custom action handler
   * @param actionType - Action type identifier
   * @param handler - Action handler function
   */
  registerHandler<T extends BrowserAction>(
    actionType: string,
    handler: (action: T, context: ActionContext) => Promise<ActionResult>,
  ): void {
    // Wrap the handler to include page retrieval
    this.dispatcher.registerHandler(actionType, async (action, page, context) => {
      return handler(action as T, context);
    });
  }

  /**
   * Unregister action handler
   * @param actionType - Action type identifier
   */
  unregisterHandler(actionType: string): void {
    this.dispatcher.unregisterHandler(actionType);
  }

  /**
   * Get supported action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return this.dispatcher.getSupportedActions();
  }

  /**
   * Check if action type is supported
   * @param actionType - Action type to check
   * @returns True if supported
   */
  isActionSupported(actionType: string): boolean {
    return this.dispatcher.isActionSupported(actionType);
  }

  /**
   * Get action execution history
   * @param context - Execution context
   * @param options - Query options
   * @returns Array of historical action results
   * @nist au-7 "Audit reduction and report generation"
   */
  async getHistory(
    context: ActionContext,
    options?: {
      limit?: number;
      offset?: number;
      actionTypes?: string[];
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<ActionResult[]> {
    return this.historyManager.getHistory(context, options);
  }

  /**
   * Clear action history
   * @param context - Execution context
   * @param before - Clear history before this date
   * @nist au-4 "Audit storage capacity"
   */
  async clearHistory(context: ActionContext, before?: Date): Promise<void> {
    this.historyManager.clearHistory(context, before);
  }

  /**
   * Get action metrics
   * @param context - Execution context
   * @returns Action execution metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
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
   * Get modular executor statistics
   * @returns Executor component statistics
   */
  getExecutorStats(): {
    components: string[];
    dispatcher: ReturnType<ActionDispatcher['getDispatcherStats']>;
    contextManager: ReturnType<ActionContextManager['getCacheStats']>;
    errorHandler: ReturnType<ActionErrorHandler['getRetryConfig']>;
    hasPageManager: boolean;
  } {
    return {
      components: [
        'ActionValidator',
        'ActionContextManager',
        'ActionErrorHandler',
        'ActionDispatcher',
        'ActionHistoryManager',
        'BatchActionExecutor',
      ],
      dispatcher: this.dispatcher.getDispatcherStats(),
      contextManager: this.contextManager.getCacheStats(),
      errorHandler: this.errorHandler.getRetryConfig(),
      hasPageManager: this.contextManager.hasPageManager(),
    };
  }

  /**
   * Get action categories and their supported types
   * @returns Map of categories to action types
   */
  getActionCategories(): Map<string, string[]> {
    return this.dispatcher.getActionCategories();
  }

  /**
   * Get recommendation for action execution
   * @param actionType - Action type
   * @returns Execution recommendation
   */
  getExecutionRecommendation(actionType: string): ReturnType<ActionDispatcher['getExecutorRecommendation']> {
    return this.dispatcher.getExecutorRecommendation(actionType);
  }

  /**
   * Update retry configuration
   * @param config - Partial retry configuration
   */
  updateRetryConfig(config: Parameters<ActionErrorHandler['updateRetryConfig']>[0]): void {
    this.errorHandler.updateRetryConfig(config);
  }

  /**
   * Clear page cache
   */
  clearPageCache(): void {
    this.contextManager.clearCache();
  }

  /**
   * Get internal components for testing purposes
   * @internal
   */
  getInternalComponents(): {
    validator: ActionValidator;
    contextManager: ActionContextManager;
    errorHandler: ActionErrorHandler;
    dispatcher: ActionDispatcher;
    historyManager: ActionHistoryManager;
    batchExecutor: BatchActionExecutor;
  } {
    return {
      validator: this.validator,
      contextManager: this.contextManager,
      errorHandler: this.errorHandler,
      dispatcher: this.dispatcher,
      historyManager: this.historyManager,
      batchExecutor: this.batchExecutor,
    };
  }
}