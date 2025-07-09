/**
 * Utility functions for error context
 * @module core/errors/error-context-utils
 */

import { ErrorContext, RecoveryAction } from './types.js';

/**
 * Utility functions for error context
 */
export const ErrorContextUtils = {
  /**
   * Create an error context for network errors
   */
  createNetworkErrorContext(message: string, url?: string): ErrorContext {
    return {
      userMessage: message,
      technicalMessage: message,
      errorId: crypto.randomUUID(),
      timestamp: new Date(),
      category: 'network' as const,
      severity: 'medium' as const,
      component: 'network',
      recoverySuggestions: ['check_network' as const, 'retry_with_backoff' as const],
      context: {
        timestamp: new Date(),
        url,
      },
    };
  },

  /**
   * Create an error context for authentication errors
   */
  createAuthErrorContext(message: string, userId?: string): ErrorContext {
    return {
      userMessage: message,
      technicalMessage: message,
      errorId: crypto.randomUUID(),
      timestamp: new Date(),
      category: 'authentication' as const,
      severity: 'high' as const,
      component: 'auth',
      recoverySuggestions: ['refresh_token' as const, 'contact_support' as const],
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
      userMessage: message,
      technicalMessage: message,
      errorId: crypto.randomUUID(),
      timestamp: new Date(),
      category: 'browser' as const,
      severity: 'medium' as const,
      component: 'browser',
      recoverySuggestions: ['retry' as const, 'restart_session' as const],
      context: {
        timestamp: new Date(),
        browserId,
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
      context.userMessage !== undefined &&
      context.technicalMessage !== undefined &&
      context.errorId !== undefined &&
      context.timestamp !== undefined &&
      context.category !== undefined &&
      context.severity !== undefined &&
      context.component !== undefined
    );
  },
};