/**
 * Utility functions for error context
 * @module core/errors/error-context-utils
 */

import { ErrorContext, RecoveryAction, ErrorCategory, ErrorSeverity } from './error-context.js';

/**
 * Utility functions for error context
 */
export const ErrorContextUtils = {
  /**
   * Create an error context for network errors
   */
  createNetworkErrorContext(message: string, url?: string): ErrorContext {
    return {
      errorCode: 'NETWORK_ERROR',
      userMessage: message,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      recoverySuggestions: [RecoveryAction.CHECK_NETWORK, RecoveryAction.RETRY_WITH_BACKOFF],
      context: {
        timestamp: new Date(),
        resource: url,
      },
    };
  },

  /**
   * Create an error context for authentication errors
   */
  createAuthErrorContext(message: string, userId?: string): ErrorContext {
    return {
      errorCode: 'AUTH_ERROR',
      userMessage: message,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      recoverySuggestions: [RecoveryAction.REFRESH_TOKEN, RecoveryAction.CONTACT_SUPPORT],
      context: {
        timestamp: new Date(),
        userId,
      },
    };
  },

  /**
   * Create an error context for browser errors
   */
  createBrowserErrorContext(message: string, browserId?: string): ErrorContext {
    return {
      errorCode: 'BROWSER_ERROR',
      userMessage: message,
      category: ErrorCategory.BROWSER,
      severity: ErrorSeverity.MEDIUM,
      recoverySuggestions: [RecoveryAction.RETRY, RecoveryAction.RESTART_SESSION],
      context: {
        timestamp: new Date(),
        resource: browserId,
      },
    };
  },

  /**
   * Get formatted user message with recovery suggestions
   */
  getFormattedUserMessage(context: ErrorContext): string {
    let message = context.userMessage;
    
    if (context.recoverySuggestions !== undefined && context.recoverySuggestions.length > 0) {
      const suggestions = context.recoverySuggestions
        .filter(action => action !== RecoveryAction.NONE)
        .map(action => this.getRecoveryActionDescription(action))
        .join(', ');
      
      if (suggestions) {
        message += ` Suggested actions: ${suggestions}`;
      }
    }
    
    return message;
  },

  /**
   * Get human-readable description for recovery action
   */
  getRecoveryActionDescription(action: RecoveryAction): string {
    const descriptions: Record<RecoveryAction, string> = {
      [RecoveryAction.RETRY]: 'try again',
      [RecoveryAction.RETRY_WITH_BACKOFF]: 'retry with delay',
      [RecoveryAction.REFRESH_TOKEN]: 'refresh authentication',
      [RecoveryAction.CONTACT_SUPPORT]: 'contact support',
      [RecoveryAction.CHECK_PERMISSIONS]: 'check permissions',
      [RecoveryAction.VALIDATE_INPUT]: 'validate input',
      [RecoveryAction.RESTART_SESSION]: 'restart session',
      [RecoveryAction.WAIT_AND_RETRY]: 'wait and retry',
      [RecoveryAction.UPGRADE_PLAN]: 'upgrade plan',
      [RecoveryAction.CHECK_CONFIGURATION]: 'check configuration',
      [RecoveryAction.CLEAR_CACHE]: 'clear cache',
      [RecoveryAction.RELOAD_PAGE]: 'reload page',
      [RecoveryAction.CHECK_NETWORK]: 'check network connection',
      [RecoveryAction.REDUCE_LOAD]: 'reduce load',
      [RecoveryAction.NONE]: 'no action available',
      [RecoveryAction.CHECK_RESOURCE]: 'check resource',
      [RecoveryAction.LOGIN_AGAIN]: 'login again',
      [RecoveryAction.FIX_INPUT]: 'fix input',
      [RecoveryAction.UPDATE_CONFIG]: 'update configuration',
    };

    // eslint-disable-next-line security/detect-object-injection
    return descriptions[action] ?? 'unknown action';
  },

  /**
   * Merge error contexts
   */
  merge(base: ErrorContext, override: Partial<ErrorContext>): ErrorContext {
    return {
      ...base,
      ...override,
      context: {
        timestamp: new Date(),
        ...base.context,
        ...override.context,
      },
      recoverySuggestions: override.recoverySuggestions ?? base.recoverySuggestions,
      tags: {
        ...base.tags,
        ...override.tags,
      },
    };
  },

  /**
   * Check if error context is complete
   */
  isComplete(context: Partial<ErrorContext>): context is ErrorContext {
    return (
      context.errorCode !== undefined &&
      context.userMessage !== undefined &&
      context.category !== undefined &&
      context.severity !== undefined &&
      context.recoverySuggestions !== undefined
    );
  },
};