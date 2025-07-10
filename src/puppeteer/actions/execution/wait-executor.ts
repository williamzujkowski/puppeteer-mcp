/**
 * Wait operations and condition checking executor
 * @module puppeteer/actions/execution/wait-executor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  WaitAction,
} from '../../interfaces/action-executor.interface.js';
import type { WaitCondition, WaitConditionConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:wait-executor');

/**
 * Wait action executor
 * @nist ac-3 "Access enforcement"
 */
export class WaitExecutor {
  /**
   * Execute wait action
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
    const startTime = Date.now();

    try {
      logger.debug('Executing wait action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        waitType: action.waitType,
        selector: action.selector,
        duration: action.duration,
      });

      const config: WaitConditionConfig = {
        type: action.waitType as WaitCondition,
        selector: action.selector,
        duration: action.duration,
        functionToEvaluate: action.function,
      };

      const result = await this.waitForCondition(page, config, action.timeout);
      const duration = Date.now() - startTime;

      logger.info('Wait action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        waitType: action.waitType,
        selector: action.selector ? sanitizeSelector(action.selector) : undefined,
        success: result.success,
        duration,
      });

      return {
        success: result.success,
        actionType: 'wait',
        data: {
          waitType: action.waitType,
          selector: action.selector ? sanitizeSelector(action.selector) : undefined,
          condition: result.condition,
          actualDuration: result.actualDuration,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalSelector: action.selector,
          requestedDuration: action.duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Wait action failed';

      logger.error('Wait action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        waitType: action.waitType,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'wait',
        error: errorMessage,
        duration,
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
    timeout: number = DEFAULT_CONFIG.TIMEOUT.element,
    visible: boolean = false,
    hidden: boolean = false,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing waitForSelector action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector,
        visible,
        hidden,
        timeout,
      });

      const element = await page.waitForSelector(selector, {
        timeout,
        visible,
        hidden,
      });

      const duration = Date.now() - startTime;
      const found = element !== null;
      const sanitizedSelector = sanitizeSelector(selector);

      logger.info('WaitForSelector action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: sanitizedSelector,
        found,
        visible,
        hidden,
        duration,
      });

      return {
        success: true,
        actionType: 'waitForSelector',
        data: {
          selector: sanitizedSelector,
          found,
          visible,
          hidden,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalSelector: selector,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'WaitForSelector action failed';

      logger.error('WaitForSelector action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'waitForSelector',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          selector,
          visible,
          hidden,
          timeout,
        },
      };
    }
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
    timeout: number = DEFAULT_CONFIG.TIMEOUT.element,
    args: unknown[] = [],
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing waitForFunction action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        functionLength: functionToEvaluate.length,
        argsCount: args.length,
        timeout,
      });

      // Security validation
      this.validateFunction(functionToEvaluate);

      await page.waitForFunction(functionToEvaluate, { timeout }, ...args);

      const duration = Date.now() - startTime;

      logger.info('WaitForFunction action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        functionLength: functionToEvaluate.length,
        duration,
      });

      return {
        success: true,
        actionType: 'waitForFunction',
        data: {
          functionLength: functionToEvaluate.length,
          argsCount: args.length,
          condition: 'function_returned_truthy',
        },
        duration,
        timestamp: new Date(),
        metadata: {
          hasArgs: args.length > 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'WaitForFunction action failed';

      logger.error('WaitForFunction action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'waitForFunction',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          functionLength: functionToEvaluate.length,
          argsCount: args.length,
          timeout,
        },
      };
    }
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
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' = 'load',
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing waitForNavigation action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        waitUntil,
        timeout,
      });

      const response = await page.waitForNavigation({
        timeout,
        waitUntil,
      });

      const duration = Date.now() - startTime;
      const finalUrl = page.url();

      logger.info('WaitForNavigation action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        finalUrl,
        waitUntil,
        statusCode: response?.status(),
        duration,
      });

      return {
        success: true,
        actionType: 'waitForNavigation',
        data: {
          url: finalUrl,
          waitUntil,
          statusCode: response?.status(),
          navigationCompleted: true,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          waitUntil,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'WaitForNavigation action failed';

      logger.error('WaitForNavigation action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration,
      });

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
    const startTime = Date.now();

    try {
      logger.debug('Executing waitForTimeout action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        duration,
      });

      await page.waitForTimeout(duration);

      const actualDuration = Date.now() - startTime;

      logger.info('WaitForTimeout action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        requestedDuration: duration,
        actualDuration,
      });

      return {
        success: true,
        actionType: 'waitForTimeout',
        data: {
          requestedDuration: duration,
          actualDuration,
          condition: 'timeout_elapsed',
        },
        duration: actualDuration,
        timestamp: new Date(),
      };
    } catch (error) {
      const actualDuration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'WaitForTimeout action failed';

      logger.error('WaitForTimeout action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration: actualDuration,
      });

      return {
        success: false,
        actionType: 'waitForTimeout',
        error: errorMessage,
        duration: actualDuration,
        timestamp: new Date(),
        metadata: {
          requestedDuration: duration,
        },
      };
    }
  }

  /**
   * Execute route handler for wait actions
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
      case 'wait':
        return this.executeWait(action as WaitAction, page, context);
      case 'waitForSelector': {
        const waitAction = action as {
          selector: string;
          timeout?: number;
          visible?: boolean;
          hidden?: boolean;
        };
        return this.executeWaitForSelector(
          waitAction.selector,
          page,
          context,
          waitAction.timeout,
          waitAction.visible,
          waitAction.hidden,
        );
      }
      case 'waitForFunction': {
        const waitAction = action as {
          function: string;
          timeout?: number;
          args?: unknown[];
        };
        return this.executeWaitForFunction(
          waitAction.function,
          page,
          context,
          waitAction.timeout,
          waitAction.args,
        );
      }
      case 'waitForNavigation': {
        const waitAction = action as {
          timeout?: number;
          waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
        };
        return this.executeWaitForNavigation(
          page,
          context,
          waitAction.timeout,
          waitAction.waitUntil,
        );
      }
      case 'waitForTimeout': {
        const waitAction = action as { duration: number };
        return this.executeWaitForTimeout(waitAction.duration, page, context);
      }
      default:
        throw new Error(`Unsupported wait action: ${action.type}`);
    }
  }

  /**
   * Wait for condition based on configuration
   * @param page - Page instance
   * @param config - Wait condition configuration
   * @param timeout - Wait timeout
   * @returns Wait result
   */
  private async waitForCondition(
    page: Page,
    config: WaitConditionConfig,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.element,
  ): Promise<{
    success: boolean;
    condition: string;
    actualDuration: number;
  }> {
    const startTime = Date.now();

    try {
      switch (config.type) {
        case 'selector':
          if (!config.selector) {
            throw new Error('Selector is required for selector wait');
          }
          await page.waitForSelector(config.selector, { timeout });
          return {
            success: true,
            condition: 'selector_found',
            actualDuration: Date.now() - startTime,
          };

        case 'navigation':
          await page.waitForNavigation({ timeout });
          return {
            success: true,
            condition: 'navigation_completed',
            actualDuration: Date.now() - startTime,
          };

        case 'timeout':
          if (!config.duration) {
            throw new Error('Duration is required for timeout wait');
          }
          await page.waitForTimeout(config.duration);
          return {
            success: true,
            condition: 'timeout_elapsed',
            actualDuration: Date.now() - startTime,
          };

        case 'function':
          if (!config.functionToEvaluate) {
            throw new Error('Function is required for function wait');
          }
          this.validateFunction(config.functionToEvaluate);
          await page.waitForFunction(config.functionToEvaluate, { timeout });
          return {
            success: true,
            condition: 'function_returned_truthy',
            actualDuration: Date.now() - startTime,
          };

        case 'load':
          await page.waitForFunction('document.readyState === "complete"', { timeout });
          return {
            success: true,
            condition: 'page_loaded',
            actualDuration: Date.now() - startTime,
          };

        case 'networkidle':
          await page.waitForNavigation({ waitUntil: 'networkidle0', timeout });
          return {
            success: true,
            condition: 'network_idle',
            actualDuration: Date.now() - startTime,
          };

        default:
          throw new Error(`Unsupported wait condition: ${config.type}`);
      }
    } catch (error) {
      return {
        success: false,
        condition: 'error',
        actualDuration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate function for security
   * @param functionCode - Function code to validate
   */
  private validateFunction(functionCode: string): void {
    // Basic security check for dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /import\s*\(/gi,
      /require\s*\(/gi,
      /XMLHttpRequest/gi,
      /fetch\s*\(/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(functionCode)) {
        throw new Error(`Function contains potentially dangerous pattern: ${pattern.source}`);
      }
    }

    // Check for excessive length
    if (functionCode.length > 10000) {
      throw new Error('Function code is too long (>10KB)');
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
}

/**
 * Extend Page with waitForLoadState compatibility method
 */
declare module 'puppeteer' {
  interface Page {
    waitForLoadState?(
      state: 'load' | 'domcontentloaded' | 'networkidle',
      options?: { timeout?: number }
    ): Promise<void>;
  }
}

// Note: waitForLoadState implementation is provided as a compatibility shim
// but is not actually implemented here to avoid runtime prototype modification