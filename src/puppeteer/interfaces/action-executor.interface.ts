/**
 * Action Executor Interface for Puppeteer Integration
 * Handles browser action execution and validation
 */

import type { KeyInput } from 'puppeteer';

/**
 * Base browser action interface
 */
export interface BaseBrowserAction {
  /** Action type identifier */
  type: string;
  
  /** Page ID to execute action on */
  pageId: string;
  
  /** Optional timeout for action */
  timeout?: number;
  
  /** Optional description */
  description?: string;
}

/**
 * Navigation action
 */
export interface NavigateAction extends BaseBrowserAction {
  type: 'navigate';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

/**
 * Click action
 */
export interface ClickAction extends BaseBrowserAction {
  type: 'click';
  selector: string;
  clickCount?: number;
  button?: 'left' | 'right' | 'middle';
  delay?: number;
}

/**
 * Type action
 */
export interface TypeAction extends BaseBrowserAction {
  type: 'type';
  selector: string;
  text: string;
  delay?: number;
  clearFirst?: boolean;
}

/**
 * Select action
 */
export interface SelectAction extends BaseBrowserAction {
  type: 'select';
  selector: string;
  values: string[];
}

/**
 * Keyboard action
 */
export interface KeyboardAction extends BaseBrowserAction {
  type: 'keyboard';
  key: KeyInput;
  action: 'press' | 'down' | 'up';
}

/**
 * Mouse action
 */
export interface MouseAction extends BaseBrowserAction {
  type: 'mouse';
  action: 'move' | 'down' | 'up' | 'wheel';
  x?: number;
  y?: number;
  deltaX?: number;
  deltaY?: number;
  button?: 'left' | 'right' | 'middle';
}

/**
 * Screenshot action
 */
export interface ScreenshotAction extends BaseBrowserAction {
  type: 'screenshot';
  fullPage?: boolean;
  selector?: string;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
}

/**
 * PDF generation action
 */
export interface PDFAction extends BaseBrowserAction {
  type: 'pdf';
  format?: 'letter' | 'legal' | 'tabloid' | 'ledger' | 'a0' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6';
  landscape?: boolean;
  scale?: number;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
  pageRanges?: string;
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

/**
 * Content retrieval action
 */
export interface ContentAction extends BaseBrowserAction {
  type: 'content';
  selector?: string;
}

/**
 * Wait action
 */
export interface WaitAction extends BaseBrowserAction {
  type: 'wait';
  waitType: 'selector' | 'navigation' | 'timeout' | 'function';
  selector?: string;
  duration?: number;
  function?: string;
}

/**
 * Scroll action
 */
export interface ScrollAction extends BaseBrowserAction {
  type: 'scroll';
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  selector?: string;
  toElement?: boolean;
  x?: number;
  y?: number;
  smooth?: boolean;
  duration?: number;
}

/**
 * Evaluate action
 */
export interface EvaluateAction extends BaseBrowserAction {
  type: 'evaluate';
  function: string;
  args?: unknown[];
}

/**
 * Upload file action
 */
export interface UploadAction extends BaseBrowserAction {
  type: 'upload';
  selector: string;
  filePaths: string[];
}

/**
 * Cookie action
 */
export interface CookieAction extends BaseBrowserAction {
  type: 'cookie';
  operation: 'set' | 'get' | 'delete' | 'clear';
  cookies?: Array<{
    name: string;
    value?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
}

/**
 * Union type of all browser actions
 */
export type BrowserAction =
  | NavigateAction
  | ClickAction
  | TypeAction
  | SelectAction
  | KeyboardAction
  | MouseAction
  | ScreenshotAction
  | PDFAction
  | ContentAction
  | WaitAction
  | ScrollAction
  | EvaluateAction
  | UploadAction
  | CookieAction;

/**
 * Action result interface
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
}

/**
 * Action executor interface for browser automation
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
  execute<T = unknown>(
    action: BrowserAction,
    context: ActionContext
  ): Promise<ActionResult<T>>;
  
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
    options?: {
      stopOnError?: boolean;
      parallel?: boolean;
      maxConcurrency?: number;
    }
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
  validateBatch(
    actions: BrowserAction[],
    context: ActionContext
  ): Promise<ValidationResult[]>;
  
  /**
   * Register custom action handler
   * @param actionType - Action type identifier
   * @param handler - Action handler function
   */
  registerHandler<T extends BrowserAction>(
    actionType: string,
    handler: (action: T, context: ActionContext) => Promise<ActionResult>
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
  getHistory(
    context: ActionContext,
    options?: {
      limit?: number;
      offset?: number;
      actionTypes?: string[];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<ActionResult[]>;
  
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
  getMetrics(context: ActionContext): Promise<{
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    averageDuration: number;
    actionTypeBreakdown: Record<string, number>;
  }>;
}