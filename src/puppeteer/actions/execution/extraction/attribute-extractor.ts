/**
 * Attribute extraction handler
 * @module puppeteer/actions/execution/extraction/attribute-extractor
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

const logger = createLogger('puppeteer:attribute-extractor');


/**
 * Attribute extractor for extracting element attributes
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class AttributeExtractor {
  /**
   * Extract attribute from element
   * @param page - Page instance
   * @param selector - Element selector
   * @param attribute - Attribute name
   * @param timeout - Element wait timeout
   * @returns Attribute value
   * @nist ac-3 "Access enforcement"
   */
  private async extractAttribute(
    page: Page,
    selector: string,
    attribute: string,
    timeout: number,
  ): Promise<string | null> {
    await page.waitForSelector(selector, { timeout });

    // Use typed evaluation to ensure safe return
    const getValue = (el: Element, attr: string): string | null => {
       
      return el.getAttribute(attr);
    };
    
    const result = await page.$eval(selector, getValue, attribute);
    
    return result;
  }

  /**
   * Build successful attribute result
   * @param value - Attribute value
   * @param selector - Element selector
   * @param attribute - Attribute name
   * @param duration - Execution duration
   * @returns Action result
   * @nist au-3 "Content of audit records"
   */
  private buildSuccessResult(
    value: string | null,
    selector: string,
    attribute: string,
    duration: number,
  ): ActionResult {
    const sanitizedSelector = sanitizeSelector(selector);

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
  }

  /**
   * Build error result
   * @param error - Error that occurred
   * @param selector - Element selector
   * @param attribute - Attribute name
   * @param duration - Execution duration
   * @returns Action result
   * @nist au-3 "Content of audit records"
   */
  private buildErrorResult(
    error: unknown,
    selector: string,
    attribute: string,
    duration: number,
  ): ActionResult {
    const errorMessage = error instanceof Error ? error.message : 'getAttribute action failed';

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

  /**
   * Execute attribute extraction
   * @param options - Attribute extraction options
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
    options: { selector: string; attribute: string; timeout?: number },
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const actualTimeout = options.timeout ?? DEFAULT_CONFIG.TIMEOUT.element;
    const startTime = Date.now();

    try {
      logger.debug('Executing getAttribute action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: options.selector,
        attribute: options.attribute,
      });

      const value = await this.extractAttribute(page, options.selector, options.attribute, actualTimeout);
      const duration = Date.now() - startTime;

      logger.info('getAttribute action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: sanitizeSelector(options.selector),
        attribute: options.attribute,
        hasValue: value !== null,
        duration,
      });

      return this.buildSuccessResult(value, options.selector, options.attribute, duration);
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('getAttribute action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: options.selector,
        attribute: options.attribute,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return this.buildErrorResult(error, options.selector, options.attribute, duration);
    }
  }
}