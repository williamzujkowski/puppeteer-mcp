/**
 * Text extraction handler
 * @module puppeteer/actions/execution/extraction/text-extractor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import { DEFAULT_CONFIG } from '../types.js';
import { sanitizeSelector } from '../../validation.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:text-extractor');


/**
 * Text extractor for extracting text content from elements
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class TextExtractor {
  /**
   * Extract text from element
   * @param page - Page instance
   * @param selector - Element selector
   * @param timeout - Element wait timeout
   * @returns Text content
   * @nist ac-3 "Access enforcement"
   */
  private async extractText(
    page: Page,
    selector: string,
    timeout: number,
  ): Promise<string> {
    await page.waitForSelector(selector, { timeout });

    // Use typed evaluation to ensure safe return
    const getText = (element: Element): string => {
      if (element instanceof HTMLInputElement || 
          element instanceof HTMLTextAreaElement) {
         
        return element.value;
      }
       
      return (element as HTMLElement).textContent?.trim() ?? '';
    };
    
    const result = await page.$eval(selector, getText);
    
    return result;
  }

  /**
   * Build successful text result
   * @param text - Extracted text
   * @param selector - Element selector
   * @param duration - Execution duration
   * @returns Action result
   * @nist au-3 "Content of audit records"
   */
  private buildSuccessResult(
    text: string,
    selector: string,
    duration: number,
  ): ActionResult {
    const sanitizedSelector = sanitizeSelector(selector);

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
  }

  /**
   * Build error result
   * @param error - Error that occurred
   * @param selector - Element selector
   * @param duration - Execution duration
   * @returns Action result
   * @nist au-3 "Content of audit records"
   */
  private buildErrorResult(
    error: unknown,
    selector: string,
    duration: number,
  ): ActionResult {
    const errorMessage = error instanceof Error ? error.message : 'getText action failed';

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

  /**
   * Execute text extraction
   * @param options - Text extraction options
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
    options: { selector: string; timeout?: number },
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const timeout = options.timeout ?? DEFAULT_CONFIG.TIMEOUT.element;
    const startTime = Date.now();

    try {
      logger.debug('Executing getText action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: options.selector,
      });

      const text = await this.extractText(page, options.selector, timeout);
      const duration = Date.now() - startTime;

      logger.info('getText action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: sanitizeSelector(options.selector),
        textLength: text.length,
        duration,
      });

      return this.buildSuccessResult(text, options.selector, duration);
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('getText action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: options.selector,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return this.buildErrorResult(error, options.selector, duration);
    }
  }
}