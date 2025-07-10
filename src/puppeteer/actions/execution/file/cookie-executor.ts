/**
 * Cookie operations executor
 * @module puppeteer/actions/execution/file/cookie-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  ActionResult,
  ActionContext,
  CookieAction,
} from '../../../interfaces/action-executor.interface.js';
import type { FileOperationExecutor } from './file-executor-types.js';
import type { CookieConfig } from '../types.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:cookie-executor');

/**
 * Cookie operation executor
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */
export class CookieExecutor implements FileOperationExecutor {
  /**
   * Get supported action type
   * @returns Action type identifier
   */
  getSupportedType(): string {
    return 'cookie';
  }

  /**
   * Execute cookie operations
   * @param action - Cookie action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
    action: CookieAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing cookie action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        operation: action.operation,
        cookieCount: action.cookies?.length ?? 0,
      });

      const config: CookieConfig = {
        operation: action.operation,
        cookies: action.cookies,
      };

      // Validate operation
      this.validateOperation(config);

      // Execute operation
      const result = await this.executeOperation(page, config);

      const duration = Date.now() - startTime;

      logger.info('Cookie action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        operation: config.operation,
        duration,
      });

      return {
        success: true,
        actionType: 'cookie',
        data: {
          operation: config.operation,
          result,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          cookieCount: config.cookies?.length ?? 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Cookie action failed';

      logger.error('Cookie action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        operation: action.operation,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'cookie',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          operation: action.operation,
          cookieCount: action.cookies?.length ?? 0,
        },
      };
    }
  }

  /**
   * Validate cookie operation
   * @param config - Cookie configuration
   * @nist si-10 "Information input validation"
   */
  private validateOperation(config: CookieConfig): void {
    const validOperations = ['set', 'get', 'delete', 'clear'];
    if (!validOperations.includes(config.operation)) {
      throw new Error(`Invalid cookie operation: ${config.operation}`);
    }

    switch (config.operation) {
      case 'set':
        if (!config.cookies || config.cookies.length === 0) {
          throw new Error('Cookies are required for set operation');
        }
        this.validateCookies(config.cookies);
        break;

      case 'delete':
        if (!config.cookies || config.cookies.length === 0) {
          throw new Error('Cookies are required for delete operation');
        }
        break;

      case 'get':
      case 'clear':
        // No additional validation needed
        break;
    }
  }

  /**
   * Validate cookie data
   * @param cookies - Cookies to validate
   * @nist si-10 "Information input validation"
   */
  private validateCookies(cookies: CookieConfig['cookies']): void {
    if (!cookies) return;

    for (const cookie of cookies) {
      this.validateCookieName(cookie);
      this.validateSameSite(cookie);
      this.validateExpires(cookie);
      this.checkSecurityWarnings(cookie);
    }
  }

  /**
   * Validate cookie name
   * @param cookie - Cookie to validate
   */
  private validateCookieName(cookie: NonNullable<CookieConfig['cookies']>[0]): void {
    if (!cookie.name || typeof cookie.name !== 'string') {
      throw new Error('Cookie name is required and must be a string');
    }
  }

  /**
   * Validate sameSite attribute
   * @param cookie - Cookie to validate
   */
  private validateSameSite(cookie: NonNullable<CookieConfig['cookies']>[0]): void {
    if (cookie.sameSite && !['Strict', 'Lax', 'None'].includes(cookie.sameSite)) {
      throw new Error(`Invalid sameSite value: ${cookie.sameSite}`);
    }
  }

  /**
   * Validate expires attribute
   * @param cookie - Cookie to validate
   */
  private validateExpires(cookie: NonNullable<CookieConfig['cookies']>[0]): void {
    const expires = cookie.expires;
    if (expires !== undefined && (typeof expires !== 'number' || expires < 0)) {
      throw new Error('Cookie expires must be a positive number');
    }
  }

  /**
   * Check for security warnings
   * @param cookie - Cookie to check
   */
  private checkSecurityWarnings(cookie: NonNullable<CookieConfig['cookies']>[0]): void {
    const secure = cookie.secure;
    if (cookie.sameSite === 'None' && secure !== true) {
      logger.warn('Cookie with sameSite=None should be secure', { 
        name: cookie.name 
      });
    }
  }

  /**
   * Execute cookie operation
   * @param page - Page instance
   * @param config - Cookie configuration
   * @returns Operation result
   */
  private async executeOperation(
    page: Page,
    config: CookieConfig,
  ): Promise<unknown> {
    switch (config.operation) {
      case 'set':
        if (!config.cookies) {
          throw new Error('Cookies required for set operation');
        }
        return this.setCookies(page, config.cookies);

      case 'get':
        return this.getCookies(page);

      case 'delete':
        if (!config.cookies) {
          throw new Error('Cookies required for delete operation');
        }
        return this.deleteCookies(page, config.cookies);

      case 'clear':
        return this.clearCookies(page);

      default:
        throw new Error(`Unsupported cookie operation: ${String(config.operation)}`);
    }
  }

  /**
   * Set cookies
   * @param page - Page instance
   * @param cookies - Cookies to set
   * @returns Number of cookies set
   */
  private async setCookies(
    page: Page,
    cookies: NonNullable<CookieConfig['cookies']>,
  ): Promise<{ set: number }> {
    const cookiesToSet = cookies.map(cookie => ({
      ...cookie,
      url: page.url(), // Ensure cookies are set for current page
    })) as any[];

    await page.setCookie(...cookiesToSet);

    logger.debug('Cookies set', { 
      count: cookies.length,
      url: page.url(),
    });

    return { set: cookies.length };
  }

  /**
   * Get all cookies
   * @param page - Page instance
   * @returns Array of cookies
   */
  private async getCookies(page: Page): Promise<any[]> {
    const cookies = await page.cookies();
    
    logger.debug('Cookies retrieved', { 
      count: cookies.length,
      url: page.url(),
    });

    return cookies;
  }

  /**
   * Delete specific cookies
   * @param page - Page instance
   * @param cookies - Cookies to delete
   * @returns Number of cookies deleted
   */
  private async deleteCookies(
    page: Page,
    cookies: NonNullable<CookieConfig['cookies']>,
  ): Promise<{ deleted: number }> {
    await page.deleteCookie(...cookies);

    logger.debug('Cookies deleted', { 
      count: cookies.length,
      url: page.url(),
    });

    return { deleted: cookies.length };
  }

  /**
   * Clear all cookies
   * @param page - Page instance
   * @returns Number of cookies cleared
   */
  private async clearCookies(page: Page): Promise<{ cleared: number }> {
    const allCookies = await page.cookies();
    
    if (allCookies.length > 0) {
      await page.deleteCookie(...allCookies);
    }

    logger.debug('All cookies cleared', { 
      count: allCookies.length,
      url: page.url(),
    });

    return { cleared: allCookies.length };
  }
}