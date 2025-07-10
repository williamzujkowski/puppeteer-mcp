/**
 * JavaScript evaluation and injection actions executor
 * @module puppeteer/actions/execution/evaluation-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-11 "Error handling"
 */

import type { Page, JSHandle } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  EvaluateAction,
} from '../../interfaces/action-executor.interface.js';
import type { EvaluationConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { createLogger } from '../../../utils/logger.js';

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
    const startTime = Date.now();

    try {
      logger.debug('Executing evaluate action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        functionLength: action.function.length,
        argsCount: action.args?.length || 0,
      });

      // Security check for dangerous patterns
      this.validateFunction(action.function);

      // Prepare evaluation configuration
      const config: EvaluationConfig = {
        functionToEvaluate: action.function,
        args: action.args || [],
        returnByValue: true,
      };

      // Execute the function
      const result = await page.evaluate(
        config.functionToEvaluate,
        ...config.args,
      );

      const duration = Date.now() - startTime;

      logger.info('Evaluate action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        functionLength: action.function.length,
        resultType: typeof result,
        duration,
      });

      return {
        success: true,
        actionType: 'evaluate',
        data: {
          result,
          resultType: typeof result,
          argsCount: config.args.length,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          functionLength: action.function.length,
          hasArgs: config.args.length > 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Evaluate action failed';

      logger.error('Evaluate action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'evaluate',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          functionLength: action.function?.length || 0,
          argsCount: action.args?.length || 0,
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
    const startTime = Date.now();

    try {
      logger.debug('Executing evaluateHandle action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        functionLength: functionToEvaluate.length,
        argsCount: args.length,
      });

      // Security check
      this.validateFunction(functionToEvaluate);

      // Set timeout for evaluation
      const originalTimeout = page.getDefaultTimeout();
      page.setDefaultTimeout(timeout);

      let handle: JSHandle;
      try {
        handle = await page.evaluateHandle(functionToEvaluate, ...args);
      } finally {
        // Restore original timeout
        page.setDefaultTimeout(originalTimeout);
      }

      const duration = Date.now() - startTime;

      // Get handle properties for result data
      const handleType = await handle.evaluate((obj) => typeof obj);
      const isElement = await handle.evaluate((obj) => obj instanceof Element);

      logger.info('EvaluateHandle action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        handleType,
        isElement,
        duration,
      });

      return {
        success: true,
        actionType: 'evaluateHandle',
        data: {
          handleType,
          isElement,
          argsCount: args.length,
          // Note: We don't return the actual handle as it can't be serialized
          handleId: `handle_${Date.now()}`,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          functionLength: functionToEvaluate.length,
          hasArgs: args.length > 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'EvaluateHandle action failed';

      logger.error('EvaluateHandle action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'evaluateHandle',
        error: errorMessage,
        duration,
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
    const startTime = Date.now();

    try {
      logger.debug('Executing injectScript action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        scriptLength: script.length,
      });

      // Security check
      this.validateFunction(script);

      // Set timeout
      const originalTimeout = page.getDefaultTimeout();
      page.setDefaultTimeout(timeout);

      try {
        // Add script tag to page
        await page.addScriptTag({ content: script });
      } finally {
        // Restore original timeout
        page.setDefaultTimeout(originalTimeout);
      }

      const duration = Date.now() - startTime;

      logger.info('InjectScript action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        scriptLength: script.length,
        duration,
      });

      return {
        success: true,
        actionType: 'injectScript',
        data: {
          scriptLength: script.length,
          injected: true,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          scriptLength: script.length,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'InjectScript action failed';

      logger.error('InjectScript action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'injectScript',
        error: errorMessage,
        duration,
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
    const startTime = Date.now();

    try {
      logger.debug('Executing injectCSS action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        cssLength: css.length,
      });

      // Basic CSS validation (no JavaScript injection)
      this.validateCSS(css);

      // Set timeout
      const originalTimeout = page.getDefaultTimeout();
      page.setDefaultTimeout(timeout);

      try {
        // Add style tag to page
        await page.addStyleTag({ content: css });
      } finally {
        // Restore original timeout
        page.setDefaultTimeout(originalTimeout);
      }

      const duration = Date.now() - startTime;

      logger.info('InjectCSS action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        cssLength: css.length,
        duration,
      });

      return {
        success: true,
        actionType: 'injectCSS',
        data: {
          cssLength: css.length,
          injected: true,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          cssLength: css.length,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'InjectCSS action failed';

      logger.error('InjectCSS action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'injectCSS',
        error: errorMessage,
        duration,
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
      case 'evaluateHandle': {
        const evalHandleAction = action as {
          function: string;
          args?: unknown[];
          timeout?: number;
        };
        return this.executeEvaluateHandle(
          evalHandleAction.function,
          page,
          context,
          evalHandleAction.args,
          evalHandleAction.timeout,
        );
      }
      case 'injectScript': {
        const injectAction = action as { script: string; timeout?: number };
        return this.executeInjectScript(
          injectAction.script,
          page,
          context,
          injectAction.timeout,
        );
      }
      case 'injectCSS': {
        const cssAction = action as { css: string; timeout?: number };
        return this.executeInjectCSS(
          cssAction.css,
          page,
          context,
          cssAction.timeout,
        );
      }
      default:
        throw new Error(`Unsupported evaluation action: ${action.type}`);
    }
  }

  /**
   * Validate JavaScript function for security
   * @param functionCode - Function code to validate
   */
  private validateFunction(functionCode: string): void {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /import\s*\(/gi,
      /require\s*\(/gi,
      /process\./gi,
      /global\./gi,
      /window\.location\s*=/gi,
      /document\.location\s*=/gi,
      /location\.href\s*=/gi,
      /location\.replace/gi,
      /location\.assign/gi,
      /XMLHttpRequest/gi,
      /fetch\s*\(/gi,
      /__proto__/gi,
      /constructor/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(functionCode)) {
        throw new Error(`Function contains potentially dangerous pattern: ${pattern.source}`);
      }
    }

    // Check for excessive length
    if (functionCode.length > 50000) {
      throw new Error('Function code is too long (>50KB)');
    }

    // Check for balanced brackets
    const openBrackets = (functionCode.match(/\{/g) || []).length;
    const closeBrackets = (functionCode.match(/\}/g) || []).length;
    
    if (openBrackets !== closeBrackets) {
      throw new Error('Function code has unbalanced brackets');
    }
  }

  /**
   * Validate CSS for security
   * @param css - CSS code to validate
   */
  private validateCSS(css: string): void {
    // Check for JavaScript injection in CSS
    const dangerousPatterns = [
      /javascript:/gi,
      /expression\s*\(/gi,
      /behavior\s*:/gi,
      /binding\s*:/gi,
      /-moz-binding/gi,
      /eval\s*\(/gi,
      /data:.*script/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(css)) {
        throw new Error(`CSS contains potentially dangerous pattern: ${pattern.source}`);
      }
    }

    // Check for excessive length
    if (css.length > 100000) {
      throw new Error('CSS code is too long (>100KB)');
    }
  }

  /**
   * Get supported evaluation action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return ['evaluate', 'evaluateHandle', 'injectScript', 'injectCSS'];
  }
}