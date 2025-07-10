/**
 * Screenshot extraction handler
 * @module puppeteer/actions/execution/extraction/screenshot-extractor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  ScreenshotAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import type { ScreenshotConfig } from '../types.js';
import { DEFAULT_CONFIG } from '../types.js';
import { sanitizeSelector } from '../../validation.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:screenshot-extractor');

/**
 * Screenshot extractor for capturing page/element screenshots
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class ScreenshotExtractor {
  /**
   * Extract screenshot configuration from action
   * @param action - Screenshot action
   * @returns Screenshot configuration
   * @nist si-10 "Information input validation"
   */
  private extractConfig(action: ScreenshotAction): ScreenshotConfig {
    return {
      fullPage: action.fullPage ?? DEFAULT_CONFIG.SCREENSHOT.fullPage,
      format: action.format ?? DEFAULT_CONFIG.SCREENSHOT.format,
      quality: action.quality ?? DEFAULT_CONFIG.SCREENSHOT.quality,
    };
  }

  /**
   * Capture screenshot of element
   * @param page - Page instance
   * @param selector - Element selector
   * @param config - Screenshot configuration
   * @param timeout - Element wait timeout
   * @returns Screenshot buffer
   * @nist ac-3 "Access enforcement"
   */
  private async captureElement(
    page: Page,
    selector: string,
    config: ScreenshotConfig,
    timeout: number,
  ): Promise<Buffer> {
    const element = await page.waitForSelector(selector, { timeout });

    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    return element.screenshot({
      type: config.format,
      quality: config.format === 'jpeg' ? config.quality : undefined,
    });
  }

  /**
   * Capture screenshot of page
   * @param page - Page instance
   * @param config - Screenshot configuration
   * @returns Screenshot buffer
   * @nist ac-3 "Access enforcement"
   */
  private async capturePage(
    page: Page,
    config: ScreenshotConfig,
  ): Promise<Buffer> {
    return page.screenshot({
      fullPage: config.fullPage,
      type: config.format,
      quality: config.format === 'jpeg' ? config.quality : undefined,
    });
  }

  /**
   * Build successful screenshot result
   * @param buffer - Screenshot buffer
   * @param action - Original action
   * @param config - Screenshot configuration
   * @param duration - Execution duration
   * @returns Action result
   * @nist au-3 "Content of audit records"
   */
  private buildSuccessResult(
    buffer: Buffer,
    action: ScreenshotAction,
    config: ScreenshotConfig,
    duration: number,
  ): ActionResult {
    const base64 = buffer.toString('base64');

    return {
      success: true,
      actionType: 'screenshot',
      data: {
        screenshot: base64,
        format: config.format,
        size: buffer.length,
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
    action: ScreenshotAction,
    duration: number,
  ): ActionResult {
    const errorMessage = error instanceof Error ? error.message : 'Screenshot action failed';

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

  /**
   * Execute screenshot extraction
   * @param action - Screenshot action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
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

      const config = this.extractConfig(action);
      const timeout = action.timeout ?? DEFAULT_CONFIG.TIMEOUT.element;

      const buffer = action.selector
        ? await this.captureElement(page, action.selector, config, timeout)
        : await this.capturePage(page, config);

      const duration = Date.now() - startTime;

      logger.info('Screenshot action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector ? sanitizeSelector(action.selector) : undefined,
        fullPage: config.fullPage,
        format: config.format,
        size: buffer.length,
        duration,
      });

      return this.buildSuccessResult(buffer, action, config, duration);
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Screenshot action failed', {
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