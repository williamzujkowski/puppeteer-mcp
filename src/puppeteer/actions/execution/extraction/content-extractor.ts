/**
 * Content extraction handler
 * @module puppeteer/actions/execution/extraction/content-extractor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  ContentAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import { DEFAULT_CONFIG } from '../types.js';
import { sanitizeSelector } from '../../validation.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:content-extractor');

/**
 * Content type enumeration
 */
export enum ContentType {
  HTML = 'html',
  ELEMENT = 'element',
  TEXT = 'text',
  VALUE = 'value',
}

/**
 * Content extraction result
 */
interface ContentResult {
  content: string;
  contentType: ContentType;
  selector?: string;
  length: number;
}

/**
 * Content extractor for extracting page/element content
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class ContentExtractor {
  /**
   * Extract content from element
   * @param page - Page instance
   * @param selector - Element selector
   * @param timeout - Element wait timeout
   * @returns Content result
   * @nist ac-3 "Access enforcement"
   */
  private async extractElementContent(
    page: Page,
    selector: string,
    timeout: number,
  ): Promise<ContentResult> {
    await page.waitForSelector(selector, { timeout });

    const contentResult = await page.$eval(selector, (element: Element) => {
      if (element instanceof HTMLInputElement || 
          element instanceof HTMLTextAreaElement) {
        return { content: element.value, type: 'value' };
      }
      const htmlElement = element as HTMLElement;
      const content = htmlElement.textContent ?? htmlElement.innerHTML ?? '';
      const type = htmlElement.textContent ? 'text' : 'element';
      return { content, type };
    });
    
    const content = (contentResult as { content: string; type: string }).content;
    const contentType = (contentResult as { content: string; type: string }).type;

    return {
      content,
      contentType: contentType as ContentType,
      selector: sanitizeSelector(selector),
      length: content.length,
    };
  }

  /**
   * Extract full page content
   * @param page - Page instance
   * @returns Content result
   * @nist ac-3 "Access enforcement"
   */
  private async extractPageContent(page: Page): Promise<ContentResult> {
    const content = await page.content();

    return {
      content,
      contentType: ContentType.HTML,
      length: content.length,
    };
  }

  /**
   * Build successful content result
   * @param contentResult - Content extraction result
   * @param action - Original action
   * @param duration - Execution duration
   * @returns Action result
   * @nist au-3 "Content of audit records"
   */
  private buildSuccessResult(
    contentResult: ContentResult,
    action: ContentAction,
    duration: number,
  ): ActionResult {
    return {
      success: true,
      actionType: 'content',
      data: contentResult,
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: action.selector,
      },
    };
  }

  /**
   * Build error result
   * @param error - Error that occurred
   * @param action - Original action
   * @param duration - Execution duration
   * @returns Action result
   * @nist au-3 "Content of audit records"
   */
  private buildErrorResult(
    error: unknown,
    action: ContentAction,
    duration: number,
  ): ActionResult {
    const errorMessage = error instanceof Error ? error.message : 'Content action failed';

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

  /**
   * Execute content extraction
   * @param action - Content action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
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

      const timeout = action.timeout ?? DEFAULT_CONFIG.TIMEOUT.element;
      
      const contentResult = action.selector
        ? await this.extractElementContent(page, action.selector, timeout)
        : await this.extractPageContent(page);

      const duration = Date.now() - startTime;

      logger.info('Content action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: contentResult.selector,
        contentLength: contentResult.length,
        contentType: contentResult.contentType,
        duration,
      });

      return this.buildSuccessResult(contentResult, action, duration);
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Content action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return this.buildErrorResult(error, action, duration);
    }
  }
}