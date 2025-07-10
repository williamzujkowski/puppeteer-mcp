/**
 * Navigation wait strategy implementation
 * @module puppeteer/actions/execution/wait/navigation-strategy
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { WaitConditionConfig } from '../types.js';
import type { WaitResult } from './types.js';
import { BaseWaitStrategy } from './base-strategy.js';
import { DEFAULT_CONFIG } from '../types.js';

/**
 * Navigation wait options
 */
export type NavigationWaitUntil = 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';

/**
 * Wait for navigation strategy
 * @nist ac-3 "Access enforcement"
 */
export class NavigationWaitStrategy extends BaseWaitStrategy {
  constructor() {
    super('navigation');
  }

  /**
   * Execute navigation wait
   */
  protected async executeWait(page: Page, config: WaitConditionConfig): Promise<WaitResult> {
    const startTime = Date.now();
    const timeout = config.duration ?? DEFAULT_CONFIG.TIMEOUT.navigation;

    const response = await page.waitForNavigation({
      timeout,
      waitUntil: 'load', // Default wait condition
    });

    return {
      success: true,
      condition: 'navigation_completed',
      actualDuration: Date.now() - startTime,
      details: {
        url: page.url(),
        statusCode: response?.status(),
        navigationCompleted: true,
      },
    };
  }

  /**
   * Validate navigation configuration
   */
  validate(_config: WaitConditionConfig): boolean {
    // Navigation wait doesn't require specific configuration
    return true;
  }

  /**
   * Execute wait for navigation with specific options
   */
  async executeWaitForNavigation(
    page: Page,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.navigation,
    waitUntil: NavigationWaitUntil = 'load',
  ): Promise<WaitResult> {
    const startTime = Date.now();

    try {
      const response = await page.waitForNavigation({
        timeout,
        waitUntil,
      });

      return {
        success: true,
        condition: this.getConditionForWaitUntil(waitUntil),
        actualDuration: Date.now() - startTime,
        details: {
          url: page.url(),
          waitUntil,
          statusCode: response?.status(),
          navigationCompleted: true,
        },
      };
    } catch (error) {
      throw new Error(`Navigation wait failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get condition description for wait until option
   */
  private getConditionForWaitUntil(waitUntil: NavigationWaitUntil): string {
    switch (waitUntil) {
      case 'load':
        return 'page_loaded';
      case 'domcontentloaded':
        return 'dom_content_loaded';
      case 'networkidle0':
        return 'network_idle_0_connections';
      case 'networkidle2':
        return 'network_idle_2_connections';
      default:
        return 'navigation_completed';
    }
  }
}

/**
 * Network idle wait strategy
 * @nist ac-3 "Access enforcement"
 */
export class NetworkIdleWaitStrategy extends BaseWaitStrategy {
  constructor() {
    super('networkidle');
  }

  /**
   * Execute network idle wait
   */
  protected async executeWait(page: Page, config: WaitConditionConfig): Promise<WaitResult> {
    const startTime = Date.now();
    const timeout = config.duration ?? DEFAULT_CONFIG.TIMEOUT.navigation;

    await page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout,
    });

    return {
      success: true,
      condition: 'network_idle',
      actualDuration: Date.now() - startTime,
      details: {
        idleConnections: 0,
      },
    };
  }

  /**
   * Validate network idle configuration
   */
  validate(_config: WaitConditionConfig): boolean {
    return true;
  }
}