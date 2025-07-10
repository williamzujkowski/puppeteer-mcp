/**
 * Navigation-related actions executor
 * @module puppeteer/actions/execution/navigation-executor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  NavigateAction,
} from '../../interfaces/action-executor.interface.js';
import type { NavigationWaitOptions } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:navigation-executor');

/**
 * Navigation action executor
 * @nist ac-3 "Access enforcement"
 */
export class NavigationExecutor {
  /**
   * Execute navigation action
   * @param action - Navigation action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeNavigate(
    action: NavigateAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing navigate action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url: action.url,
        waitUntil: action.waitUntil,
        timeout: action.timeout,
      });

      const options: NavigationWaitOptions = {
        waitUntil: action.waitUntil || 'load',
        timeout: action.timeout || DEFAULT_CONFIG.TIMEOUT.navigation,
      };

      // Navigate to URL
      const response = await page.goto(action.url, options);

      const duration = Date.now() - startTime;
      const statusCode = response?.status();
      const finalUrl = page.url();

      logger.info('Navigation completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url: action.url,
        finalUrl,
        statusCode,
        duration,
      });

      return {
        success: true,
        actionType: 'navigate',
        data: {
          url: finalUrl,
          statusCode,
          title: await page.title().catch(() => ''),
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalUrl: action.url,
          finalUrl,
          statusCode,
          waitUntil: options.waitUntil,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Navigation failed';

      logger.error('Navigation failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url: action.url,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'navigate',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          url: action.url,
          currentUrl: page.url(),
        },
      };
    }
  }

  /**
   * Execute go back action
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Action result
   */
  async executeGoBack(
    page: Page,
    context: ActionContext,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.navigation,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing go back action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        timeout,
      });

      const response = await page.goBack({ 
        waitUntil: 'load',
        timeout,
      });

      const duration = Date.now() - startTime;
      const finalUrl = page.url();

      logger.info('Go back completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        finalUrl,
        duration,
      });

      return {
        success: true,
        actionType: 'goBack',
        data: {
          url: finalUrl,
          canGoBack: await this.canGoBack(page),
          canGoForward: await this.canGoForward(page),
        },
        duration,
        timestamp: new Date(),
        metadata: {
          finalUrl,
          statusCode: response?.status(),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Go back failed';

      logger.error('Go back failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'goBack',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          currentUrl: page.url(),
        },
      };
    }
  }

  /**
   * Execute go forward action
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Action result
   */
  async executeGoForward(
    page: Page,
    context: ActionContext,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.navigation,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing go forward action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        timeout,
      });

      const response = await page.goForward({ 
        waitUntil: 'load',
        timeout,
      });

      const duration = Date.now() - startTime;
      const finalUrl = page.url();

      logger.info('Go forward completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        finalUrl,
        duration,
      });

      return {
        success: true,
        actionType: 'goForward',
        data: {
          url: finalUrl,
          canGoBack: await this.canGoBack(page),
          canGoForward: await this.canGoForward(page),
        },
        duration,
        timestamp: new Date(),
        metadata: {
          finalUrl,
          statusCode: response?.status(),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Go forward failed';

      logger.error('Go forward failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'goForward',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          currentUrl: page.url(),
        },
      };
    }
  }

  /**
   * Execute refresh action
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Action result
   */
  async executeRefresh(
    page: Page,
    context: ActionContext,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.navigation,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing refresh action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        timeout,
      });

      const response = await page.reload({ 
        waitUntil: 'load',
        timeout,
      });

      const duration = Date.now() - startTime;
      const finalUrl = page.url();

      logger.info('Refresh completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        finalUrl,
        duration,
      });

      return {
        success: true,
        actionType: 'refresh',
        data: {
          url: finalUrl,
          title: await page.title().catch(() => ''),
          statusCode: response?.status(),
        },
        duration,
        timestamp: new Date(),
        metadata: {
          finalUrl,
          statusCode: response?.status(),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Refresh failed';

      logger.error('Refresh failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'refresh',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          currentUrl: page.url(),
        },
      };
    }
  }

  /**
   * Execute set viewport action
   * @param page - Page instance
   * @param context - Execution context
   * @param width - Viewport width
   * @param height - Viewport height
   * @param deviceScaleFactor - Device scale factor
   * @returns Action result
   */
  async executeSetViewport(
    page: Page,
    context: ActionContext,
    width: number,
    height: number,
    deviceScaleFactor: number = 1,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing set viewport action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        width,
        height,
        deviceScaleFactor,
      });

      await page.setViewport({
        width,
        height,
        deviceScaleFactor,
      });

      const duration = Date.now() - startTime;
      const viewport = page.viewport();

      logger.info('Set viewport completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        viewport,
        duration,
      });

      return {
        success: true,
        actionType: 'setViewport',
        data: {
          viewport,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          requestedWidth: width,
          requestedHeight: height,
          requestedScale: deviceScaleFactor,
          actualViewport: viewport,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Set viewport failed';

      logger.error('Set viewport failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'setViewport',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          requestedWidth: width,
          requestedHeight: height,
          requestedScale: deviceScaleFactor,
        },
      };
    }
  }

  /**
   * Execute route handler for navigation actions
   * @param action - Browser action
   * @param page - Page instance  
   * @param context - Execution context
   * @returns Action result
   */
  async execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    switch (action.type) {
      case 'navigate':
        return this.executeNavigate(action as NavigateAction, page, context);
      case 'goBack':
        return this.executeGoBack(page, context, action.timeout);
      case 'goForward':
        return this.executeGoForward(page, context, action.timeout);
      case 'refresh':
        return this.executeRefresh(page, context, action.timeout);
      default:
        throw new Error(`Unsupported navigation action: ${action.type}`);
    }
  }

  /**
   * Check if page can go back
   * @param page - Page instance
   * @returns True if can go back
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
    return ['navigate', 'goBack', 'goForward', 'refresh', 'setViewport'];
  }
}