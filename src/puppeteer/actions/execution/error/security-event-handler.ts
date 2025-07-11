/**
 * Security event handling for action execution errors
 * @module puppeteer/actions/execution/error/security-event-handler
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-11 "Error handling"
 */

import type {
  ActionContext,
  ValidationResult,
} from '../../../interfaces/action-executor.interface.js';
import type { ActionExecutionErrorDetails } from '../types.js';
import { logSecurityEvent, SecurityEventType } from '../../../../utils/logger.js';

/**
 * Security event metadata
 */
interface SecurityEventMetadata {
  sessionId: string;
  contextId: string;
  actionType: string;
  duration?: number;
  errorType?: string;
  validationErrors?: Array<{ field: string; message: string }>;
  [key: string]: unknown;
}

/**
 * Security event handler for action execution
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class SecurityEventHandler {
  /**
   * Log validation failure security event
   * @param context - Action execution context
   * @param actionType - Type of action that failed
   * @param validationResult - Validation result details
   * @param metadata - Additional metadata
   */
  async logValidationFailure(
    context: ActionContext,
    actionType: string,
    validationResult: ValidationResult,
    metadata?: Partial<SecurityEventMetadata>,
  ): Promise<void> {
    const errorMessage = validationResult.errors.map((e) => e.message).join('; ');

    await logSecurityEvent(SecurityEventType.VALIDATION_FAILURE, {
      userId: context.userId,
      resource: `action:${actionType}`,
      action: `${actionType}_validation`,
      result: 'failure',
      reason: errorMessage,
      metadata: {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType,
        validationErrors: validationResult.errors,
        validationWarnings: validationResult.warnings,
        ...metadata,
      },
    });
  }

  /**
   * Log execution error security event
   * @param context - Action execution context
   * @param actionType - Type of action that failed
   * @param errorDetails - Error classification details
   * @param metadata - Additional metadata
   */
  async logExecutionError(
    context: ActionContext,
    actionType: string,
    errorDetails: ActionExecutionErrorDetails,
    metadata?: Partial<SecurityEventMetadata>,
  ): Promise<void> {
    await logSecurityEvent(SecurityEventType.COMMAND_EXECUTED, {
      userId: context.userId,
      resource: `action:${actionType}`,
      action: `${actionType}_error`,
      result: 'failure',
      reason: errorDetails.message,
      metadata: {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType,
        errorType: errorDetails.type,
        errorContext: errorDetails.context,
        ...metadata,
      },
    });
  }

  /**
   * Log successful retry security event
   * @param context - Action execution context
   * @param actionType - Type of action
   * @param attempt - Retry attempt number
   * @param metadata - Additional metadata
   */
  async logSuccessfulRetry(
    context: ActionContext,
    actionType: string,
    attempt: number,
    metadata?: Partial<SecurityEventMetadata>,
  ): Promise<void> {
    await logSecurityEvent(SecurityEventType.COMMAND_EXECUTED, {
      userId: context.userId,
      resource: `action:${actionType}`,
      action: `${actionType}_retry_success`,
      result: 'success',
      metadata: {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType,
        retryAttempt: attempt,
        ...metadata,
      },
    });
  }

  /**
   * Log max retries exceeded security event
   * @param context - Action execution context
   * @param actionType - Type of action
   * @param maxRetries - Maximum retry attempts
   * @param lastError - Last error encountered
   */
  async logMaxRetriesExceeded(
    context: ActionContext,
    actionType: string,
    maxRetries: number,
    lastError?: string,
  ): Promise<void> {
    await logSecurityEvent(SecurityEventType.COMMAND_EXECUTED, {
      userId: context.userId,
      resource: `action:${actionType}`,
      action: `${actionType}_max_retries`,
      result: 'failure',
      reason: `Maximum retry attempts (${maxRetries}) exceeded`,
      metadata: {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType,
        maxRetries,
        lastError,
      },
    });
  }

  /**
   * Log suspicious activity security event
   * @param context - Action execution context
   * @param actionType - Type of action
   * @param reason - Reason for suspicion
   * @param details - Additional details
   */
  async logSuspiciousActivity(
    context: ActionContext,
    actionType: string,
    reason: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await logSecurityEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, {
      userId: context.userId,
      resource: `action:${actionType}`,
      action: actionType,
      result: 'failure',
      reason,
      metadata: {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType,
        ...details,
      },
    });
  }

  /**
   * Check if error indicates potential security issue
   * @param error - Error to check
   * @returns True if error may be security-related
   */
  isSecurityRelatedError(error: Error): boolean {
    const securityPatterns = [
      'permission denied',
      'access denied',
      'unauthorized',
      'forbidden',
      'security error',
      'cors',
      'cross-origin',
      'ssl',
      'certificate',
    ];

    const message = error.message.toLowerCase();
    return securityPatterns.some((pattern) => message.includes(pattern));
  }

  /**
   * Analyze error for security implications
   * @param context - Action execution context
   * @param actionType - Type of action
   * @param error - Error to analyze
   */
  async analyzeSecurityImplications(
    context: ActionContext,
    actionType: string,
    error: Error,
  ): Promise<void> {
    if (this.isSecurityRelatedError(error)) {
      await this.logSuspiciousActivity(context, actionType, 'Security-related error detected', {
        errorMessage: error.message,
        errorStack: error.stack,
      });
    }

    // Check for patterns indicating potential attacks
    const attackPatterns = [
      { pattern: /script.*alert/i, type: 'XSS attempt' },
      { pattern: /\.\.[/\\]/g, type: 'Path traversal attempt' },
      { pattern: /union.*select/i, type: 'SQL injection attempt' },
      { pattern: /<iframe|<script|javascript:/i, type: 'Code injection attempt' },
    ];

    const errorString = error.message + (error.stack ?? '');

    for (const { pattern, type } of attackPatterns) {
      if (pattern.test(errorString)) {
        await this.logSuspiciousActivity(context, actionType, type, {
          errorMessage: error.message,
          matchedPattern: pattern.toString(),
        });
      }
    }
  }
}
