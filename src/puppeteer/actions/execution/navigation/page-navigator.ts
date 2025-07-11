/**
 * Page navigation strategy for handling page.goto() operations
 * @module puppeteer/actions/execution/navigation/page-navigator
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page, HTTPResponse } from 'puppeteer';
import type {
  NavigateAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import type { NavigationWaitOptions } from '../types.js';
import { DEFAULT_CONFIG } from '../types.js';
import { createLogger } from '../../../../utils/logger.js';
import { UrlValidator, type UrlValidationResult } from './url-validator.js';
import { PerformanceMonitor } from './performance-monitor.js';

const logger = createLogger('puppeteer:navigation:page-navigator');

/**
 * Page navigation configuration
 */
export interface PageNavigationConfig {
  /** URL validator instance */
  urlValidator?: UrlValidator;
  /** Performance monitor instance */
  performanceMonitor?: PerformanceMonitor;
  /** Default navigation timeout */
  defaultTimeout?: number;
  /** Default wait until condition */
  defaultWaitUntil?: NavigationWaitOptions['waitUntil'];
  /** Enable performance monitoring */
  enablePerformanceMonitoring?: boolean;
}

/**
 * Navigation attempt result
 */
interface NavigationAttempt {
  /** Whether navigation succeeded */
  success: boolean;
  /** HTTP response if available */
  response?: HTTPResponse | null;
  /** Error if failed */
  error?: Error;
  /** Final URL after navigation */
  finalUrl?: string;
  /** Page title if available */
  title?: string;
  /** Navigation duration */
  duration: number;
}

/**
 * Page navigator for handling goto operations
 * @nist ac-3 "Access enforcement"
 */
export class PageNavigator {
  private readonly urlValidator: UrlValidator;
  private readonly performanceMonitor?: PerformanceMonitor;
  private readonly config: Required<
    Omit<PageNavigationConfig, 'urlValidator' | 'performanceMonitor'>
  >;

  constructor(config?: PageNavigationConfig) {
    this.urlValidator = config?.urlValidator ?? new UrlValidator();
    this.performanceMonitor = config?.performanceMonitor;

    this.config = {
      defaultTimeout: config?.defaultTimeout ?? DEFAULT_CONFIG.TIMEOUT.navigation,
      defaultWaitUntil: config?.defaultWaitUntil ?? 'load',
      enablePerformanceMonitoring: config?.enablePerformanceMonitoring ?? true,
    };

    logger.debug('Page navigator initialized', {
      defaultTimeout: this.config.defaultTimeout,
      defaultWaitUntil: this.config.defaultWaitUntil,
      enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
    });
  }

  /**
   * Execute navigation to URL
   * @param action - Navigation action
   * @param page - Page instance
   * @param context - Execution context
   * @returns Navigation result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async navigate(
    action: NavigateAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();
    let performanceMetrics: any;

    try {
      logger.debug('Starting page navigation', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url: action.url,
        waitUntil: action.waitUntil,
        timeout: action.timeout,
      });

      // Start performance monitoring
      if (this.config.enablePerformanceMonitoring && this.performanceMonitor) {
        performanceMetrics = await this.performanceMonitor.startNavigation(context.sessionId);
      }

      // Validate URL
      const urlValidation = await this.validateNavigationUrl(action.url);
      if (!urlValidation.isValid) {
        return this.createFailureResult(
          action,
          startTime,
          urlValidation.error ?? 'URL validation failed',
          page,
          performanceMetrics,
        );
      }

      // Prepare navigation options
      const options = this.prepareNavigationOptions(action);

      // Attempt navigation
      const navigationResult = await this.attemptNavigation(
        page,
        urlValidation.normalizedUrl ?? action.url,
        options,
        context,
      );

      // End performance monitoring
      if (
        this.config.enablePerformanceMonitoring &&
        this.performanceMonitor &&
        performanceMetrics
      ) {
        await this.performanceMonitor.endNavigation(
          performanceMetrics.id,
          navigationResult.success,
          navigationResult.finalUrl,
        );
      }

      if (!navigationResult.success) {
        return this.createFailureResult(
          action,
          startTime,
          navigationResult.error?.message ?? 'Navigation failed',
          page,
          performanceMetrics,
        );
      }

      // Create success result
      return await this.createSuccessResult(
        action,
        startTime,
        navigationResult,
        page,
        urlValidation,
        performanceMetrics,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Navigation failed';

      logger.error('Page navigation error', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url: action.url,
        error: errorMessage,
      });

      return this.createFailureResult(action, startTime, errorMessage, page, performanceMetrics);
    }
  }

  /**
   * Validate navigation URL
   * @param url - URL to validate
   * @returns Validation result
   * @nist si-10 "Information input validation"
   */
  private async validateNavigationUrl(url: string): Promise<UrlValidationResult> {
    try {
      return await this.urlValidator.validateUrl(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'URL validation error';

      logger.error('URL validation failed', {
        url,
        error: errorMessage,
      });

      return {
        isValid: false,
        error: `URL validation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Prepare navigation options
   * @param action - Navigation action
   * @returns Navigation options
   */
  private prepareNavigationOptions(action: NavigateAction): NavigationWaitOptions {
    return {
      waitUntil: action.waitUntil ?? this.config.defaultWaitUntil,
      timeout: action.timeout ?? this.config.defaultTimeout,
    };
  }

  /**
   * Attempt page navigation
   * @param page - Page instance
   * @param url - URL to navigate to
   * @param options - Navigation options
   * @param context - Execution context
   * @returns Navigation attempt result
   */
  private async attemptNavigation(
    page: Page,
    url: string,
    options: NavigationWaitOptions,
    context: ActionContext,
  ): Promise<NavigationAttempt> {
    const attemptStartTime = Date.now();

    try {
      logger.debug('Attempting navigation', {
        sessionId: context.sessionId,
        url,
        options,
      });

      const response = await page.goto(url, options);
      const duration = Date.now() - attemptStartTime;
      const finalUrl = page.url();

      // Get page title safely
      const title = await this.getPageTitle(page);

      logger.info('Navigation completed successfully', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url,
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
      };
    } catch (error) {
      const duration = Date.now() - attemptStartTime;
      const navigationError =
        error instanceof Error ? error : new Error('Unknown navigation error');

      logger.warn('Navigation attempt failed', {
        sessionId: context.sessionId,
        url,
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
   * Safely get page title
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
   * Create success action result
   * @param action - Original action
   * @param startTime - Operation start time
   * @param navigationResult - Navigation result
   * @param page - Page instance
   * @param urlValidation - URL validation result
   * @param performanceMetrics - Performance metrics if available
   * @returns Success action result
   */
  private async createSuccessResult(
    action: NavigateAction,
    startTime: number,
    navigationResult: NavigationAttempt,
    page: Page,
    urlValidation: UrlValidationResult,
    performanceMetrics?: any,
  ): Promise<ActionResult> {
    const duration = Date.now() - startTime;

    const metadata: Record<string, unknown> = {
      originalUrl: action.url,
      finalUrl: navigationResult.finalUrl,
      statusCode: navigationResult.response?.status(),
      waitUntil: action.waitUntil ?? this.config.defaultWaitUntil,
      urlValidationWarnings: urlValidation.warnings,
      pageUrl: page.url(),
    };

    if (performanceMetrics) {
      metadata.performanceMetrics = performanceMetrics;
    }

    return {
      success: true,
      actionType: 'navigate',
      data: {
        url: navigationResult.finalUrl,
        statusCode: navigationResult.response?.status(),
        title: navigationResult.title,
      },
      duration,
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Create failure action result
   * @param action - Original action
   * @param startTime - Operation start time
   * @param errorMessage - Error message
   * @param page - Page instance
   * @param performanceMetrics - Performance metrics if available
   * @returns Failure action result
   */
  private createFailureResult(
    action: NavigateAction,
    startTime: number,
    errorMessage: string,
    page: Page,
    performanceMetrics?: any,
  ): ActionResult {
    const duration = Date.now() - startTime;

    const metadata: Record<string, unknown> = {
      url: action.url,
      currentUrl: page.url(),
    };

    if (performanceMetrics) {
      metadata.performanceMetrics = performanceMetrics;
    }

    return {
      success: false,
      actionType: 'navigate',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Check if page can navigate to URL
   * @param url - URL to check
   * @returns True if navigation is possible
   */
  async canNavigate(url: string): Promise<boolean> {
    try {
      const validation = await this.urlValidator.validateUrl(url);
      return validation.isValid;
    } catch {
      return false;
    }
  }

  /**
   * Get navigation capabilities
   * @returns Navigation capabilities
   */
  getCapabilities(): {
    supportedProtocols: string[];
    maxUrlLength: number;
    allowsPrivateNetworks: boolean;
  } {
    const config = this.urlValidator.getConfig();

    return {
      supportedProtocols: config.allowedProtocols,
      maxUrlLength: config.maxLength,
      allowsPrivateNetworks: config.allowPrivateNetworks,
    };
  }

  /**
   * Update navigator configuration
   * @param config - Configuration to update
   */
  updateConfig(config: Partial<PageNavigationConfig>): void {
    if (config.defaultTimeout !== undefined) {
      this.config.defaultTimeout = config.defaultTimeout;
    }
    if (config.defaultWaitUntil !== undefined) {
      this.config.defaultWaitUntil = config.defaultWaitUntil;
    }
    if (config.enablePerformanceMonitoring !== undefined) {
      this.config.enablePerformanceMonitoring = config.enablePerformanceMonitoring;
    }

    logger.info('Page navigator configuration updated', { config });
  }
}

/**
 * Create page navigator instance
 * @param config - Optional configuration
 * @returns Page navigator instance
 */
export function createPageNavigator(config?: PageNavigationConfig): PageNavigator {
  return new PageNavigator(config);
}
