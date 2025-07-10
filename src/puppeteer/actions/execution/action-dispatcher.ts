/**
 * Action dispatching and routing to appropriate handlers
 * @module puppeteer/actions/execution/action-dispatcher
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
} from '../../interfaces/action-executor.interface.js';
import type { ActionHandler, HandlerRegistry } from './types.js';
import { NavigationExecutor } from './navigation-executor.js';
import { InteractionExecutor } from './interaction-executor.js';
import { ExtractionExecutor } from './extraction-executor.js';
import { EvaluationExecutor } from './evaluation-executor.js';
import { WaitExecutor } from './wait-executor.js';
import { FileExecutor } from './file-executor.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:action-dispatcher');

/**
 * Action dispatcher for routing actions to appropriate executors
 * @nist ac-3 "Access enforcement"
 */
export class ActionDispatcher {
  private readonly navigationExecutor: NavigationExecutor;
  private readonly interactionExecutor: InteractionExecutor;
  private readonly extractionExecutor: ExtractionExecutor;
  private readonly evaluationExecutor: EvaluationExecutor;
  private readonly waitExecutor: WaitExecutor;
  private readonly fileExecutor: FileExecutor;
  private readonly customHandlers: HandlerRegistry = {};

  constructor() {
    this.navigationExecutor = new NavigationExecutor();
    this.interactionExecutor = new InteractionExecutor();
    this.extractionExecutor = new ExtractionExecutor();
    this.evaluationExecutor = new EvaluationExecutor();
    this.waitExecutor = new WaitExecutor();
    this.fileExecutor = new FileExecutor();
  }

  /**
   * Dispatch action to appropriate executor
   * @param action - Browser action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async dispatch(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    try {
      logger.debug('Dispatching action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
      });

      // Check for custom handler first
      // eslint-disable-next-line security/detect-object-injection
      const customHandler = this.customHandlers[action.type];
      if (customHandler) {
        logger.debug('Using custom handler', {
          sessionId: context.sessionId,
          actionType: action.type,
        });
        return await customHandler(action, page, context);
      }

      // Route to built-in executors
      const executor = this.getExecutorForAction(action.type);
      if (executor) {
        logger.debug('Using built-in executor', {
          sessionId: context.sessionId,
          actionType: action.type,
          executor: executor.constructor.name,
        });
        return await executor.execute(action, page, context);
      }

      // Action type not supported
      throw new Error(`Unsupported action type: ${action.type}`);
    } catch (error) {
      logger.error('Action dispatch failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Register custom action handler
   * @param actionType - Action type identifier
   * @param handler - Action handler function
   */
  registerHandler(actionType: string, handler: ActionHandler): void {
    logger.debug('Registering custom handler', { actionType });
    // eslint-disable-next-line security/detect-object-injection
    this.customHandlers[actionType] = handler;
  }

  /**
   * Unregister custom action handler
   * @param actionType - Action type identifier
   */
  unregisterHandler(actionType: string): void {
    logger.debug('Unregistering custom handler', { actionType });
    // eslint-disable-next-line security/detect-object-injection
    delete this.customHandlers[actionType];
  }

  /**
   * Check if action type is supported
   * @param actionType - Action type to check
   * @returns True if supported
   */
  isActionSupported(actionType: string): boolean {
    // Check custom handlers
    // eslint-disable-next-line security/detect-object-injection
    if (this.customHandlers[actionType]) {
      return true;
    }

    // Check built-in executors
    const executor = this.getExecutorForAction(actionType);
    return executor !== null;
  }

  /**
   * Get all supported action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    const builtInActions = [
      ...this.navigationExecutor.getSupportedActions(),
      ...this.interactionExecutor.getSupportedActions(),
      ...this.extractionExecutor.getSupportedActions(),
      ...this.evaluationExecutor.getSupportedActions(),
      ...this.waitExecutor.getSupportedActions(),
      ...this.fileExecutor.getSupportedActions(),
    ];

    const customActions = Object.keys(this.customHandlers);

    // Create unique array without duplicates
    const allActions = builtInActions.concat(customActions);
    const uniqueActions: string[] = [];
    for (const action of allActions) {
      if (uniqueActions.indexOf(action) === -1) {
        uniqueActions.push(action);
      }
    }
    return uniqueActions;
  }

  /**
   * Get action categories and their supported types
   * @returns Map of categories to action types
   */
  getActionCategories(): Map<string, string[]> {
    const categories = new Map<string, string[]>();

    categories.set('navigation', this.navigationExecutor.getSupportedActions());
    categories.set('interaction', this.interactionExecutor.getSupportedActions());
    categories.set('extraction', this.extractionExecutor.getSupportedActions());
    categories.set('evaluation', this.evaluationExecutor.getSupportedActions());
    categories.set('wait', this.waitExecutor.getSupportedActions());
    categories.set('file', this.fileExecutor.getSupportedActions());

    if (Object.keys(this.customHandlers).length > 0) {
      categories.set('custom', Object.keys(this.customHandlers));
    }

    return categories;
  }

  /**
   * Get executor statistics
   * @returns Executor usage statistics
   */
  getDispatcherStats(): {
    builtInExecutors: number;
    customHandlers: number;
    totalActions: number;
    actionsByCategory: Record<string, number>;
  } {
    const categories = this.getActionCategories();
    const actionsByCategory: Record<string, number> = {};

    categories.forEach((actions, category) => {
      // eslint-disable-next-line security/detect-object-injection
      actionsByCategory[category] = actions.length;
    });

    return {
      builtInExecutors: 6, // Number of built-in executors
      customHandlers: Object.keys(this.customHandlers).length,
      totalActions: this.getSupportedActions().length,
      actionsByCategory,
    };
  }

  /**
   * Validate action before dispatch
   * @param action - Action to validate
   * @returns True if action is valid for dispatch
   */
  validateActionForDispatch(action: BrowserAction): boolean {
    // Basic validation
    if (!action?.type || !action.pageId) {
      return false;
    }

    // Check if action type is supported
    if (!this.isActionSupported(action.type)) {
      return false;
    }

    return true;
  }

  /**
   * Get recommended executor for performance optimization
   * @param actionType - Action type
   * @returns Executor recommendation
   */
  getExecutorRecommendation(actionType: string): {
    executor: string;
    category: string;
    complexity: 'low' | 'medium' | 'high';
    estimatedDuration: number;
  } | null {
    const executor = this.getExecutorForAction(actionType);
    if (!executor) {
      return null;
    }

    const recommendations: Record<string, {
      category: string;
      complexity: 'low' | 'medium' | 'high';
      estimatedDuration: number;
    }> = {
      // Navigation actions
      navigate: { category: 'navigation', complexity: 'medium', estimatedDuration: 3000 },
      goBack: { category: 'navigation', complexity: 'low', estimatedDuration: 1000 },
      goForward: { category: 'navigation', complexity: 'low', estimatedDuration: 1000 },
      refresh: { category: 'navigation', complexity: 'low', estimatedDuration: 2000 },

      // Interaction actions
      click: { category: 'interaction', complexity: 'low', estimatedDuration: 500 },
      type: { category: 'interaction', complexity: 'low', estimatedDuration: 1000 },
      select: { category: 'interaction', complexity: 'low', estimatedDuration: 500 },
      keyboard: { category: 'interaction', complexity: 'low', estimatedDuration: 100 },
      mouse: { category: 'interaction', complexity: 'low', estimatedDuration: 100 },
      hover: { category: 'interaction', complexity: 'low', estimatedDuration: 200 },

      // Extraction actions
      screenshot: { category: 'extraction', complexity: 'medium', estimatedDuration: 2000 },
      pdf: { category: 'extraction', complexity: 'high', estimatedDuration: 5000 },
      content: { category: 'extraction', complexity: 'low', estimatedDuration: 500 },
      getText: { category: 'extraction', complexity: 'low', estimatedDuration: 300 },
      getAttribute: { category: 'extraction', complexity: 'low', estimatedDuration: 300 },

      // Evaluation actions
      evaluate: { category: 'evaluation', complexity: 'medium', estimatedDuration: 1000 },
      evaluateHandle: { category: 'evaluation', complexity: 'medium', estimatedDuration: 1000 },
      injectScript: { category: 'evaluation', complexity: 'high', estimatedDuration: 2000 },
      injectCSS: { category: 'evaluation', complexity: 'medium', estimatedDuration: 1000 },

      // Wait actions
      wait: { category: 'wait', complexity: 'low', estimatedDuration: 1000 },
      waitForSelector: { category: 'wait', complexity: 'low', estimatedDuration: 1000 },
      waitForFunction: { category: 'wait', complexity: 'medium', estimatedDuration: 2000 },
      waitForNavigation: { category: 'wait', complexity: 'medium', estimatedDuration: 3000 },
      waitForTimeout: { category: 'wait', complexity: 'low', estimatedDuration: 1000 },

      // File actions
      upload: { category: 'file', complexity: 'medium', estimatedDuration: 2000 },
      download: { category: 'file', complexity: 'high', estimatedDuration: 10000 },
      cookie: { category: 'file', complexity: 'low', estimatedDuration: 500 },
    };

    // eslint-disable-next-line security/detect-object-injection
    const recommendation = recommendations[actionType];
    if (!recommendation) {
      return {
        executor: executor.constructor.name,
        category: 'unknown',
        complexity: 'medium',
        estimatedDuration: 2000,
      };
    }

    return {
      executor: executor.constructor.name,
      ...recommendation,
    };
  }

  /**
   * Get executor for action type
   * @param actionType - Action type
   * @returns Executor instance or null
   */
  private getExecutorForAction(actionType: string): {
    execute: (action: BrowserAction, page: Page, context: ActionContext) => Promise<ActionResult>;
    getSupportedActions: () => string[];
  } | null {
    // Navigation actions
    if (this.navigationExecutor.getSupportedActions().includes(actionType)) {
      return this.navigationExecutor;
    }

    // Interaction actions
    if (this.interactionExecutor.getSupportedActions().includes(actionType)) {
      return this.interactionExecutor;
    }

    // Extraction actions
    if (this.extractionExecutor.getSupportedActions().includes(actionType)) {
      return this.extractionExecutor;
    }

    // Evaluation actions
    if (this.evaluationExecutor.getSupportedActions().includes(actionType)) {
      return this.evaluationExecutor;
    }

    // Wait actions
    if (this.waitExecutor.getSupportedActions().includes(actionType)) {
      return this.waitExecutor;
    }

    // File actions
    if (this.fileExecutor.getSupportedActions().includes(actionType)) {
      return this.fileExecutor;
    }

    return null;
  }

  /**
   * Get handler registry for testing purposes
   * @internal
   */
  getHandlerRegistry(): HandlerRegistry {
    return { ...this.customHandlers };
  }

  /**
   * Clear all custom handlers
   * @internal
   */
  clearCustomHandlers(): void {
    Object.keys(this.customHandlers).forEach(key => {
      // eslint-disable-next-line security/detect-object-injection
      delete this.customHandlers[key];
    });
  }
}