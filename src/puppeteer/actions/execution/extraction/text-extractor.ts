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

    return page.$eval(selector, (element: Element) => {
      if (element instanceof HTMLInputElement || 
          element instanceof HTMLTextAreaElement) {
        return element.value;
      }
      return (element as HTMLElement).textContent?.trim() ?? '';
    });
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
   * @param selector - Element selector
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Action timeout
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
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

      const text = await this.extractText(page, selector, timeout);
      const duration = Date.now() - startTime;

      logger.info('getText action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: sanitizeSelector(selector),
        textLength: text.length,
        duration,
      });

      return this.buildSuccessResult(text, selector, duration);
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('getText action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return this.buildErrorResult(error, selector, duration);
    }
  }
}