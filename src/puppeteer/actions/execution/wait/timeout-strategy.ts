/**
 * Timeout wait strategy implementation
 * @module puppeteer/actions/execution/wait/timeout-strategy
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { WaitConditionConfig } from '../types.js';
import type { WaitResult } from './types.js';
import { BaseWaitStrategy } from './base-strategy.js';

/**
 * Wait for timeout strategy
 * @nist ac-3 "Access enforcement"
 */
export class TimeoutWaitStrategy extends BaseWaitStrategy {
  constructor() {
    super('timeout');
  }

  /**
   * Execute timeout wait
   */
  protected async executeWait(_page: Page, config: WaitConditionConfig): Promise<WaitResult> {
    const startTime = Date.now();
    if (!config.duration) {
      throw new Error('Duration is required for timeout wait');
    }
    const duration = config.duration;

    // Use a delay promise as waitForTimeout might not be available in all Puppeteer versions
    await new Promise<void>((resolve) => {
      setTimeout(resolve, duration);
    });

    const actualDuration = Date.now() - startTime;

    return {
      success: true,
      condition: 'timeout_elapsed',
      actualDuration,
      details: {
        requestedDuration: duration,
        actualDuration,
        driftMs: Math.abs(actualDuration - duration),
      },
    };
  }

  /**
   * Validate timeout configuration
   */
  validate(config: WaitConditionConfig): boolean {
    if (config.duration === undefined || config.duration === null || config.duration === 0) {
      this.logger.error('Duration is required for timeout wait');
      return false;
    }

    if (config.duration < 0) {
      this.logger.error('Duration must be a positive number');
      return false;
    }

    if (config.duration > 300000) {
      // 5 minutes max
      this.logger.warn('Duration exceeds recommended maximum of 5 minutes');
    }

    return true;
  }

  /**
   * Execute wait for specific duration
   */
  async executeWaitForTimeout(duration: number, page: Page): Promise<WaitResult> {
    const config: WaitConditionConfig = {
      type: 'timeout',
      duration,
    };

    return this.executeWait(page, config);
  }
}
