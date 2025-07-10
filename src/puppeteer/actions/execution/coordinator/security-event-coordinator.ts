/**
 * Security event coordination module
 * @module puppeteer/actions/execution/coordinator/security-event-coordinator
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
} from '../../../interfaces/action-executor.interface.js';
import { SecurityEventType } from '../../../../utils/logger.js';
import { SecurityEventLogger } from './security/event-logger.js';
import { SecurityErrorAnalyzer } from './security/error-analyzer.js';

/**
 * Coordinates security event logging for action execution
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 */
export class SecurityEventCoordinator {
  private readonly eventLogger: SecurityEventLogger;
  private readonly errorAnalyzer: SecurityErrorAnalyzer;

  constructor(enableBatching = false) {
    this.eventLogger = new SecurityEventLogger(enableBatching);
    this.errorAnalyzer = new SecurityErrorAnalyzer();
  }

  /**
   * Log action execution start
   * @param action - Browser action
   * @param context - Execution context
   * @nist au-3 "Content of audit records"
   */
  async logExecutionStart(
    action: BrowserAction,
    context: ActionContext,
  ): Promise<void> {
    const metadata = this.eventLogger.createBaseMetadata(action, context);
    
    await this.eventLogger.logEvent(SecurityEventType.COMMAND_EXECUTED, {
      userId: context.userId,
      resource: `page:${action.pageId}`,
      action: `${action.type}_start`,
      result: 'initiated',
      metadata: {
        ...metadata,
        phase: 'start',
      },
    });
  }

  /**
   * Log action execution completion
   * @param action - Browser action
   * @param context - Execution context
   * @param result - Action result
   * @nist au-3 "Content of audit records"
   */
  async logExecutionComplete(
    action: BrowserAction,
    context: ActionContext,
    result: ActionResult,
  ): Promise<void> {
    const metadata = this.eventLogger.createBaseMetadata(action, context);
    
    await this.eventLogger.logEvent(SecurityEventType.COMMAND_EXECUTED, {
      userId: context.userId,
      resource: `page:${action.pageId}`,
      action: `${action.type}_complete`,
      result: result.success ? 'success' : 'failure',
      metadata: {
        ...metadata,
        phase: 'complete',
        duration: result.duration,
        success: result.success,
        error: result.error,
      },
    });
  }

  /**
   * Log validation failure
   * @param action - Browser action
   * @param context - Execution context
   * @param validationResult - Validation result
   * @nist si-10 "Information input validation"
   */
  async logValidationFailure(
    action: BrowserAction,
    context: ActionContext,
    validationResult: ValidationResult,
  ): Promise<void> {
    const metadata = this.eventLogger.createBaseMetadata(action, context);
    
    await this.eventLogger.logEvent(SecurityEventType.VALIDATION_FAILURE, {
      userId: context.userId,
      resource: `page:${action.pageId}`,
      action: action.type,
      result: 'failure',
      reason: 'Validation failed',
      metadata: {
        ...metadata,
        phase: 'validation',
        errors: validationResult.errors,
      },
    });
  }

  /**
   * Log page not found error
   * @param action - Browser action
   * @param context - Execution context
   * @nist au-14 "Session audit"
   */
  async logPageNotFound(
    action: BrowserAction,
    context: ActionContext,
  ): Promise<void> {
    const metadata = this.eventLogger.createBaseMetadata(action, context);
    
    await this.eventLogger.logEvent(SecurityEventType.ACCESS_DENIED, {
      userId: context.userId,
      resource: `page:${action.pageId}`,
      action: action.type,
      result: 'failure',
      reason: 'Page not found',
      metadata: {
        ...metadata,
        phase: 'page_setup',
        errorType: 'PAGE_NOT_FOUND',
      },
    });
  }

  /**
   * Log execution error
   * @param action - Browser action
   * @param context - Execution context
   * @param error - Error instance
   * @nist si-4 "Information system monitoring"
   */
  async logExecutionError(
    action: BrowserAction,
    context: ActionContext,
    error: unknown,
  ): Promise<void> {
    const metadata = this.eventLogger.createBaseMetadata(action, context);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorType = this.errorAnalyzer.classifyError(error);
    const severity = this.errorAnalyzer.getErrorSeverity(error);
    
    await this.eventLogger.logEvent(SecurityEventType.COMMAND_EXECUTED, {
      userId: context.userId,
      resource: `page:${action.pageId}`,
      action: `${action.type}_error`,
      result: 'failure',
      reason: errorMessage,
      metadata: {
        ...metadata,
        phase: 'execution',
        errorType,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        severity,
      },
    });

    // Log additional security event for suspicious errors
    if (this.errorAnalyzer.isSuspiciousError(error)) {
      await this.logSuspiciousActivity(action, context, error);
    }
  }

  /**
   * Log suspicious activity
   * @param action - Browser action
   * @param context - Execution context
   * @param error - Error instance
   * @nist si-4 "Information system monitoring"
   */
  private async logSuspiciousActivity(
    action: BrowserAction,
    context: ActionContext,
    error: unknown,
  ): Promise<void> {
    const metadata = this.eventLogger.createBaseMetadata(action, context);
    const sanitizedPayload = this.errorAnalyzer.sanitizeActionPayload(action);
    
    await this.eventLogger.logEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, {
      userId: context.userId,
      resource: `page:${action.pageId}`,
      action: action.type,
      result: 'detected',
      reason: 'Suspicious error pattern detected',
      metadata: {
        ...metadata,
        errorPattern: this.errorAnalyzer.classifyError(error),
        actionPayload: sanitizedPayload,
        severity: 'critical',
      },
    });
  }

  /**
   * Get coordinator statistics
   * @returns Coordinator stats
   */
  getStats(): {
    eventLogger: ReturnType<SecurityEventLogger['getQueueStats']>;
    errorPatterns: {
      suspiciousPatternCount: number;
      errorClassificationCount: number;
    };
  } {
    return {
      eventLogger: this.eventLogger.getQueueStats(),
      errorPatterns: {
        suspiciousPatternCount: 12, // From analyzer default patterns
        errorClassificationCount: 6, // From analyzer default classifications
      },
    };
  }

  /**
   * Stop background processes
   */
  stop(): void {
    this.eventLogger.stop();
  }

  /**
   * Get internal components for testing
   * @internal
   */
  getInternalComponents(): {
    eventLogger: SecurityEventLogger;
    errorAnalyzer: SecurityErrorAnalyzer;
  } {
    return {
      eventLogger: this.eventLogger,
      errorAnalyzer: this.errorAnalyzer,
    };
  }
}