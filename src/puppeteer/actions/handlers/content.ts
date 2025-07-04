/**
 * Content-related browser action handlers
 * @module puppeteer/actions/handlers/content
 */

import { Page } from 'puppeteer';
import type {
  ScreenshotAction,
  PDFAction,
  ContentAction,
  ActionResult,
  ActionContext,
} from '../../interfaces/action-executor.interface.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';
import {
  buildScreenshotOptions,
  buildPdfOptions,
  captureElementScreenshot,
  capturePageScreenshot,
} from './content-helpers.js';

const logger = createLogger('puppeteer:content');

/**
 * Handle screenshot action
 * @param action - Screenshot action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result with screenshot data
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */
export async function handleScreenshot(
  action: ScreenshotAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult<Buffer | string>> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing screenshot action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      fullPage: action.fullPage,
      selector: action.selector,
      format: action.format,
      quality: action.quality,
    });

    const screenshotOptions = buildScreenshotOptions(action);

    // Delegate to specific screenshot method
    const result = (action.selector !== null && action.selector !== undefined && action.selector !== '')
      ? await captureElementScreenshot(action, page, screenshotOptions, context)
      : await capturePageScreenshot(action, page, screenshotOptions, context);

    const duration = Date.now() - startTime;
    return {
      ...result,
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown screenshot error';

    logger.error('Screenshot action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'screenshot',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        selector: action.selector,
        format: action.format,
        fullPage: action.fullPage,
      },
    };
  }
}

/**
 * Handle PDF generation action
 * @param action - PDF action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result with PDF data
 * @nist au-3 "Content of audit records"
 */
export async function handlePdf(
  action: PDFAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult<Buffer>> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing PDF action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      format: action.format,
      landscape: action.landscape,
    });

    // Build PDF options
    const pdfOptions = buildPdfOptions(action);

    // Generate PDF
    const pdf = Buffer.from(await page.pdf(pdfOptions));
    
    const duration = Date.now() - startTime;

    logger.info('PDF action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      size: pdf.length,
      duration,
    });

    return {
      success: true,
      actionType: 'pdf',
      data: pdf,
      duration,
      timestamp: new Date(),
      metadata: {
        format: action.format ?? 'letter',
        landscape: action.landscape ?? false,
        size: pdf.length,
        pageCount: action.pageRanges ? 'custom' : 'all',
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown PDF error';

    logger.error('PDF action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'pdf',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        format: action.format,
        landscape: action.landscape,
      },
    };
  }
}

/**
 * Handle content retrieval action
 * @param action - Content action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result with page content
 * @nist au-3 "Content of audit records"
 */
export async function handleContent(
  action: ContentAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult<string>> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing content action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: action.selector,
    });

    let content: string;
    let contentType: string;

    if (action.selector) {
      // Get content of specific element
      const sanitizedSelector = sanitizeSelector(action.selector);
      
      await page.waitForSelector(sanitizedSelector, {
        timeout: action.timeout ?? 30000,
      });

      content = await page.$eval(sanitizedSelector, (el) => {
        // Check if element has a value property (input/textarea)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ('value' in el && typeof (el as any).value === 'string') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
          return (el as any).value;
        }
        // Otherwise get text content
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return el.textContent ?? '';
      });
      
      contentType = 'element';
    } else {
      // Get full page content
      content = await page.content();
      contentType = 'page';
    }
    
    const duration = Date.now() - startTime;

    logger.info('Content action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      contentType,
      contentLength: content.length,
      duration,
    });

    return {
      success: true,
      actionType: 'content',
      data: content,
      duration,
      timestamp: new Date(),
      metadata: {
        type: contentType,
        selector: action.selector,
        length: content.length,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown content error';

    logger.error('Content action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'content',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        selector: action.selector,
      },
    };
  }
}