/**
 * Error recovery strategies for action execution
 * @module puppeteer/actions/execution/error/error-recovery
 * @nist cp-10 "Information system recovery and reconstitution"
 * @nist si-11 "Error handling"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import { ActionExecutionError, type ActionExecutionErrorDetails } from '../types.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:error-recovery');

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  canRecover(error: ActionExecutionErrorDetails): boolean;
  recover(page: Page, action: BrowserAction, context: ActionContext): Promise<boolean>;
}

/**
 * Base recovery strategy
 * @nist cp-10 "Information system recovery and reconstitution"
 */
export abstract class BaseRecoveryStrategy implements RecoveryStrategy {
  protected readonly maxRecoveryAttempts = 3;
  protected recoveryAttempts = new Map<string, number>();

  abstract canRecover(error: ActionExecutionErrorDetails): boolean;
  abstract recover(page: Page, action: BrowserAction, context: ActionContext): Promise<boolean>;

  /**
   * Track recovery attempts
   */
  protected trackAttempt(key: string): boolean {
    const attempts = (this.recoveryAttempts.get(key) ?? 0) + 1;
    this.recoveryAttempts.set(key, attempts);

    if (attempts > this.maxRecoveryAttempts) {
      logger.warn('Max recovery attempts exceeded', { key, attempts });
      return false;
    }

    return true;
  }

  /**
   * Reset recovery attempts
   */
  reset(key?: string): void {
    if (key) {
      this.recoveryAttempts.delete(key);
    } else {
      this.recoveryAttempts.clear();
    }
  }
}

/**
 * Recovery strategy for element not found errors
 */
export class ElementNotFoundRecovery extends BaseRecoveryStrategy {
  canRecover(error: ActionExecutionErrorDetails): boolean {
    return error.type === ActionExecutionError.ELEMENT_NOT_FOUND;
  }

  async recover(page: Page, action: BrowserAction, context: ActionContext): Promise<boolean> {
    const key = `${context.sessionId}:${action.type}:element`;

    if (!this.trackAttempt(key)) {
      return false;
    }

    try {
      logger.info('Attempting element recovery', {
        sessionId: context.sessionId,
        actionType: action.type,
      });

      // Wait for any pending navigation
      await page.waitForLoadState?.('domcontentloaded', { timeout: 5000 }).catch(() => {
        // Ignore timeout, page might already be loaded
      });

      // Scroll to top to ensure element visibility
      await page.evaluate(() => window.scrollTo(0, 0));

      // Wait a bit for dynamic content
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1000);
      });

      return true;
    } catch (error) {
      logger.error('Element recovery failed', { error });
      return false;
    }
  }
}

/**
 * Recovery strategy for navigation failures
 */
export class NavigationFailureRecovery extends BaseRecoveryStrategy {
  canRecover(error: ActionExecutionErrorDetails): boolean {
    return error.type === ActionExecutionError.NAVIGATION_FAILED;
  }

  async recover(page: Page, _action: BrowserAction, context: ActionContext): Promise<boolean> {
    const key = `${context.sessionId}:navigation`;

    if (!this.trackAttempt(key)) {
      return false;
    }

    try {
      logger.info('Attempting navigation recovery', {
        sessionId: context.sessionId,
        currentUrl: page.url(),
      });

      // Check if page is responsive
      const isResponsive = await page.evaluate(() => true).catch(() => false);

      if (!isResponsive) {
        logger.warn('Page is not responsive');
        return false;
      }

      // Try to stop any pending navigation
      await page
        .evaluate(() => window.stop())
        .catch(() => {
          // Ignore errors
        });

      // Wait for stability
      await page.waitForLoadState?.('networkidle', { timeout: 5000 }).catch(() => {
        // Ignore timeout
      });

      return true;
    } catch (error) {
      logger.error('Navigation recovery failed', { error });
      return false;
    }
  }
}

/**
 * Recovery strategy for timeout errors
 */
export class TimeoutRecovery extends BaseRecoveryStrategy {
  canRecover(error: ActionExecutionErrorDetails): boolean {
    return error.type === ActionExecutionError.TIMEOUT;
  }

  async recover(page: Page, _action: BrowserAction, context: ActionContext): Promise<boolean> {
    const key = `${context.sessionId}:timeout`;

    if (!this.trackAttempt(key)) {
      return false;
    }

    try {
      logger.info('Attempting timeout recovery', {
        sessionId: context.sessionId,
      });

      // Check page responsiveness
      const startTime = Date.now();
      const isResponsive = await page.evaluate(() => true).catch(() => false);
      const responseTime = Date.now() - startTime;

      logger.debug('Page responsiveness check', { isResponsive, responseTime });

      if (!isResponsive || responseTime > 1000) {
        // Page is slow or unresponsive
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {
          // Ignore reload errors
        });
      }

      return true;
    } catch (error) {
      logger.error('Timeout recovery failed', { error });
      return false;
    }
  }
}

/**
 * Chain of responsibility for error recovery
 */
export class ErrorRecoveryChain {
  private readonly strategies: RecoveryStrategy[] = [];

  /**
   * Add recovery strategy to chain
   */
  addStrategy(strategy: RecoveryStrategy): this {
    this.strategies.push(strategy);
    return this;
  }

  /**
   * Attempt to recover from error
   * @param page - Page instance
   * @param action - Action that failed
   * @param context - Execution context
   * @param error - Error details
   * @returns True if recovery was successful
   */
  async attemptRecovery(
    page: Page,
    action: BrowserAction,
    context: ActionContext,
    error: ActionExecutionErrorDetails,
  ): Promise<boolean> {
    for (const strategy of this.strategies) {
      if (strategy.canRecover(error)) {
        logger.info('Attempting recovery strategy', {
          strategy: strategy.constructor.name,
          errorType: error.type,
        });

        const recovered = await strategy.recover(page, action, context);

        if (recovered) {
          logger.info('Recovery successful', {
            strategy: strategy.constructor.name,
          });
          return true;
        }
      }
    }

    logger.warn('No recovery strategy available or all strategies failed', {
      errorType: error.type,
    });

    return false;
  }

  /**
   * Reset all recovery strategies
   */
  reset(): void {
    for (const strategy of this.strategies) {
      if (strategy instanceof BaseRecoveryStrategy) {
        strategy.reset();
      }
    }
  }
}

/**
 * Factory for creating recovery chain
 */
export class RecoveryChainFactory {
  static createDefault(): ErrorRecoveryChain {
    return new ErrorRecoveryChain()
      .addStrategy(new ElementNotFoundRecovery())
      .addStrategy(new NavigationFailureRecovery())
      .addStrategy(new TimeoutRecovery());
  }
}
