/**
 * Core Action Executor Types and Base Interfaces
 * @module action-executor/core
 * @description Base types and interfaces for browser action execution
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

/**
 * Base browser action interface
 * @description Foundation interface for all browser actions
 */
export interface BaseBrowserAction {
  /** Action type identifier */
  type: string;

  /** Page ID to execute action on */
  pageId: string;

  /** Optional timeout for action in milliseconds */
  timeout?: number;

  /** Optional description for logging and auditing */
  description?: string;
}

/**
 * Action result interface
 * @description Standardized result format for all action executions
 * @nist au-3 "Content of audit records"
 */
export interface ActionResult<T = unknown> {
  /** Action execution success */
  success: boolean;

  /** Action type that was executed */
  actionType: string;

  /** Result data */
  data?: T;

  /** Error message if failed */
  error?: string;

  /** Execution duration in ms */
  duration: number;

  /** Timestamp of execution */
  timestamp: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Validation result interface
 * @description Result of action validation
 * @nist si-10 "Information input validation"
 */
export interface ValidationResult {
  /** Validation success */
  valid: boolean;

  /** Validation errors */
  errors: Array<{
    field: string;
    message: string;
    code?: string;
  }>;

  /** Validation warnings */
  warnings?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

/**
 * Action execution context
 * @description Context information for action execution
 * @nist ac-2 "Account management"
 */
export interface ActionContext {
  /** Session ID */
  sessionId: string;

  /** Context ID */
  contextId: string;

  /** User ID */
  userId?: string;

  /** Execution metadata */
  metadata?: Record<string, unknown>;

  /** Whether the context is in restricted mode */
  restrictedMode?: boolean;

  /** Whether evaluation is allowed in the context */
  allowEvaluation?: boolean;

  /** Timestamp of the context creation or last update */
  timestamp?: string | number;

  /** Permissions granted to the context */
  permissions?: string[];

  /** Allowed domains for navigation */
  allowedDomains?: string[];

  /** Whether authentication is required */
  requiresAuth?: boolean;
}

/**
 * Batch execution options
 * @description Options for executing multiple actions
 */
export interface BatchExecutionOptions {
  /** Stop execution on first error */
  stopOnError?: boolean;

  /** Execute actions in parallel */
  parallel?: boolean;

  /** Maximum concurrent executions */
  maxConcurrency?: number;
}

/**
 * History query options
 * @description Options for querying action history
 * @nist au-7 "Audit reduction and report generation"
 */
export interface HistoryQueryOptions {
  /** Maximum number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Filter by action types */
  actionTypes?: string[];

  /** Filter by start date */
  startDate?: Date;

  /** Filter by end date */
  endDate?: Date;
}

/**
 * Action metrics
 * @description Metrics for action execution analysis
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export interface ActionMetrics {
  /** Total number of actions executed */
  totalActions: number;

  /** Number of successful actions */
  successfulActions: number;

  /** Number of failed actions */
  failedActions: number;

  /** Average execution duration in ms */
  averageDuration: number;

  /** Breakdown by action type */
  actionTypeBreakdown: Record<string, number>;
}
