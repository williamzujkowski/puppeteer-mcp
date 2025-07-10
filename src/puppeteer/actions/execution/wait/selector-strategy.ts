/**
 * Selector wait strategy implementation
 * @module puppeteer/actions/execution/wait/selector-strategy
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { WaitConditionConfig } from '../types.js';
import type { WaitResult } from './types.js';
import { BaseWaitStrategy } from './base-strategy.js';
import { DEFAULT_CONFIG } from '../types.js';

/**
 * Wait for selector strategy
 * @nist ac-3 "Access enforcement"
 */
export class SelectorWaitStrategy extends BaseWaitStrategy {
  constructor() {
    super('selector');
  }

  /**
   * Execute selector wait
   */
  protected async executeWait(page: Page, config: WaitConditionConfig): Promise<WaitResult> {
    const startTime = Date.now();
    const timeout = config.duration ?? DEFAULT_CONFIG.TIMEOUT.element;

    if (!config.selector) {
      throw new Error('Selector is required for selector wait');
    }
    const element = await page.waitForSelector(config.selector, {
      timeout,
      visible: config.visible,
      hidden: config.hidden,
    });

    return {
      success: true,
      condition: this.getConditionDescription(config),
      actualDuration: Date.now() - startTime,
      details: {
        found: element !== null,
        visible: config.visible,
        hidden: config.hidden,
      },
    };
  }

  /**
   * Validate selector configuration
   */
  validate(config: WaitConditionConfig): boolean {
    if (config.selector === undefined || config.selector === null || config.selector === '') {
      this.logger.error('Selector is required for selector wait');
      return false;
    }

    if (config.visible === true && config.hidden === true) {
      this.logger.error('Cannot wait for element to be both visible and hidden');
      return false;
    }

    return true;
  }

  /**
   * Get condition description based on configuration
   */
  private getConditionDescription(config: WaitConditionConfig): string {
    if (config.visible === true) {
      return 'selector_visible';
    }
    if (config.hidden === true) {
      return 'selector_hidden';
    }
    return 'selector_found';
  }
}

/**
 * Extended selector wait strategy with additional options
 * @nist ac-3 "Access enforcement"
 */
export class ExtendedSelectorWaitStrategy extends SelectorWaitStrategy {
  /**
   * Execute wait for selector with additional handling
   */
  async executeWaitForSelector(
    selector: string,
    page: Page,
    options?: {
      timeout?: number;
      visible?: boolean;
      hidden?: boolean;
    },
  ): Promise<WaitResult> {
    const config: WaitConditionConfig = {
      type: 'selector',
      selector,
      duration: options?.timeout ?? DEFAULT_CONFIG.TIMEOUT.element,
      visible: options?.visible ?? false,
      hidden: options?.hidden ?? false,
    };

    return this.executeWait(page, config);
  }
}