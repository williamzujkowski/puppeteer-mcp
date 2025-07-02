/**
 * Content action handlers for browser automation
 * @module puppeteer/actions/handlers/content
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { 
  ScreenshotAction,
  PDFAction,
  ActionResult, 
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

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

    let screenshotOptions: Parameters<Page['screenshot']>[0] = {
      type: action.format || 'png',
      fullPage: action.fullPage || false,
      encoding: 'binary',
    };

    // Add quality for JPEG/WebP
    if ((action.format === 'jpeg' || action.format === 'webp') && action.quality) {
      (screenshotOptions as any).quality = Math.max(1, Math.min(100, action.quality));
    }

    // Handle element screenshot
    if (action.selector) {
      const sanitizedSelector = sanitizeSelector(action.selector);
      
      // Wait for element to be visible
      await page.waitForSelector(sanitizedSelector, {
        timeout: action.timeout || 30000,
        visible: true,
      });

      const element = await page.$(sanitizedSelector);
      if (!element) {
        throw new Error(`Element not found: ${sanitizedSelector}`);
      }

      // Take element screenshot
      const screenshot = await element.screenshot(screenshotOptions) as Buffer;
      
      const duration = Date.now() - startTime;

      logger.info('Element screenshot action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        pageId: action.pageId,
        selector: sanitizedSelector,
        size: screenshot.length,
        duration,
      });

      return {
        success: true,
        actionType: 'screenshot',
        data: screenshot,
        duration,
        timestamp: new Date(),
        metadata: {
          type: 'element',
          selector: sanitizedSelector,
          originalSelector: action.selector,
          format: action.format || 'png',
          size: screenshot.length,
        },
      };
    } else {
      // Take full page or viewport screenshot
      const screenshot = await page.screenshot(screenshotOptions) as Buffer;
      
      const duration = Date.now() - startTime;

      logger.info('Page screenshot action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        pageId: action.pageId,
        fullPage: action.fullPage,
        size: screenshot.length,
        duration,
      });

      return {
        success: true,
        actionType: 'screenshot',
        data: screenshot,
        duration,
        timestamp: new Date(),
        metadata: {
          type: action.fullPage ? 'fullPage' : 'viewport',
          format: action.format || 'png',
          size: screenshot.length,
          viewport: await page.viewport(),
        },
      };
    }

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
export async function handlePDF(
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
      scale: action.scale,
    });

    // Configure PDF options
    const pdfOptions: Parameters<Page['pdf']>[0] = {
      format: action.format || 'a4',
      landscape: action.landscape || false,
      scale: action.scale || 1,
      displayHeaderFooter: action.displayHeaderFooter || false,
      printBackground: true,
    };

    // Add margins if specified
    if (action.margin) {
      pdfOptions.margin = {
        top: action.margin.top || '0.5in',
        bottom: action.margin.bottom || '0.5in',
        left: action.margin.left || '0.5in',
        right: action.margin.right || '0.5in',
      };
    }

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
        format: action.format || 'a4',
        landscape: action.landscape || false,
        scale: action.scale || 1,
        size: pdf.length,
        url: page.url(),
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
        scale: action.scale,
      },
    };
  }
}

/**
 * Handle get page content action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result with page content
 * @nist au-3 "Content of audit records"
 */
export async function handleGetContent(
  page: Page,
  context: ActionContext
): Promise<ActionResult<string>> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing get content action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });

    const content = await page.content();
    
    const duration = Date.now() - startTime;

    logger.info('Get content action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      contentLength: content.length,
      duration,
    });

    return {
      success: true,
      actionType: 'getContent',
      data: content,
      duration,
      timestamp: new Date(),
      metadata: {
        contentLength: content.length,
        url: page.url(),
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown get content error';

    logger.error('Get content action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'getContent',
      error: errorMessage,
      duration,
      timestamp: new Date(),
    };
  }
}

/**
 * Handle get page title action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result with page title
 * @nist au-3 "Content of audit records"
 */
export async function handleGetTitle(
  page: Page,
  context: ActionContext
): Promise<ActionResult<string>> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing get title action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });

    const title = await page.title();
    
    const duration = Date.now() - startTime;

    logger.info('Get title action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      title,
      duration,
    });

    return {
      success: true,
      actionType: 'getTitle',
      data: title,
      duration,
      timestamp: new Date(),
      metadata: {
        url: page.url(),
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown get title error';

    logger.error('Get title action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'getTitle',
      error: errorMessage,
      duration,
      timestamp: new Date(),
    };
  }
}

/**
 * Handle get page URL action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result with page URL
 * @nist au-3 "Content of audit records"
 */
export async function handleGetUrl(
  page: Page,
  context: ActionContext
): Promise<ActionResult<string>> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing get URL action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });

    const url = page.url();
    
    const duration = Date.now() - startTime;

    logger.info('Get URL action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      url,
      duration,
    });

    return {
      success: true,
      actionType: 'getUrl',
      data: url,
      duration,
      timestamp: new Date(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown get URL error';

    logger.error('Get URL action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'getUrl',
      error: errorMessage,
      duration,
      timestamp: new Date(),
    };
  }
}

/**
 * Handle get element text action
 * @param selector - CSS selector
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @param timeout - Optional timeout
 * @returns Action result with element text
 */
export async function handleGetElementText(
  selector: string,
  page: Page,
  context: ActionContext,
  timeout?: number
): Promise<ActionResult<string>> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing get element text action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
    });

    const sanitizedSelector = sanitizeSelector(selector);

    // Wait for element to be available
    await page.waitForSelector(sanitizedSelector, {
      timeout: timeout || 30000,
    });

    // Get element text
    const text = await page.$eval(sanitizedSelector, (el: any) => {
      return el.textContent?.trim() || '';
    });
    
    const duration = Date.now() - startTime;

    logger.info('Get element text action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector: sanitizedSelector,
      textLength: text.length,
      duration,
    });

    return {
      success: true,
      actionType: 'getElementText',
      data: text,
      duration,
      timestamp: new Date(),
      metadata: {
        selector: sanitizedSelector,
        originalSelector: selector,
        textLength: text.length,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown get element text error';

    logger.error('Get element text action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'getElementText',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: selector,
      },
    };
  }
}