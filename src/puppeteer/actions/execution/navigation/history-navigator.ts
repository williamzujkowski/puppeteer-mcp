/**
 * History navigation strategy for back/forward/refresh operations
 * @module puppeteer/actions/execution/navigation/history-navigator
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page, HTTPResponse } from 'puppeteer';
import type {
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import type { NavigationWaitOptions } from '../types.js';
import { DEFAULT_CONFIG } from '../types.js';
import { createLogger } from '../../../../utils/logger.js';
import { PerformanceMonitor } from './performance-monitor.js';

const logger = createLogger('puppeteer:navigation:history-navigator');

/**
 * History navigation types
 */
export type HistoryNavigationType = 'goBack' | 'goForward' | 'refresh';

/**
 * History navigation configuration
 */
export interface HistoryNavigationConfig {
  /** Performance monitor instance */
  performanceMonitor?: PerformanceMonitor;
  /** Default navigation timeout */
  defaultTimeout?: number;
  /** Default wait until condition */
  defaultWaitUntil?: NavigationWaitOptions['waitUntil'];
  /** Enable performance monitoring */
  enablePerformanceMonitoring?: boolean;
  /** Enable history state validation */
  enableHistoryValidation?: boolean;
}

/**
 * History navigation capability
 */
export interface HistoryCapability {
  /** Whether can go back */
  canGoBack: boolean;
  /** Whether can go forward */
  canGoForward: boolean;
  /** Current history length */
  historyLength: number;
  /** Current position in history */
  currentPosition?: number;
}

/**
 * History navigation result
 */
interface HistoryNavigationResult {
  /** Whether navigation succeeded */
  success: boolean;
  /** HTTP response if available */
  response?: HTTPResponse | null;
  /** Error if failed */
  error?: Error;
  /** Final URL after navigation */
  finalUrl: string;
  /** Page title after navigation */
  title?: string;
  /** Navigation duration */
  duration: number;
  /** Updated history capability */
  capability?: HistoryCapability;
}

/**
 * History navigator for back/forward/refresh operations
 * @nist ac-3 "Access enforcement"
 */
export class HistoryNavigator {
  private readonly performanceMonitor?: PerformanceMonitor;
  private readonly config: Required<Omit<HistoryNavigationConfig, 'performanceMonitor'>>;

  constructor(config?: HistoryNavigationConfig) {
    this.performanceMonitor = config?.performanceMonitor;
    
    this.config = {
      defaultTimeout: config?.defaultTimeout ?? DEFAULT_CONFIG.TIMEOUT.navigation,
      defaultWaitUntil: config?.defaultWaitUntil ?? 'load',
      enablePerformanceMonitoring: config?.enablePerformanceMonitoring ?? true,
      enableHistoryValidation: config?.enableHistoryValidation ?? true,
    };

    logger.debug('History navigator initialized', {
      defaultTimeout: this.config.defaultTimeout,
      defaultWaitUntil: this.config.defaultWaitUntil,
      enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
      enableHistoryValidation: this.config.enableHistoryValidation,
    });
  }

  /**
   * Execute go back navigation
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Navigation result
   * @nist ac-3 "Access enforcement"
   */
  async goBack(
    page: Page,
    context: ActionContext,
    timeout?: number
  ): Promise<ActionResult> {
    return this.executeHistoryNavigation('goBack', page, context, timeout);
  }

  /**
   * Execute go forward navigation
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Navigation result
   * @nist ac-3 "Access enforcement"
   */
  async goForward(
    page: Page,
    context: ActionContext,
    timeout?: number
  ): Promise<ActionResult> {
    return this.executeHistoryNavigation('goForward', page, context, timeout);
  }

  /**
   * Execute page refresh
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Navigation result
   * @nist ac-3 "Access enforcement"
   */
  async refresh(
    page: Page,
    context: ActionContext,
    timeout?: number
  ): Promise<ActionResult> {
    return this.executeHistoryNavigation('refresh', page, context, timeout);
  }

  /**
   * Execute history navigation operation
   * @param type - Navigation type
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Navigation result
   * @nist au-3 "Content of audit records"
   */
  private async executeHistoryNavigation(
    type: HistoryNavigationType,
    page: Page,
    context: ActionContext,
    timeout?: number
  ): Promise<ActionResult> {
    const startTime = Date.now();
    let performanceMetrics: any;

    try {
      logger.debug(`Starting ${type} navigation`, {
        sessionId: context.sessionId,
        contextId: context.contextId,
        type,
        timeout,
      });

      // Start performance monitoring
      if (this.config.enablePerformanceMonitoring && this.performanceMonitor) {
        performanceMetrics = await this.performanceMonitor.startNavigation(context.sessionId);
      }

      // Validate history state if enabled
      if (this.config.enableHistoryValidation) {
        const validationResult = await this.validateHistoryOperation(type, page);
        if (!validationResult.canProceed) {
          return this.createFailureResult(
            type,
            startTime,
            validationResult.reason ?? `Cannot ${type}`,
            page,
            performanceMetrics
          );
        }
      }

      // Prepare navigation options
      const options = this.prepareNavigationOptions(timeout);

      // Attempt navigation
      const navigationResult = await this.attemptHistoryNavigation(
        type,
        page,
        options,
        context
      );

      // End performance monitoring
      if (this.config.enablePerformanceMonitoring && this.performanceMonitor && performanceMetrics) {
        await this.performanceMonitor.endNavigation(
          performanceMetrics.id,
          navigationResult.success,
          navigationResult.finalUrl
        );
      }

      if (!navigationResult.success) {
        return this.createFailureResult(
          type,
          startTime,
          navigationResult.error?.message ?? `${type} failed`,
          page,
          performanceMetrics
        );
      }

      // Create success result
      return this.createSuccessResult(
        type,
        startTime,
        navigationResult,
        performanceMetrics
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `${type} failed`;
      
      logger.error(`${type} navigation error`, {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: errorMessage,
      });

      return this.createFailureResult(type, startTime, errorMessage, page, performanceMetrics);
    }
  }

  /**
   * Validate history operation
   * @param type - Navigation type
   * @param page - Page instance
   * @returns Validation result
   */
  private async validateHistoryOperation(
    type: HistoryNavigationType,
    page: Page
  ): Promise<{ canProceed: boolean; reason?: string }> {
    try {
      if (type === 'refresh') {
        // Refresh is always allowed
        return { canProceed: true };
      }

      const capability = await this.getHistoryCapability(page);

      if (type === 'goBack' && !capability.canGoBack) {
        return {
          canProceed: false,
          reason: 'Cannot go back - no previous page in history',
        };
      }

      if (type === 'goForward' && !capability.canGoForward) {
        return {
          canProceed: false,
          reason: 'Cannot go forward - no next page in history',
        };
      }

      return { canProceed: true };

    } catch (error) {
      logger.warn('History validation failed', {
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Allow operation to proceed if validation fails
      return { canProceed: true };
    }
  }

  /**
   * Prepare navigation options
   * @param timeout - Optional timeout override
   * @returns Navigation options
   */
  private prepareNavigationOptions(timeout?: number): NavigationWaitOptions {
    return {
      waitUntil: this.config.defaultWaitUntil,
      timeout: timeout ?? this.config.defaultTimeout,
    };
  }

  /**
   * Attempt history navigation
   * @param type - Navigation type
   * @param page - Page instance
   * @param options - Navigation options
   * @param context - Execution context
   * @returns Navigation result
   */
  private async attemptHistoryNavigation(
    type: HistoryNavigationType,
    page: Page,
    options: NavigationWaitOptions,
    context: ActionContext
  ): Promise<HistoryNavigationResult> {
    const attemptStartTime = Date.now();

    try {
      logger.debug(`Attempting ${type} navigation`, {
        sessionId: context.sessionId,
        type,
        options,
      });

      let response: HTTPResponse | null = null;

      // Execute the appropriate navigation
      switch (type) {
        case 'goBack':
          response = await page.goBack(options);
          break;
        case 'goForward':
          response = await page.goForward(options);
          break;
        case 'refresh':
          response = await page.reload(options);
          break;
      }

      const duration = Date.now() - attemptStartTime;
      const finalUrl = page.url();

      // Get updated page state
      const title = await this.getPageTitle(page);
      const capability = await this.getHistoryCapability(page);

      logger.info(`${type} navigation completed successfully`, {
        sessionId: context.sessionId,
        contextId: context.contextId,
        type,
        finalUrl,
        statusCode: response?.status(),
        duration,
      });

      return {
        success: true,
        response,
        finalUrl,
        title,
        duration,
        capability,
      };

    } catch (error) {
      const duration = Date.now() - attemptStartTime;
      const navigationError = error instanceof Error ? error : new Error(`Unknown ${type} error`);

      logger.warn(`${type} navigation attempt failed`, {
        sessionId: context.sessionId,
        type,
        error: navigationError.message,
        duration,
      });

      return {
        success: false,
        error: navigationError,
        duration,
        finalUrl: page.url(),
      };
    }
  }

  /**
   * Get page title safely
   * @param page - Page instance
   * @returns Page title or empty string
   */
  private async getPageTitle(page: Page): Promise<string> {
    try {
      return await page.title();
    } catch (error) {
      logger.debug('Failed to get page title', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return '';
    }
  }

  /**
   * Get history capability information
   * @param page - Page instance
   * @returns History capability
   */
  async getHistoryCapability(page: Page): Promise<HistoryCapability> {
    try {
      const [canGoBack, canGoForward, historyLength] = await Promise.all([
        this.canGoBack(page),
        this.canGoForward(page),
        this.getHistoryLength(page),
      ]);

      return {
        canGoBack,
        canGoForward,
        historyLength,
      };
    } catch (error) {
      logger.debug('Failed to get history capability', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        canGoBack: false,
        canGoForward: false,
        historyLength: 1,
      };
    }
  }

  /**
   * Check if page can go back
   * @param page - Page instance
   * @returns True if can go back
   */
  private async canGoBack(page: Page): Promise<boolean> {
    try {
      return await page.evaluate(() => {
        try {
          return window.history.length > 1;
        } catch {
          return false;
        }
      });
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
      // Note: Detecting forward capability is limited in modern browsers
      // This is a best-effort attempt
      return await page.evaluate(() => {
        try {
          // This is a simplified check - actual forward capability
          // is harder to determine reliably
          const currentLength = window.history.length;
          return currentLength > 1; // Simplified assumption
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  }

  /**
   * Get history length
   * @param page - Page instance
   * @returns History length
   */
  private async getHistoryLength(page: Page): Promise<number> {
    try {
      return await page.evaluate(() => {
        try {
          return window.history.length;
        } catch {
          return 1;
        }
      });
    } catch {
      return 1;
    }
  }

  /**
   * Create success action result
   * @param type - Navigation type
   * @param startTime - Operation start time
   * @param navigationResult - Navigation result
   * @param performanceMetrics - Performance metrics if available
   * @returns Success action result
   */
  private createSuccessResult(
    type: HistoryNavigationType,
    startTime: number,
    navigationResult: HistoryNavigationResult,
    performanceMetrics?: any
  ): ActionResult {
    const duration = Date.now() - startTime;

    const metadata: Record<string, unknown> = {
      finalUrl: navigationResult.finalUrl,
      statusCode: navigationResult.response?.status(),
      historyCapability: navigationResult.capability,
    };

    if (performanceMetrics) {
      metadata.performanceMetrics = performanceMetrics;
    }

    const data: Record<string, unknown> = {
      url: navigationResult.finalUrl,
    };

    // Add type-specific data
    if (type === 'refresh') {
      data.title = navigationResult.title;
      data.statusCode = navigationResult.response?.status();
    } else {
      data.canGoBack = navigationResult.capability?.canGoBack ?? false;
      data.canGoForward = navigationResult.capability?.canGoForward ?? false;
    }

    return {
      success: true,
      actionType: type,
      data,
      duration,
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Create failure action result
   * @param type - Navigation type
   * @param startTime - Operation start time
   * @param errorMessage - Error message
   * @param page - Page instance
   * @param performanceMetrics - Performance metrics if available
   * @returns Failure action result
   */
  private createFailureResult(
    type: HistoryNavigationType,
    startTime: number,
    errorMessage: string,
    page: Page,
    performanceMetrics?: any
  ): ActionResult {
    const duration = Date.now() - startTime;

    const metadata: Record<string, unknown> = {
      currentUrl: page.url(),
    };

    if (performanceMetrics) {
      metadata.performanceMetrics = performanceMetrics;
    }

    return {
      success: false,
      actionType: type,
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Update navigator configuration
   * @param config - Configuration to update
   */
  updateConfig(config: Partial<HistoryNavigationConfig>): void {
    if (config.defaultTimeout !== undefined) {
      this.config.defaultTimeout = config.defaultTimeout;
    }
    if (config.defaultWaitUntil !== undefined) {
      this.config.defaultWaitUntil = config.defaultWaitUntil;
    }
    if (config.enablePerformanceMonitoring !== undefined) {
      this.config.enablePerformanceMonitoring = config.enablePerformanceMonitoring;
    }
    if (config.enableHistoryValidation !== undefined) {
      this.config.enableHistoryValidation = config.enableHistoryValidation;
    }

    logger.info('History navigator configuration updated', { config });
  }
}

/**
 * Create history navigator instance
 * @param config - Optional configuration
 * @returns History navigator instance
 */
export function createHistoryNavigator(config?: HistoryNavigationConfig): HistoryNavigator {
  return new HistoryNavigator(config);
}