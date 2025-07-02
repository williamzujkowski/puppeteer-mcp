/**
 * JavaScript evaluation action handlers for browser automation
 * @module puppeteer/actions/handlers/evaluation
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { 
  EvaluateAction,
  ActionResult, 
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { validateJavaScriptCode } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';
export { handleEvaluateHandle, handleInjectScript, handleInjectCSS } from './evaluation-handle.js';

const logger = createLogger('puppeteer:evaluation');

/**
 * Handle evaluate action
 * @param action - Evaluate action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */
export async function handleEvaluate(
  action: EvaluateAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing evaluate action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      functionLength: action.function.length,
      argsCount: action.args?.length ?? 0,
    });

    // Validate JavaScript code for security
    validateJavaScriptCode(action.function);

    // Execute the function with timeout
    const result = await Promise.race([
      page.evaluate(action.function, ...(action.args ?? [])),
      new Promise((_, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        setTimeout(() => reject(new Error('Evaluation timeout')), action.timeout ?? 30000);
      }),
    ]);

    const duration = Date.now() - startTime;

    logger.info('Evaluate action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      resultType: typeof result,
      duration,
    });

    return {
      success: true,
      actionType: 'evaluate',
      data: {
        result,
        resultType: typeof result,
        executionTime: duration,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        functionLength: action.function.length,
        argsCount: action.args?.length ?? 0,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown evaluation error';

    logger.error('Evaluate action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
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
        functionLength: action.function.length,
        argsCount: action.args?.length ?? 0,
      },
    };
  }
}

