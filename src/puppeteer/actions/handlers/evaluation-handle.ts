/**
 * JavaScript evaluation handle handlers
 * @module puppeteer/actions/handlers/evaluation-handle
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page, JSHandle } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../interfaces/action-executor.interface.js';
import { validateJavaScriptCode } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:evaluation-handle');

/**
 * Parameters for evaluate handle action
 */
interface EvaluateHandleParams {
  functionString: string;
  page: Page;
  context: ActionContext;
  args?: unknown[];
  timeout?: number;
}

/**
 * Handle evaluate handle action
 * @param params - Evaluate handle parameters
 * @returns Action result with JSHandle
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 */
export async function handleEvaluateHandle(
  params: EvaluateHandleParams,
): Promise<ActionResult<JSHandle>> {
  const { functionString, page, context, args, timeout } = params;
  const startTime = Date.now();

  try {
    logger.info('Executing evaluate handle action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      functionLength: functionString.length,
      argsCount: args?.length ?? 0,
    });

    // Validate JavaScript code for security
    validateJavaScriptCode(functionString);

    // Execute the function with timeout and return JSHandle
    const handle = await Promise.race([
      page.evaluateHandle(functionString, ...(args ?? [])),
      new Promise<JSHandle>((_, reject) => {
        setTimeout(() => reject(new Error('Evaluation handle timeout')), timeout ?? 30000);
      }),
    ]);

    const duration = Date.now() - startTime;

    logger.info('Evaluate handle action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      duration,
    });

    return {
      success: true,
      actionType: 'evaluateHandle',
      data: handle,
      duration,
      timestamp: new Date(),
      metadata: {
        functionLength: functionString.length,
        argsCount: args?.length ?? 0,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown evaluation handle error';

    logger.error('Evaluate handle action failed', {
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
        functionLength: functionString.length,
        argsCount: args?.length ?? 0,
      },
    };
  }
}

/**
 * Handle script injection action
 * @param scriptContent - Script content to inject
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param type - Script type (url or content)
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 */
export async function handleInjectScript(
  scriptContent: string,
  page: Page,
  context: ActionContext,
  type: 'url' | 'content' = 'content',
): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    logger.info('Executing inject script action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      type,
      contentLength: scriptContent.length,
    });

    if (type === 'content') {
      // Validate script content for security
      validateJavaScriptCode(scriptContent);

      // Inject script content
      await page.addScriptTag({ content: scriptContent });
    } else {
      // Validate URL and inject script from URL
      if (!isValidScriptUrl(scriptContent)) {
        throw new Error('Invalid script URL');
      }

      await page.addScriptTag({ url: scriptContent });
    }

    const duration = Date.now() - startTime;

    logger.info('Inject script action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      type,
      duration,
    });

    return {
      success: true,
      actionType: 'injectScript',
      data: {
        type,
        contentLength: scriptContent.length,
      },
      duration,
      timestamp: new Date(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown script injection error';

    logger.error('Inject script action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      type,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'injectScript',
      error: errorMessage,
      duration,
      timestamp: new Date(),
    };
  }
}

/**
 * Handle CSS injection action
 * @param cssContent - CSS content to inject
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param type - CSS type (url or content)
 * @returns Action result
 */
export async function handleInjectCSS(
  cssContent: string,
  page: Page,
  context: ActionContext,
  type: 'url' | 'content' = 'content',
): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    logger.info('Executing inject CSS action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      type,
      contentLength: cssContent.length,
    });

    if (type === 'content') {
      // Inject CSS content
      await page.addStyleTag({ content: cssContent });
    } else {
      // Validate URL and inject CSS from URL
      if (!isValidCssUrl(cssContent)) {
        throw new Error('Invalid CSS URL');
      }

      await page.addStyleTag({ url: cssContent });
    }

    const duration = Date.now() - startTime;

    logger.info('Inject CSS action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      type,
      duration,
    });

    return {
      success: true,
      actionType: 'injectCSS',
      data: {
        type,
        contentLength: cssContent.length,
      },
      duration,
      timestamp: new Date(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown CSS injection error';

    logger.error('Inject CSS action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      type,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'injectCSS',
      error: errorMessage,
      duration,
      timestamp: new Date(),
    };
  }
}

/**
 * Validate script URL for safety
 * @param url - URL to validate
 * @returns True if valid
 */
function isValidScriptUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate CSS URL for safety
 * @param url - URL to validate
 * @returns True if valid
 */
function isValidCssUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
