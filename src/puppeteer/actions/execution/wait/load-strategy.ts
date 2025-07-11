/**
 * Load state wait strategy implementation
 * @module puppeteer/actions/execution/wait/load-strategy
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { WaitConditionConfig } from '../types.js';
import type { WaitResult } from './types.js';
import { BaseWaitStrategy } from './base-strategy.js';
import { DEFAULT_CONFIG } from '../types.js';

/**
 * Wait for load state strategy
 * @nist ac-3 "Access enforcement"
 */
export class LoadStateWaitStrategy extends BaseWaitStrategy {
  constructor() {
    super('load');
  }

  /**
   * Execute load state wait
   */
  protected async executeWait(page: Page, config: WaitConditionConfig): Promise<WaitResult> {
    const startTime = Date.now();
    const timeout = config.duration || DEFAULT_CONFIG.TIMEOUT.navigation;

    await page.waitForFunction('document.readyState === "complete"', { timeout });

    return {
      success: true,
      condition: 'page_loaded',
      actualDuration: Date.now() - startTime,
      details: {
        readyState: 'complete',
      },
    };
  }

  /**
   * Validate load configuration
   */
  validate(_config: WaitConditionConfig): boolean {
    return true;
  }

  /**
   * Wait for specific document ready state
   */
  async waitForReadyState(
    page: Page,
    readyState: 'loading' | 'interactive' | 'complete' = 'complete',
    timeout: number = DEFAULT_CONFIG.TIMEOUT.navigation,
  ): Promise<WaitResult> {
    const startTime = Date.now();

    await page.waitForFunction((state) => document.readyState === state, { timeout }, readyState);

    return {
      success: true,
      condition: `document_${readyState}`,
      actualDuration: Date.now() - startTime,
      details: {
        readyState,
      },
    };
  }

  /**
   * Wait for DOM content loaded
   */
  async waitForDOMContentLoaded(
    page: Page,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.navigation,
  ): Promise<WaitResult> {
    const startTime = Date.now();

    await page.waitForFunction(
      () => document.readyState === 'interactive' || document.readyState === 'complete',
      { timeout },
    );

    return {
      success: true,
      condition: 'dom_content_loaded',
      actualDuration: Date.now() - startTime,
      details: {
        readyState: await page.evaluate(() => document.readyState),
      },
    };
  }
}
