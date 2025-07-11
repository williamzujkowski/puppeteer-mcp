/**
 * Wait executor types and interfaces
 * @module puppeteer/actions/execution/wait/types
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../../interfaces/action-executor.interface.js';
import type { WaitCondition, WaitConditionConfig } from '../types.js';

/**
 * Wait strategy interface
 * @nist ac-3 "Access enforcement"
 */
export interface WaitStrategy {
  /**
   * Execute the wait strategy
   * @param page - Page instance
   * @param config - Wait configuration
   * @param context - Execution context
   * @returns Action result
   */
  execute(page: Page, config: WaitConditionConfig, context: ActionContext): Promise<ActionResult>;

  /**
   * Validate the configuration for this strategy
   * @param config - Wait configuration
   * @returns Validation result
   */
  validate(config: WaitConditionConfig): boolean;

  /**
   * Get the wait type this strategy handles
   * @returns Wait condition type
   */
  getType(): WaitCondition;
}

/**
 * Wait result interface
 */
export interface WaitResult {
  success: boolean;
  condition: string;
  actualDuration: number;
  details?: Record<string, unknown>;
}

/**
 * Wait executor configuration
 */
export interface WaitExecutorConfig {
  /** Default timeout in milliseconds */
  defaultTimeout: number;
  /** Enable debug logging */
  debug: boolean;
  /** Security validation enabled */
  securityValidation: boolean;
}

/**
 * Function validation result
 */
export interface FunctionValidationResult {
  valid: boolean;
  error?: string;
  pattern?: string;
}
