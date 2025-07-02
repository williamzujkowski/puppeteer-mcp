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
  ValidationResult,
  NavigateAction,
  ClickAction,
  TypeAction,
  SelectAction,
  KeyboardAction,
  MouseAction,
  ScreenshotAction,
  PDFAction,
  WaitAction,
  ScrollAction,
  EvaluateAction,
  UploadAction,
  CookieAction
} from '../interfaces/action-executor.interface.js';
import type { PageManager } from '../interfaces/page-manager.interface.js';
import { validateAction, validateActionBatch } from './validation.js';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../utils/logger.js';

// Import action handlers
import { handleNavigate } from './handlers/navigation.js';
import { 
  handleClick, 
  handleType, 
  handleSelect 
} from './handlers/interaction.js';
import { 
  handleEvaluate 
} from './handlers/evaluation.js';
import { 
  handleWait 
} from './handlers/waiting.js';
import { 
  handleScreenshot, 
  handlePDF 
} from './handlers/content.js';
import { 
  handleKeyboard 
} from './handlers/keyboard.js';
import { 
  handleMouse 
} from './handlers/mouse.js';
import { handleUpload } from './handlers/upload.js';
import { handleCookie } from './handlers/cookies.js';
import { 
  handleScroll 
} from './handlers/scroll.js';

const logger = createLogger('puppeteer:action-executor');

/**
 * Action handler function type
 */
type ActionHandler<T extends BrowserAction = BrowserAction> = (
  action: T,
  page: Page,
  context: ActionContext
) => Promise<ActionResult>;

/**
 * Browser action executor implementation
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class BrowserActionExecutor implements ActionExecutor {
  private readonly handlers = new Map<string, ActionHandler>();
  private readonly actionHistory = new Map<string, ActionResult[]>();
  private readonly maxHistorySize = 1000;
  private pageManager?: PageManager;

  constructor(pageManager?: PageManager) {
    this.pageManager = pageManager;
    this.registerDefaultHandlers();
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
        const error = `Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`;
        
        await logSecurityEvent(SecurityEventType.VALIDATION_FAILURE, {
          userId: context.userId,
          resource: `page:${action.pageId}`,
          action: action.type,
          result: 'failure',
          reason: error,
          metadata: {
            sessionId: context.sessionId,
            contextId: context.contextId,
            errors: validationResult.errors,
          },
        });

        const result: ActionResult<T> = {
          success: false,
          actionType: action.type,
          error,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };

        this.addToHistory(context, result);
        return result;
      }

      // Get page instance (this would be injected or retrieved from page manager)
      const page = await this.getPageInstance(action.pageId, context);
      if (!page) {
        const error = `Page not found: ${action.pageId}`;
        const result: ActionResult<T> = {
          success: false,
          actionType: action.type,
          error,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };

        this.addToHistory(context, result);
        return result;
      }

      // Execute action with retry logic
      const result = await this.executeWithRetry(action, page, context);

      // Add to history
      this.addToHistory(context, result);

      logger.info('Browser action executed successfully', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        success: result.success,
        duration: result.duration,
      });

      return result as ActionResult<T>;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown action execution error';

      await logSecurityEvent(SecurityEventType.ERROR, {
        userId: context.userId,
        resource: `page:${action.pageId}`,
        action: action.type,
        result: 'failure',
        reason: errorMessage,
        metadata: {
          sessionId: context.sessionId,
          contextId: context.contextId,
        },
      });

      logger.error('Browser action execution failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        error: errorMessage,
        duration,
      });

      const result: ActionResult<T> = {
        success: false,
        actionType: action.type,
        error: errorMessage,
        duration,
        timestamp: new Date(),
      };

      this.addToHistory(context, result);
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
  async executeBatch(
    actions: BrowserAction[],
    context: ActionContext,
    options?: {
      stopOnError?: boolean;
      parallel?: boolean;
      maxConcurrency?: number;
    }
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

    const results: ActionResult[] = [];

    if (options?.parallel) {
      // Execute actions in parallel with concurrency limit
      const maxConcurrency = Math.min(options.maxConcurrency || 5, 10);
      const chunks = this.chunkArray(actions, maxConcurrency);
      
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(action => this.execute(action, context))
        );
        results.push(...chunkResults);
        
        // Stop on error if requested
        if (options?.stopOnError && chunkResults.some(result => !result.success)) {
          break;
        }
      }
    } else {
      // Execute actions sequentially
      for (const action of actions) {
        const result = await this.execute(action, context);
        results.push(result);
        
        // Stop on error if requested
        if (options?.stopOnError && !result.success) {
          break;
        }
      }
    }

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
   * Validate an action before execution
   * @param action - Browser action to validate
   * @param context - Execution context
   * @returns Validation result
   * @nist si-10 "Information input validation"
   */
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
        warningCount: result.warnings?.length || 0,
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
   * Register custom action handler
   * @param actionType - Action type identifier
   * @param handler - Action handler function
   */
  registerHandler<T extends BrowserAction>(
    actionType: string,
    handler: (action: T, context: ActionContext) => Promise<ActionResult>
  ): void {
    logger.info('Registering custom action handler', { actionType });
    // Wrap the handler to include page retrieval
    const wrappedHandler: ActionHandler = async (action, _page, context) => {
      return await handler(action as T, context);
    };
    this.handlers.set(actionType, wrappedHandler);
  }

  /**
   * Unregister action handler
   * @param actionType - Action type identifier
   */
  unregisterHandler(actionType: string): void {
    logger.info('Unregistering action handler', { actionType });
    this.handlers.delete(actionType);
  }

  /**
   * Get supported action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if action type is supported
   * @param actionType - Action type to check
   * @returns True if supported
   */
  isActionSupported(actionType: string): boolean {
    return this.handlers.has(actionType);
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
    }
  ): Promise<ActionResult[]> {
    const contextKey = `${context.sessionId}:${context.contextId}`;
    const history = this.actionHistory.get(contextKey) || [];

    let filteredHistory = [...history];

    // Filter by action types
    if (options?.actionTypes && options.actionTypes.length > 0) {
      filteredHistory = filteredHistory.filter(result => 
        options.actionTypes!.includes(result.actionType)
      );
    }

    // Filter by date range
    if (options?.startDate) {
      filteredHistory = filteredHistory.filter(result => 
        result.timestamp >= options.startDate!
      );
    }
    if (options?.endDate) {
      filteredHistory = filteredHistory.filter(result => 
        result.timestamp <= options.endDate!
      );
    }

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    
    return filteredHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Clear action history
   * @param context - Execution context
   * @param before - Clear history before this date
   * @nist au-4 "Audit storage capacity"
   */
  async clearHistory(context: ActionContext, before?: Date): Promise<void> {
    const contextKey = `${context.sessionId}:${context.contextId}`;
    
    if (before) {
      const history = this.actionHistory.get(contextKey) || [];
      const filteredHistory = history.filter(result => result.timestamp >= before);
      this.actionHistory.set(contextKey, filteredHistory);
    } else {
      this.actionHistory.delete(contextKey);
    }

    logger.info('Action history cleared', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      before: before?.toISOString(),
    });
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
    const contextKey = `${context.sessionId}:${context.contextId}`;
    const history = this.actionHistory.get(contextKey) || [];

    const successfulActions = history.filter(result => result.success).length;
    const failedActions = history.length - successfulActions;
    const averageDuration = history.length > 0 
      ? history.reduce((sum, result) => sum + result.duration, 0) / history.length 
      : 0;

    const actionTypeBreakdown: Record<string, number> = {};
    for (const result of history) {
      actionTypeBreakdown[result.actionType] = (actionTypeBreakdown[result.actionType] || 0) + 1;
    }

    return {
      totalActions: history.length,
      successfulActions,
      failedActions,
      averageDuration,
      actionTypeBreakdown,
    };
  }

  /**
   * Register default action handlers
   */
  private registerDefaultHandlers(): void {
    // Navigation handlers
    this.handlers.set('navigate', async (action, page, context) => 
      handleNavigate(action as NavigateAction, page, context)
    );

    // Interaction handlers
    this.handlers.set('click', async (action, page, context) => 
      handleClick(action as ClickAction, page, context)
    );
    this.handlers.set('type', async (action, page, context) => 
      handleType(action as TypeAction, page, context)
    );
    this.handlers.set('select', async (action, page, context) => 
      handleSelect(action as SelectAction, page, context)
    );

    // Keyboard handlers
    this.handlers.set('keyboard', async (action, page, context) => 
      handleKeyboard(action as KeyboardAction, page, context)
    );

    // Mouse handlers
    this.handlers.set('mouse', async (action, page, context) => 
      handleMouse(action as MouseAction, page, context)
    );

    // Content handlers
    this.handlers.set('screenshot', async (action, page, context) => 
      handleScreenshot(action as ScreenshotAction, page, context)
    );
    this.handlers.set('pdf', async (action, page, context) => 
      handlePDF(action as PDFAction, page, context)
    );

    // Wait handlers
    this.handlers.set('wait', async (action, page, context) => 
      handleWait(action as WaitAction, page, context)
    );

    // Scroll handlers
    this.handlers.set('scroll', async (action, page, context) => 
      handleScroll(action as ScrollAction, page, context)
    );

    // Evaluation handlers
    this.handlers.set('evaluate', async (action, page, context) => 
      handleEvaluate(action as EvaluateAction, page, context)
    );

    // Upload handlers
    this.handlers.set('upload', async (action, page, context) => 
      handleUpload(action as UploadAction, page, context)
    );

    // Cookie handlers
    this.handlers.set('cookie', async (action, page, context) => 
      handleCookie(action as CookieAction, page, context)
    );

    logger.info('Default action handlers registered', {
      handlerCount: this.handlers.size,
      supportedActions: this.getSupportedActions(),
    });
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
    const handler = this.handlers.get(action.type);
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
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retry
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Action execution failed after retries');
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
      return page || null;
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

  /**
   * Add action result to history
   */
  private addToHistory(context: ActionContext, result: ActionResult): void {
    const contextKey = `${context.sessionId}:${context.contextId}`;
    const history = this.actionHistory.get(contextKey) || [];
    
    history.push(result);
    
    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
    
    this.actionHistory.set(contextKey, history);
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