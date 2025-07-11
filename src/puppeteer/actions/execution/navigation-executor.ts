/**
 * Navigation-related actions executor (backward compatibility wrapper)
 * @module puppeteer/actions/execution/navigation-executor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @deprecated Use the modular navigation system from './navigation/' instead
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  NavigateAction,
} from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';
import {
  NavigationExecutor as ModularNavigationExecutor,
  createNavigationExecutor,
  type NavigationExecutorConfig,
} from './navigation/index.js';

const logger = createLogger('puppeteer:navigation-executor:compat');

/**
 * Navigation action executor (backward compatibility wrapper)
 * @deprecated Use NavigationExecutor from './navigation/' instead
 * @nist ac-3 "Access enforcement"
 */
export class NavigationExecutor {
  private readonly executor: ModularNavigationExecutor;
  private readonly logger = logger;

  constructor(config?: NavigationExecutorConfig) {
    logger.warn(
      'Using deprecated NavigationExecutor. Consider migrating to the modular navigation system.',
    );

    this.executor = createNavigationExecutor({
      enablePerformanceMonitoring: true,
      enableUrlValidation: true,
      enableRequestLogging: true,
      enableExecutionMetrics: true,
      maxConcurrentNavigations: 5,
      ...config,
    });
  }

  /**
   * Execute navigation action
   * @param action - Navigation action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @deprecated Use executor.execute() instead
   */
  async executeNavigate(
    action: NavigateAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    return this.executor.executeNavigate(action, page, context);
  }

  /**
   * Execute go back action
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Action result
   * @deprecated Use executor.execute() instead
   */
  async executeGoBack(page: Page, context: ActionContext, timeout?: number): Promise<ActionResult> {
    // Check if navigation is possible (for logging purposes)
    const canNavigateBack = await this.canGoBack(page);
    if (!canNavigateBack) {
      this.logger.warn('Cannot go back - no history available');
    }
    return this.executor.executeGoBack(page, context, timeout);
  }

  /**
   * Execute go forward action
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Action result
   * @deprecated Use executor.execute() instead
   */
  async executeGoForward(
    page: Page,
    context: ActionContext,
    timeout?: number,
  ): Promise<ActionResult> {
    // Check if navigation is possible (for logging purposes)
    const canNavigateForward = await this.canGoForward(page);
    if (!canNavigateForward) {
      this.logger.warn('Cannot go forward - no forward history available');
    }
    return this.executor.executeGoForward(page, context, timeout);
  }

  /**
   * Execute refresh action
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Action result
   * @deprecated Use executor.execute() instead
   */
  async executeRefresh(
    page: Page,
    context: ActionContext,
    timeout?: number,
  ): Promise<ActionResult> {
    return this.executor.executeRefresh(page, context, timeout);
  }

  /**
   * Execute set viewport action
   * @param page - Page instance
   * @param context - Execution context
   * @param width - Viewport width
   * @param height - Viewport height
   * @param deviceScaleFactor - Device scale factor
   * @returns Action result
   * @deprecated Use executor.execute() instead
   */
  async executeSetViewport(
    page: Page,
    context: ActionContext,
    width: number,
    height: number,
    deviceScaleFactor = 1,
  ): Promise<ActionResult> {
    return this.executor.executeSetViewport(page, context, width, height, deviceScaleFactor);
  }

  /**
   * Execute route handler for navigation actions
   * @param action - Browser action
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @deprecated Use executor.execute() instead
   */
  async execute(action: BrowserAction, page: Page, context: ActionContext): Promise<ActionResult> {
    return this.executor.execute(action, page, context);
  }

  /**
   * Check if page can go back
   * @param page - Page instance
   * @returns True if can go back
   * @deprecated Use HistoryNavigator.getHistoryCapability() instead
   */
  private async canGoBack(page: Page): Promise<boolean> {
    try {
      return await page.evaluate(() => window.history.length > 1);
    } catch {
      return false;
    }
  }

  /**
   * Check if page can go forward
   * @param page - Page instance
   * @returns True if can go forward
   * @deprecated Use HistoryNavigator.getHistoryCapability() instead
   */
  private async canGoForward(page: Page): Promise<boolean> {
    try {
      // This is a simplified check - actual forward capability
      // is harder to determine in modern browsers
      return await page.evaluate(() => {
        try {
          window.history.forward();
          return true;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  /**
   * Get supported navigation action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return this.executor.getSupportedActions();
  }

  /**
   * Get the underlying modular executor
   * @returns Modular navigation executor
   */
  getModularExecutor(): ModularNavigationExecutor {
    return this.executor;
  }
}
