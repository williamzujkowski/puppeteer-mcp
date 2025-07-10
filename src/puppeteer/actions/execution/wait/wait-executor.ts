/**
 * Modularized wait executor using strategy pattern
 * @module puppeteer/actions/execution/wait/wait-executor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  WaitAction,
} from '../../../interfaces/action-executor.interface.js';
import type { WaitConditionConfig } from '../types.js';
import type { WaitExecutorConfig } from './types.js';
import { WaitStrategyFactory } from './strategy-factory.js';
import { ExtendedSelectorWaitStrategy } from './selector-strategy.js';
import { NavigationWaitStrategy, NavigationWaitUntil } from './navigation-strategy.js';
import { TimeoutWaitStrategy } from './timeout-strategy.js';
import { FunctionWaitStrategy } from './function-strategy.js';
import { DEFAULT_CONFIG } from '../types.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:wait-executor');

/**
 * Modularized wait action executor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class ModularWaitExecutor {
  private readonly factory: WaitStrategyFactory;
  private readonly config: WaitExecutorConfig;

  // Specialized strategy instances for direct method calls
  private readonly selectorStrategy: ExtendedSelectorWaitStrategy;
  private readonly navigationStrategy: NavigationWaitStrategy;
  private readonly timeoutStrategy: TimeoutWaitStrategy;
  private readonly functionStrategy: FunctionWaitStrategy;

  constructor(config?: Partial<WaitExecutorConfig>) {
    this.config = {
      defaultTimeout: DEFAULT_CONFIG.TIMEOUT.element,
      debug: false,
      securityValidation: true,
      ...config,
    };

    // Initialize factory
    this.factory = new WaitStrategyFactory({
      enableFunctionSecurity: this.config.securityValidation,
    });

    // Initialize specialized strategies
    this.selectorStrategy = new ExtendedSelectorWaitStrategy();
    this.navigationStrategy = new NavigationWaitStrategy();
    this.timeoutStrategy = new TimeoutWaitStrategy();
    this.functionStrategy = new FunctionWaitStrategy(this.config.securityValidation);
  }

  /**
   * Execute wait action using strategy pattern
   * @param action - Wait action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeWait(
    action: WaitAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    try {
      logger.debug('Executing wait action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        waitType: action.waitType,
        selector: action.selector,
        duration: action.duration,
      });

      const config: WaitConditionConfig = {
        type: action.waitType,
        selector: action.selector,
        duration: action.duration ?? action.timeout ?? this.config.defaultTimeout,
        functionToEvaluate: action.function,
      };

      // Get appropriate strategy
      const strategy = this.factory.getStrategy(action.waitType);
      
      // Execute strategy
      return await strategy.execute(page, config, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Wait action failed';
      
      logger.error('Wait action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        waitType: action.waitType,
        error: errorMessage,
      });

      return {
        success: false,
        actionType: 'wait',
        error: errorMessage,
        duration: 0,
        timestamp: new Date(),
        metadata: {
          waitType: action.waitType,
          selector: action.selector,
          requestedDuration: action.duration,
        },
      };
    }
  }

  /**
   * Execute wait for selector
   * @param selector - Element selector to wait for
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Wait timeout
   * @param visible - Whether element should be visible
   * @param hidden - Whether element should be hidden
   * @returns Action result
   */
  async executeWaitForSelector(
    selector: string,
    page: Page,
    context: ActionContext,
    options?: {
      timeout?: number;
      visible?: boolean;
      hidden?: boolean;
    },
  ): Promise<ActionResult> {
    const config: WaitConditionConfig = {
      type: 'selector',
      selector,
      duration: options?.timeout ?? DEFAULT_CONFIG.TIMEOUT.element,
      visible: options?.visible ?? false,
      hidden: options?.hidden ?? false,
    };

    return this.selectorStrategy.execute(page, config, context);
  }

  /**
   * Execute wait for function
   * @param functionToEvaluate - Function to evaluate
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Wait timeout
   * @param args - Function arguments
   * @returns Action result
   */
  async executeWaitForFunction(
    functionToEvaluate: string,
    page: Page,
    context: ActionContext,
    options?: {
      timeout?: number;
      args?: unknown[];
    },
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const timeout = options?.timeout ?? DEFAULT_CONFIG.TIMEOUT.element;
    const args = options?.args ?? [];

    try {
      const result = await this.functionStrategy.executeWaitForFunction(
        functionToEvaluate,
        page,
        timeout,
        args,
      );

      return this.createWaitFunctionResult({
        success: true,
        data: result.details,
        duration: Date.now() - startTime,
        argsCount: args.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'WaitForFunction action failed';
      return this.createWaitFunctionResult({
        success: false,
        duration: Date.now() - startTime,
        argsCount: args.length,
        error: errorMessage,
        functionLength: functionToEvaluate.length,
        timeout,
      });
    }
  }

  /**
   * Create wait function result
   */
  private createWaitFunctionResult(options: {
    success: boolean;
    data?: Record<string, unknown>;
    duration: number;
    argsCount: number;
    error?: string;
    functionLength?: number;
    timeout?: number;
  }): ActionResult {
    const metadata = options.success
      ? { hasArgs: options.argsCount > 0 }
      : { 
          functionLength: options.functionLength, 
          argsCount: options.argsCount, 
          timeout: options.timeout,
        };

    return {
      success: options.success,
      actionType: 'waitForFunction',
      data: options.data,
      error: options.error,
      duration: options.duration,
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Execute wait for navigation
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Wait timeout
   * @param waitUntil - Wait until condition
   * @returns Action result
   */
  async executeWaitForNavigation(
    page: Page,
    context: ActionContext,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.navigation,
    waitUntil: NavigationWaitUntil = 'load',
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      const result = await this.navigationStrategy.executeWaitForNavigation(
        page,
        timeout,
        waitUntil,
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        actionType: 'waitForNavigation',
        data: result.details,
        duration,
        timestamp: new Date(),
        metadata: {
          waitUntil,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'WaitForNavigation action failed';

      return {
        success: false,
        actionType: 'waitForNavigation',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          waitUntil,
          timeout,
          currentUrl: page.url(),
        },
      };
    }
  }

  /**
   * Execute wait for timeout
   * @param duration - Duration to wait in milliseconds
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeWaitForTimeout(
    duration: number,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const config: WaitConditionConfig = {
      type: 'timeout',
      duration,
    };

    return this.timeoutStrategy.execute(page, config, context);
  }

  /**
   * Execute route handler for wait actions
   * @param action - Browser action
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async execute(
    action: BrowserAction, // For extended wait actions
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    // Handle standard wait action
    if (action.type === 'wait') {
      return this.executeWait(action, page, context);
    }

    // Handle extended wait actions that might not be in BrowserAction union
    const actionType = action.type as string;
    
    switch (actionType) {
      case 'waitForSelector': {
        const waitAction = action as {
          type: string;
          selector: string;
          timeout?: number;
          visible?: boolean;
          hidden?: boolean;
        };
        return this.executeWaitForSelector(
          waitAction.selector,
          page,
          context,
          {
            timeout: waitAction.timeout,
            visible: waitAction.visible,
            hidden: waitAction.hidden,
          },
        );
      }
      
      case 'waitForFunction': {
        const waitAction = action as {
          type: string;
          function: string;
          timeout?: number;
          args?: unknown[];
        };
        return this.executeWaitForFunction(
          waitAction.function,
          page,
          context,
          {
            timeout: waitAction.timeout,
            args: waitAction.args,
          },
        );
      }
      
      case 'waitForNavigation': {
        const waitAction = action as {
          type: string;
          timeout?: number;
          waitUntil?: NavigationWaitUntil;
        };
        return this.executeWaitForNavigation(
          page,
          context,
          waitAction.timeout,
          waitAction.waitUntil,
        );
      }
      
      case 'waitForTimeout': {
        const waitAction = action as { type: string; duration: number };
        return this.executeWaitForTimeout(waitAction.duration, page, context);
      }
      
      default:
        throw new Error(`Unsupported wait action: ${actionType}`);
    }
  }

  /**
   * Get supported wait action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return [
      'wait',
      'waitForSelector',
      'waitForFunction',
      'waitForNavigation',
      'waitForTimeout',
    ];
  }

  /**
   * Get registered wait condition types
   * @returns Array of wait condition types
   */
  getRegisteredWaitTypes(): string[] {
    return this.factory.getRegisteredTypes();
  }
}