/**
 * Execution orchestration and coordination module
 * @module puppeteer/actions/execution/coordinator/execution-orchestrator
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
} from '../../../interfaces/action-executor.interface.js';
import type { ActionValidator } from '../action-validator.js';
import type { ActionContextManager } from '../context-manager.js';
import type { ActionErrorHandler } from '../error-handler.js';
import type { ActionDispatcher } from '../action-dispatcher.js';
import type { ActionHistoryManager } from '../../history-manager.js';
import type { SecurityEventCoordinator } from './security-event-coordinator.js';
import type { MetricsCollector } from './metrics-collector.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:execution-orchestrator');

/**
 * Orchestrates action execution phases
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class ExecutionOrchestrator {
  constructor(
    private readonly validator: ActionValidator,
    private readonly contextManager: ActionContextManager,
    private readonly errorHandler: ActionErrorHandler,
    private readonly dispatcher: ActionDispatcher,
    private readonly historyManager: ActionHistoryManager,
    private readonly securityCoordinator: SecurityEventCoordinator,
    private readonly metricsCollector: MetricsCollector,
  ) {}

  /**
   * Orchestrate action execution through all phases
   * @param action - Browser action to execute
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async orchestrateExecution<T = unknown>(
    action: BrowserAction,
    context: ActionContext,
  ): Promise<ActionResult<T>> {
    const startTime = Date.now();

    try {
      // Log execution start
      await this.securityCoordinator.logExecutionStart(action, context);

      logger.info('Orchestrating action execution', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        pageId: action.pageId,
      });

      // Phase 1: Validation
      const validationResult = await this.executeValidationPhase(action, context);
      if (!validationResult.valid) {
        return await this.handleValidationFailure<T>(
          action,
          context,
          validationResult,
          startTime,
        );
      }

      // Phase 2: Page acquisition and setup
      const page = await this.executePageSetupPhase(action, context);
      if (!page) {
        return await this.handlePageNotFound<T>(action, context, startTime);
      }

      // Phase 3: Action execution
      const result = await this.executeActionPhase<T>(action, page, context);

      // Phase 4: Cleanup and finalization
      await this.executeCleanupPhase(page, context, result);

      // Log successful completion
      await this.securityCoordinator.logExecutionComplete(action, context, result);

      return result;
    } catch (error) {
      return this.handleExecutionError<T>(
        action,
        context,
        error,
        startTime,
      );
    }
  }

  /**
   * Execute validation phase
   * @param action - Browser action
   * @param context - Execution context
   * @returns Validation result
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async executeValidationPhase(
    action: BrowserAction,
    context: ActionContext,
  ): Promise<ValidationResult> {
    logger.debug('Executing validation phase', {
      sessionId: context.sessionId,
      actionType: action.type,
    });

    // Check if action type is supported
    if (!this.dispatcher.isActionSupported(action.type)) {
      return {
        valid: false,
        errors: [{
          field: 'type',
          message: `Unsupported action type: ${action.type}`,
          code: 'UNSUPPORTED_ACTION',
        }],
      };
    }

    // Validate action for dispatch
    if (!this.dispatcher.validateActionForDispatch(action)) {
      return {
        valid: false,
        errors: [{
          field: 'action',
          message: 'Action is not valid for dispatch',
          code: 'INVALID_ACTION_FOR_DISPATCH',
        }],
      };
    }

    // Perform detailed validation
    return this.validator.validate(action, context);
  }

  /**
   * Execute page setup phase
   * @param action - Browser action
   * @param context - Execution context
   * @returns Page instance or null
   */
  private async executePageSetupPhase(
    action: BrowserAction,
    context: ActionContext,
  ): Promise<Page | null> {
    logger.debug('Executing page setup phase', {
      sessionId: context.sessionId,
      pageId: action.pageId,
    });

    const page = await this.contextManager.getPage(action.pageId, context);
    if (!page) {
      return null;
    }

    // Validate page readiness
    const isPageReady = await this.contextManager.validatePageReady(page, context);
    if (!isPageReady) {
      throw new Error('Page is not ready for action execution');
    }

    // Setup page for action
    await this.contextManager.setupPageForAction(page, context, action.timeout);

    return page;
  }

  /**
   * Execute action phase
   * @param action - Browser action
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  private async executeActionPhase<T>(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult<T>> {
    logger.debug('Executing action phase', {
      sessionId: context.sessionId,
      actionType: action.type,
    });

    // Record execution start metrics
    this.metricsCollector.recordExecutionStart(action, context);

    // Execute with retry handling
    const result = await this.errorHandler.executeWithRetry(
      (_action, _page, _context) => 
        this.dispatcher.dispatch(_action, _page, _context),
      action,
      page,
      context,
    );

    // Record execution end metrics
    this.metricsCollector.recordExecutionEnd(action, context, result);

    return result as ActionResult<T>;
  }

  /**
   * Execute cleanup phase
   * @param page - Page instance
   * @param context - Execution context
   * @param result - Action result
   */
  private async executeCleanupPhase(
    page: Page,
    context: ActionContext,
    result: ActionResult,
  ): Promise<void> {
    logger.debug('Executing cleanup phase', {
      sessionId: context.sessionId,
      success: result.success,
    });

    await this.contextManager.cleanupAfterAction(page, context, result.success);
    this.historyManager.addToHistory(context, result);
  }

  /**
   * Handle validation failure
   * @param action - Browser action
   * @param context - Execution context
   * @param validationResult - Validation result
   * @param startTime - Execution start time
   * @returns Error result
   */
  private async handleValidationFailure<T>(
    action: BrowserAction,
    context: ActionContext,
    validationResult: ValidationResult,
    startTime: number,
  ): Promise<ActionResult<T>> {
    const result = await this.errorHandler.handleValidationFailure<T>(
      action,
      context,
      validationResult,
      Date.now() - startTime,
    );
    
    this.historyManager.addToHistory(context, result);
    await this.securityCoordinator.logValidationFailure(action, context, validationResult);
    
    return result;
  }

  /**
   * Handle page not found error
   * @param action - Browser action
   * @param context - Execution context
   * @param startTime - Execution start time
   * @returns Error result
   */
  private async handlePageNotFound<T>(
    action: BrowserAction,
    context: ActionContext,
    startTime: number,
  ): Promise<ActionResult<T>> {
    const result = this.errorHandler.createPageNotFoundResult<T>(
      action,
      Date.now() - startTime,
    );
    
    this.historyManager.addToHistory(context, result);
    await this.securityCoordinator.logPageNotFound(action, context);
    
    return result;
  }

  /**
   * Handle execution error
   * @param action - Browser action
   * @param context - Execution context
   * @param error - Error instance
   * @param startTime - Execution start time
   * @returns Error result
   */
  private async handleExecutionError<T>(
    action: BrowserAction,
    context: ActionContext,
    error: unknown,
    startTime: number,
  ): Promise<ActionResult<T>> {
    const result = await this.errorHandler.handleExecutionError<T>(
      action,
      context,
      error,
      Date.now() - startTime,
    );

    logger.error('Action execution failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType: action.type,
      error: result.error,
      duration: result.duration,
    });

    this.historyManager.addToHistory(context, result);
    await this.securityCoordinator.logExecutionError(action, context, error);

    return result;
  }
}