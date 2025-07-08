/**
 * Helper functions for action execution
 * @module puppeteer/actions/execution-helper
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
} from '../interfaces/action-executor.interface.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';

/**
 * Handle validation failure
 * @nist si-10 "Information input validation"
 */
export async function handleValidationFailure<T>(
  action: BrowserAction,
  context: ActionContext,
  validationResult: ValidationResult,
  duration: number,
): Promise<ActionResult<T>> {
  const error = `Validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;

  await logSecurityEvent(SecurityEventType.VALIDATION_FAILURE, {
    userId: context.userId,
    resource: `page:${action.pageId}`,
    action: action.type,
    result: 'failure',
    reason: error,
    metadata: {
      sessionId: context.sessionId,
      contextId: context.contextId,
      errors: validationResult.errors,
    },
  });

  return {
    success: false,
    actionType: action.type,
    error,
    duration,
    timestamp: new Date(),
  };
}

/**
 * Handle execution error
 * @nist au-3 "Content of audit records"
 */
export async function handleExecutionError<T>(
  action: BrowserAction,
  context: ActionContext,
  error: unknown,
  duration: number,
): Promise<ActionResult<T>> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown action execution error';

  await logSecurityEvent(SecurityEventType.ERROR, {
    userId: context.userId,
    resource: `page:${action.pageId}`,
    action: action.type,
    result: 'failure',
    reason: errorMessage,
    metadata: {
      sessionId: context.sessionId,
      contextId: context.contextId,
    },
  });

  return {
    success: false,
    actionType: action.type,
    error: errorMessage,
    duration,
    timestamp: new Date(),
  };
}

/**
 * Create page not found result
 */
export function createPageNotFoundResult<T>(
  action: BrowserAction,
  duration: number,
): ActionResult<T> {
  return {
    success: false,
    actionType: action.type,
    error: `Page not found: ${action.pageId}`,
    duration,
    timestamp: new Date(),
  };
}
