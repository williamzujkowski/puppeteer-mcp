/**
 * Action Executor Main Interface
 * @module action-executor/executor
 * @description Main interface for browser action execution
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import type {
  ActionResult,
  ValidationResult,
  ActionContext,
  BatchExecutionOptions,
  HistoryQueryOptions,
  ActionMetrics,
} from './core.interface.js';

import type { BrowserAction } from './types.js';

/**
 * Action executor interface for browser automation
 * @description Core interface for executing and managing browser actions
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export interface ActionExecutor {
  /**
   * Execute a browser action
   * @param action - Browser action to execute
   * @param context - Execution context
   * @returns Action result
   * @nist ac-2 "Account management"
   * @nist au-3 "Content of audit records"
   */
  execute<T = unknown>(action: BrowserAction, context: ActionContext): Promise<ActionResult<T>>;

  /**
   * Execute multiple actions in sequence
   * @param actions - Array of browser actions
   * @param context - Execution context
   * @param options - Execution options
   * @returns Array of action results
   */
  executeBatch(
    actions: BrowserAction[],
    context: ActionContext,
    options?: BatchExecutionOptions,
  ): Promise<ActionResult[]>;

  /**
   * Validate an action before execution
   * @param action - Browser action to validate
   * @param context - Execution context
   * @returns Validation result
   * @nist si-10 "Information input validation"
   */
  validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult>;

  /**
   * Validate multiple actions
   * @param actions - Array of browser actions
   * @param context - Execution context
   * @returns Array of validation results
   */
  validateBatch(actions: BrowserAction[], context: ActionContext): Promise<ValidationResult[]>;

  /**
   * Register custom action handler
   * @param actionType - Action type identifier
   * @param handler - Action handler function
   */
  registerHandler<T extends BrowserAction>(
    actionType: string,
    handler: (action: T, context: ActionContext) => Promise<ActionResult>,
  ): void;

  /**
   * Unregister action handler
   * @param actionType - Action type identifier
   */
  unregisterHandler(actionType: string): void;

  /**
   * Get supported action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[];

  /**
   * Check if action type is supported
   * @param actionType - Action type to check
   * @returns True if supported
   */
  isActionSupported(actionType: string): boolean;

  /**
   * Get action execution history
   * @param context - Execution context
   * @param options - Query options
   * @returns Array of historical action results
   * @nist au-7 "Audit reduction and report generation"
   */
  getHistory(context: ActionContext, options?: HistoryQueryOptions): Promise<ActionResult[]>;

  /**
   * Clear action history
   * @param context - Execution context
   * @param before - Clear history before this date
   * @nist au-4 "Audit storage capacity"
   */
  clearHistory(context: ActionContext, before?: Date): Promise<void>;

  /**
   * Get action metrics
   * @param context - Execution context
   * @returns Action execution metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMetrics(context: ActionContext): Promise<ActionMetrics>;
}