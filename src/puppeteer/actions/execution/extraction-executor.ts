/**
 * Data extraction actions executor
 * @module puppeteer/actions/execution/extraction-executor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ScreenshotAction,
  PDFAction,
  ContentAction,
} from '../../interfaces/action-executor.interface.js';
import type { ScreenshotConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:extraction-executor');

/**
 * Extraction action executor
 * @nist ac-3 "Access enforcement"
 */
export class ExtractionExecutor {
  /**
   * Execute screenshot action
   * @param action - Screenshot action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeScreenshot(
    action: ScreenshotAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing screenshot action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        fullPage: action.fullPage,
        selector: action.selector,
        format: action.format,
        quality: action.quality,
      });

      const config: ScreenshotConfig = {
        fullPage: action.fullPage ?? DEFAULT_CONFIG.SCREENSHOT.fullPage,
        format: action.format ?? DEFAULT_CONFIG.SCREENSHOT.format,
        quality: action.quality ?? DEFAULT_CONFIG.SCREENSHOT.quality,
      };

      let screenshotBuffer: Buffer;

      if (action.selector) {
        // Screenshot of specific element
        const element = await page.waitForSelector(action.selector, {
          timeout: action.timeout || DEFAULT_CONFIG.TIMEOUT.element,
        });

        if (!element) {
          throw new Error(`Element not found: ${action.selector}`);
        }

        screenshotBuffer = await element.screenshot({
          type: config.format,
          quality: config.format === 'jpeg' ? config.quality : undefined,
        });
      } else {
        // Full page or viewport screenshot
        screenshotBuffer = await page.screenshot({
          fullPage: config.fullPage,
          type: config.format,
          quality: config.format === 'jpeg' ? config.quality : undefined,
        });
      }

      const duration = Date.now() - startTime;
      const screenshotBase64 = screenshotBuffer.toString('base64');

      logger.info('Screenshot action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector ? sanitizeSelector(action.selector) : undefined,
        fullPage: config.fullPage,
        format: config.format,
        size: screenshotBuffer.length,
        duration,
      });

      return {
        success: true,
        actionType: 'screenshot',
        data: {
          screenshot: screenshotBase64,
          format: config.format,
          size: screenshotBuffer.length,
          selector: action.selector ? sanitizeSelector(action.selector) : undefined,
          fullPage: config.fullPage,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalSelector: action.selector,
          quality: config.quality,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Screenshot action failed';

      logger.error('Screenshot action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector,
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
          fullPage: action.fullPage,
          format: action.format,
        },
      };
    }
  }

  /**
   * Execute PDF generation action
   * @param action - PDF action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executePDF(
    action: PDFAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing PDF action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        format: action.format,
        landscape: action.landscape,
        scale: action.scale,
      });

      const pdfBuffer = await page.pdf({
        format: action.format || 'a4',
        landscape: action.landscape || false,
        scale: action.scale || 1,
        displayHeaderFooter: action.displayHeaderFooter || false,
        headerTemplate: action.headerTemplate || '',
        footerTemplate: action.footerTemplate || '',
        printBackground: action.printBackground || false,
        preferCSSPageSize: action.preferCSSPageSize || false,
        pageRanges: action.pageRanges || '',
        margin: action.margin || {},
        timeout: action.timeout || DEFAULT_CONFIG.TIMEOUT.default,
      });

      const duration = Date.now() - startTime;
      const pdfBase64 = pdfBuffer.toString('base64');

      logger.info('PDF action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        format: action.format,
        size: pdfBuffer.length,
        duration,
      });

      return {
        success: true,
        actionType: 'pdf',
        data: {
          pdf: pdfBase64,
          format: action.format || 'a4',
          size: pdfBuffer.length,
          landscape: action.landscape || false,
          scale: action.scale || 1,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          displayHeaderFooter: action.displayHeaderFooter,
          printBackground: action.printBackground,
          preferCSSPageSize: action.preferCSSPageSize,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'PDF action failed';

      logger.error('PDF action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
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
   * Execute content extraction action
   * @param action - Content action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeContent(
    action: ContentAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing content action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector,
      });

      let content: string;
      let contentType: string;

      if (action.selector) {
        // Extract content from specific element
        await page.waitForSelector(action.selector, {
          timeout: action.timeout || DEFAULT_CONFIG.TIMEOUT.element,
        });

        content = await page.$eval(action.selector, (element) => {
          if (element instanceof HTMLInputElement || 
              element instanceof HTMLTextAreaElement) {
            return element.value;
          }
          return element.textContent || element.innerHTML || '';
        });
        contentType = 'element';
      } else {
        // Extract full page content
        content = await page.content();
        contentType = 'html';
      }

      const duration = Date.now() - startTime;

      logger.info('Content action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector ? sanitizeSelector(action.selector) : undefined,
        contentLength: content.length,
        contentType,
        duration,
      });

      return {
        success: true,
        actionType: 'content',
        data: {
          content,
          contentType,
          selector: action.selector ? sanitizeSelector(action.selector) : undefined,
          length: content.length,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalSelector: action.selector,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Content action failed';

      logger.error('Content action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector,
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

  /**
   * Execute text extraction action
   * @param selector - Element selector
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Action timeout
   * @returns Action result
   */
  async executeGetText(
    selector: string,
    page: Page,
    context: ActionContext,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.element,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing getText action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector,
      });

      await page.waitForSelector(selector, { timeout });

      const text = await page.$eval(selector, (element) => {
        if (element instanceof HTMLInputElement || 
            element instanceof HTMLTextAreaElement) {
          return element.value;
        }
        return element.textContent?.trim() || '';
      });

      const duration = Date.now() - startTime;
      const sanitizedSelector = sanitizeSelector(selector);

      logger.info('getText action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: sanitizedSelector,
        textLength: text.length,
        duration,
      });

      return {
        success: true,
        actionType: 'getText',
        data: {
          text,
          selector: sanitizedSelector,
          length: text.length,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalSelector: selector,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'getText action failed';

      logger.error('getText action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'getText',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          selector,
        },
      };
    }
  }

  /**
   * Execute attribute extraction action
   * @param selector - Element selector
   * @param attribute - Attribute name
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Action timeout
   * @returns Action result
   */
  async executeGetAttribute(
    selector: string,
    attribute: string,
    page: Page,
    context: ActionContext,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.element,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing getAttribute action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector,
        attribute,
      });

      await page.waitForSelector(selector, { timeout });

      const value = await page.$eval(selector, (element, attr) => {
        return element.getAttribute(attr);
      }, attribute);

      const duration = Date.now() - startTime;
      const sanitizedSelector = sanitizeSelector(selector);

      logger.info('getAttribute action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: sanitizedSelector,
        attribute,
        hasValue: value !== null,
        duration,
      });

      return {
        success: true,
        actionType: 'getAttribute',
        data: {
          value,
          selector: sanitizedSelector,
          attribute,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalSelector: selector,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'getAttribute action failed';

      logger.error('getAttribute action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector,
        attribute,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'getAttribute',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          selector,
          attribute,
        },
      };
    }
  }

  /**
   * Execute route handler for extraction actions
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
      case 'screenshot':
        return this.executeScreenshot(action as ScreenshotAction, page, context);
      case 'pdf':
        return this.executePDF(action as PDFAction, page, context);
      case 'content':
        return this.executeContent(action as ContentAction, page, context);
      case 'getText': {
        const getTextAction = action as { selector: string; timeout?: number };
        return this.executeGetText(
          getTextAction.selector,
          page,
          context,
          getTextAction.timeout,
        );
      }
      case 'getAttribute': {
        const getAttrAction = action as { 
          selector: string; 
          attribute: string; 
          timeout?: number 
        };
        return this.executeGetAttribute(
          getAttrAction.selector,
          getAttrAction.attribute,
          page,
          context,
          getAttrAction.timeout,
        );
      }
      default:
        throw new Error(`Unsupported extraction action: ${action.type}`);
    }
  }

  /**
   * Get supported extraction action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return ['screenshot', 'pdf', 'content', 'getText', 'getAttribute'];
  }
}