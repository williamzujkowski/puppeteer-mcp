/**
 * Recovery strategy implementations
 * @module core/errors/recovery-strategies
 * @nist si-11 "Error handling"
 */

import { EnhancedAppError } from './enhanced-app-error.js';
import { RecoveryAction } from './error-context.js';
import { RecoveryContext } from './retry-manager.js';

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  canHandle(error: EnhancedAppError): boolean;
  execute(error: EnhancedAppError, context: RecoveryContext): Promise<RecoveryResult>;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean;
  result?: unknown;
  error?: Error;
  strategy: string;
  attempts: number;
  duration: number;
  nextAction?: RecoveryAction;
}

/**
 * Token refresh recovery strategy
 */
export class TokenRefreshRecoveryStrategy implements RecoveryStrategy {
  private tokenRefreshFn: () => Promise<string>;

  constructor(tokenRefreshFn: () => Promise<string>) {
    this.tokenRefreshFn = tokenRefreshFn;
  }

  canHandle(error: EnhancedAppError): boolean {
    return error.getRecoverySuggestions().includes(RecoveryAction.REFRESH_TOKEN);
  }

  async execute(_error: EnhancedAppError, _context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      const newToken = await this.tokenRefreshFn();

      return {
        success: true,
        result: newToken,
        strategy: 'token_refresh',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.RETRY,
      };
    } catch (refreshError) {
      return {
        success: false,
        error: refreshError as Error,
        strategy: 'token_refresh',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.CONTACT_SUPPORT,
      };
    }
  }
}

/**
 * Session restart recovery strategy
 */
export class SessionRestartRecoveryStrategy implements RecoveryStrategy {
  private sessionRestartFn: (sessionId: string) => Promise<void>;

  constructor(sessionRestartFn: (sessionId: string) => Promise<void>) {
    this.sessionRestartFn = sessionRestartFn;
  }

  canHandle(error: EnhancedAppError): boolean {
    return error.getRecoverySuggestions().includes(RecoveryAction.RESTART_SESSION);
  }

  async execute(_error: EnhancedAppError, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();

    if (context.sessionId === undefined || context.sessionId === null || context.sessionId === '') {
      return {
        success: false,
        error: new Error('Session ID required for session restart'),
        strategy: 'session_restart',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.CONTACT_SUPPORT,
      };
    }

    try {
      await this.sessionRestartFn(context.sessionId);

      return {
        success: true,
        strategy: 'session_restart',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.RETRY,
      };
    } catch (restartError) {
      return {
        success: false,
        error: restartError as Error,
        strategy: 'session_restart',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.CONTACT_SUPPORT,
      };
    }
  }
}

/**
 * Cache clear recovery strategy
 */
export class CacheClearRecoveryStrategy implements RecoveryStrategy {
  private cacheClearFn: (key?: string) => Promise<void>;

  constructor(cacheClearFn: (key?: string) => Promise<void>) {
    this.cacheClearFn = cacheClearFn;
  }

  canHandle(error: EnhancedAppError): boolean {
    return error.getRecoverySuggestions().includes(RecoveryAction.CLEAR_CACHE);
  }

  async execute(_error: EnhancedAppError, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      const cacheKey = context.resource ?? context.operation;
      await this.cacheClearFn(cacheKey);

      return {
        success: true,
        strategy: 'cache_clear',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.RETRY,
      };
    } catch (clearError) {
      return {
        success: false,
        error: clearError as Error,
        strategy: 'cache_clear',
        attempts: 1,
        duration: Date.now() - startTime,
        nextAction: RecoveryAction.CONTACT_SUPPORT,
      };
    }
  }
}
