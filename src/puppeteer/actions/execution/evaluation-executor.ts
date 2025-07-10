/**
 * JavaScript evaluation and injection actions executor
 * @module puppeteer/actions/execution/evaluation-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-11 "Error handling"
 * 
 * This module serves as the main entry point for evaluation operations,
 * providing backward compatibility while delegating to specialized modules.
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  EvaluateAction,
} from '../../interfaces/action-executor.interface.js';
// import type { EvaluationConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { createLogger } from '../../../utils/logger.js';
import {
  createStrategyForAction,
  type CodeEvaluationConfig,
  type InjectionConfig,
} from './evaluation/index.js';

const logger = createLogger('puppeteer:evaluation-executor');

/**
 * Evaluation action executor
 * @nist ac-3 "Access enforcement"
 */
export class EvaluationExecutor {
  /**
   * Execute JavaScript evaluation action
   * @param action - Evaluate action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeEvaluate(
    action: EvaluateAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    logger.debug('Delegating evaluate action to code execution strategy', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      functionLength: action.function.length,
      argsCount: action.args?.length ?? 0,
    });

    try {
      // Create strategy and delegate execution
      const strategy = createStrategyForAction('evaluate');
      const config: CodeEvaluationConfig = {
        functionToEvaluate: action.function,
        args: action.args ?? [],
        returnByValue: true,
      };

      return await strategy.execute(config, page, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Evaluate action failed';
      
      logger.error('Evaluate action delegation failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
      });

      return {
        success: false,
        actionType: 'evaluate',
        error: errorMessage,
        duration: 0,
        timestamp: new Date(),
        metadata: {
          functionLength: action.function?.length ?? 0,
          argsCount: action.args?.length ?? 0,
        },
      };
    }
  }

  /**
   * Execute JavaScript evaluation with handle
   * @param functionToEvaluate - Function to evaluate
   * @param page - Page instance
   * @param context - Execution context
   * @param args - Function arguments
   * @param timeout - Evaluation timeout
   * @returns Action result with handle
   */
  async executeEvaluateHandle(
    functionToEvaluate: string,
    page: Page,
    context: ActionContext,
    args: unknown[] = [],
    timeout: number = DEFAULT_CONFIG.TIMEOUT.evaluation,
  ): Promise<ActionResult> {
    logger.debug('Delegating evaluateHandle action to handle execution strategy', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      functionLength: functionToEvaluate.length,
      argsCount: args.length,
    });

    try {
      // Create strategy and delegate execution
      const strategy = createStrategyForAction('evaluateHandle');
      const config: CodeEvaluationConfig = {
        functionToEvaluate,
        args,
        timeout,
        returnByValue: false,
      };

      return await strategy.execute(config, page, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'EvaluateHandle action failed';
      
      logger.error('EvaluateHandle action delegation failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
      });

      return {
        success: false,
        actionType: 'evaluateHandle',
        error: errorMessage,
        duration: 0,
        timestamp: new Date(),
        metadata: {
          functionLength: functionToEvaluate.length,
          argsCount: args.length,
        },
      };
    }
  }

  /**
   * Execute script injection action
   * @param script - Script content to inject
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Injection timeout
   * @returns Action result
   */
  async executeInjectScript(
    script: string,
    page: Page,
    context: ActionContext,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.evaluation,
  ): Promise<ActionResult> {
    logger.debug('Delegating injectScript action to injection execution strategy', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      scriptLength: script.length,
    });

    try {
      // Create strategy and delegate execution
      const strategy = createStrategyForAction('injectScript');
      const config: InjectionConfig = {
        content: script,
        type: 'script',
        timeout,
      };

      return await strategy.execute(config, page, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'InjectScript action failed';
      
      logger.error('InjectScript action delegation failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
      });

      return {
        success: false,
        actionType: 'injectScript',
        error: errorMessage,
        duration: 0,
        timestamp: new Date(),
        metadata: {
          scriptLength: script.length,
        },
      };
    }
  }

  /**
   * Execute CSS injection action
   * @param css - CSS content to inject
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Injection timeout
   * @returns Action result
   */
  async executeInjectCSS(
    css: string,
    page: Page,
    context: ActionContext,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.evaluation,
  ): Promise<ActionResult> {
    logger.debug('Delegating injectCSS action to injection execution strategy', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      cssLength: css.length,
    });

    try {
      // Create strategy and delegate execution
      const strategy = createStrategyForAction('injectCSS');
      const config: InjectionConfig = {
        content: css,
        type: 'css',
        timeout,
      };

      return await strategy.execute(config, page, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'InjectCSS action failed';
      
      logger.error('InjectCSS action delegation failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
      });

      return {
        success: false,
        actionType: 'injectCSS',
        error: errorMessage,
        duration: 0,
        timestamp: new Date(),
        metadata: {
          cssLength: css.length,
        },
      };
    }
  }

  /**
   * Execute route handler for evaluation actions
   * @param action - Browser action
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    switch (action.type) {
      case 'evaluate':
        return this.executeEvaluate(action as EvaluateAction, page, context);
      default:
        throw new Error(`Unsupported evaluation action: ${action.type}`);
    }
  }

  /**
   * Legacy validation methods - now handled by specialized security validators
   * These methods are kept for backward compatibility but delegate to the new modules
   * @deprecated Use security validators from evaluation module instead
   */

  /**
   * Get supported evaluation action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return ['evaluate', 'evaluateHandle', 'injectScript', 'injectCSS'];
  }
}