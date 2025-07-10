/**
 * Shared types and interfaces for action execution modules
 * @module puppeteer/actions/execution/types
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
} from '../../interfaces/action-executor.interface.js';

/**
 * Action handler function type
 */
export type ActionHandler = (
  action: BrowserAction,
  page: Page,
  context: ActionContext,
) => Promise<ActionResult>;

/**
 * Action handler registry interface
 */
export interface HandlerRegistry {
  [actionType: string]: ActionHandler;
}

/**
 * Retry configuration for action execution
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in ms */
  baseDelay: number;
  /** Maximum delay between retries in ms */
  maxDelay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
}

/**
 * Execution options for actions
 */
export interface ExecutionOptions {
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Timeout override in ms */
  timeout?: number;
  /** Whether to log detailed execution info */
  verbose?: boolean;
}

/**
 * Navigation wait options
 */
export interface NavigationWaitOptions {
  /** Wait until condition */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  /** Navigation timeout in ms */
  timeout?: number;
}

/**
 * Element interaction options
 */
export interface InteractionOptions {
  /** Click delay in ms */
  delay?: number;
  /** Mouse button to use */
  button?: 'left' | 'right' | 'middle';
  /** Number of clicks */
  clickCount?: number;
  /** Whether to clear input before typing */
  clearFirst?: boolean;
}

/**
 * Wait condition types
 */
export type WaitCondition = 
  | 'selector'
  | 'navigation'
  | 'timeout'
  | 'function'
  | 'element'
  | 'load'
  | 'networkidle';

/**
 * Wait condition configuration
 */
export interface WaitConditionConfig {
  /** Type of wait condition */
  type: WaitCondition;
  /** CSS selector to wait for */
  selector?: string;
  /** Duration to wait in ms */
  duration?: number;
  /** JavaScript function to evaluate */
  functionToEvaluate?: string;
  /** Whether element should be visible */
  visible?: boolean;
  /** Whether element should be hidden */
  hidden?: boolean;
}

/**
 * Screenshot configuration
 */
export interface ScreenshotConfig {
  /** Whether to capture full page */
  fullPage?: boolean;
  /** Element selector to capture */
  selector?: string;
  /** Image quality (0-100) */
  quality?: number;
  /** Image format */
  format?: 'png' | 'jpeg' | 'webp';
  /** Clip area */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * File upload configuration
 */
export interface FileUploadConfig {
  /** Input selector */
  selector: string;
  /** File paths to upload */
  filePaths: string[];
  /** Whether to accept multiple files */
  multiple?: boolean;
}

/**
 * Scroll configuration
 */
export interface ScrollConfig {
  /** Scroll direction */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Scroll distance in pixels */
  distance?: number;
  /** Element selector to scroll to */
  selector?: string;
  /** Specific coordinates */
  x?: number;
  y?: number;
  /** Smooth scrolling */
  smooth?: boolean;
  /** Scroll duration in ms */
  duration?: number;
}

/**
 * JavaScript evaluation configuration
 */
export interface EvaluationConfig {
  /** Function to evaluate */
  functionToEvaluate: string;
  /** Arguments to pass to function */
  args?: unknown[];
  /** Whether to return by value or reference */
  returnByValue?: boolean;
}

/**
 * Cookie operation configuration
 */
export interface CookieConfig {
  /** Operation type */
  operation: 'set' | 'get' | 'delete' | 'clear';
  /** Cookies to set/delete */
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
  /** Cookie names to delete */
  names?: string[];
}

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Duration in ms */
  duration?: number;
  /** Number of retries attempted */
  retries: number;
  /** Whether execution was successful */
  success: boolean;
  /** Error details if failed */
  error?: string;
}

/**
 * Action execution state
 */
export interface ExecutionState {
  /** Current action being executed */
  currentAction?: BrowserAction;
  /** Execution metrics */
  metrics: ExecutionMetrics;
  /** Context information */
  context: ActionContext;
  /** Page instance */
  page?: Page;
}

/**
 * Error types for action execution
 */
export enum ActionExecutionError {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PAGE_NOT_FOUND = 'PAGE_NOT_FOUND',
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  TIMEOUT = 'TIMEOUT',
  NAVIGATION_FAILED = 'NAVIGATION_FAILED',
  INTERACTION_FAILED = 'INTERACTION_FAILED',
  EVALUATION_FAILED = 'EVALUATION_FAILED',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  UNKNOWN_ACTION = 'UNKNOWN_ACTION',
  HANDLER_NOT_FOUND = 'HANDLER_NOT_FOUND',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
}

/**
 * Action execution error details
 */
export interface ActionExecutionErrorDetails {
  /** Error type */
  type: ActionExecutionError;
  /** Error message */
  message: string;
  /** Underlying error */
  cause?: Error;
  /** Action that failed */
  action?: BrowserAction;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Field that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Current value */
  value?: unknown;
  /** Expected value or format */
  expected?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  RETRY: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  } as RetryConfig,
  TIMEOUT: {
    default: 30000,
    navigation: 30000,
    element: 5000,
    evaluation: 5000,
  },
  SCREENSHOT: {
    quality: 90,
    format: 'png' as const,
    fullPage: false,
  },
  INTERACTION: {
    delay: 0,
    button: 'left' as const,
    clickCount: 1,
    clearFirst: true,
  },
} as const;