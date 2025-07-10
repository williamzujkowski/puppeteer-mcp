/**
 * Types and interfaces for evaluation execution modules
 * @module puppeteer/actions/execution/evaluation/types
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';

/**
 * Base configuration for evaluation operations
 * @nist si-10 "Information input validation"
 */
export interface BaseEvaluationConfig {
  /** Timeout for the operation in milliseconds */
  timeout?: number;
  /** Whether to return results by value or reference */
  returnByValue?: boolean;
}

/**
 * Configuration for code evaluation
 */
export interface CodeEvaluationConfig extends BaseEvaluationConfig {
  /** Function code to evaluate */
  functionToEvaluate: string;
  /** Arguments to pass to the function */
  args?: unknown[];
}

/**
 * Configuration for content injection
 */
export interface InjectionConfig extends BaseEvaluationConfig {
  /** Content to inject */
  content: string;
  /** Type of injection */
  type: 'script' | 'css';
}

/**
 * Security validation result
 * @nist sc-18 "Mobile code"
 */
export interface SecurityValidationResult {
  /** Whether the code is considered safe */
  isValid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Detected security issues */
  issues?: SecurityIssue[];
}

/**
 * Security issue details
 */
export interface SecurityIssue {
  /** Type of security issue */
  type: 'dangerous_pattern' | 'syntax_error' | 'size_limit' | 'structure_error';
  /** Issue description */
  message: string;
  /** Pattern or rule that triggered the issue */
  rule?: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Evaluation metrics for monitoring
 */
export interface EvaluationMetrics {
  /** Start time of evaluation */
  startTime: number;
  /** End time of evaluation */
  endTime?: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Size of code being evaluated */
  codeSize: number;
  /** Number of arguments */
  argumentCount: number;
  /** Whether evaluation succeeded */
  success: boolean;
}

/**
 * Abstract base class for evaluation strategies
 * @nist ac-3 "Access enforcement"
 */
export abstract class BaseEvaluationStrategy {
  /**
   * Execute the evaluation strategy
   * @param config - Evaluation configuration
   * @param page - Puppeteer page instance
   * @param context - Action context
   * @returns Promise resolving to action result
   */
  abstract execute(
    config: BaseEvaluationConfig,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult>;

  /**
   * Validate the configuration before execution
   * @param config - Configuration to validate
   * @returns Validation result
   */
  abstract validateConfig(config: BaseEvaluationConfig): SecurityValidationResult;

  /**
   * Get supported evaluation types
   * @returns Array of supported types
   */
  abstract getSupportedTypes(): string[];
}

/**
 * Interface for security validators
 * @nist sc-18 "Mobile code"
 * @nist si-10 "Information input validation"
 */
export interface SecurityValidator {
  /**
   * Validate JavaScript code for security issues
   * @param code - Code to validate
   * @returns Validation result
   */
  validateJavaScript(code: string): SecurityValidationResult;

  /**
   * Validate CSS code for security issues
   * @param css - CSS code to validate
   * @returns Validation result
   */
  validateCSS(css: string): SecurityValidationResult;

  /**
   * Check for dangerous patterns in code
   * @param code - Code to check
   * @param patterns - Patterns to check against
   * @returns Array of detected issues
   */
  checkDangerousPatterns(code: string, patterns: RegExp[]): SecurityIssue[];
}

/**
 * Factory interface for creating evaluation strategies
 */
export interface EvaluationStrategyFactory {
  /**
   * Create appropriate strategy for evaluation type
   * @param type - Type of evaluation
   * @returns Evaluation strategy instance
   */
  createStrategy(type: string): BaseEvaluationStrategy;

  /**
   * Get all supported evaluation types
   * @returns Array of supported types
   */
  getSupportedTypes(): string[];
}

/**
 * Configuration for result handling
 */
export interface ResultConfig {
  /** Whether to include metadata in results */
  includeMetadata?: boolean;
  /** Whether to include timing information */
  includeTiming?: boolean;
  /** Maximum size of serialized result */
  maxResultSize?: number;
}

/**
 * Timeout configuration for different operations
 */
export const EVALUATION_TIMEOUTS = {
  /** Default timeout for evaluations */
  DEFAULT: 5000,
  /** Timeout for simple code evaluation */
  CODE_EVALUATION: 3000,
  /** Timeout for handle operations */
  HANDLE_OPERATION: 5000,
  /** Timeout for script injection */
  SCRIPT_INJECTION: 10000,
  /** Timeout for CSS injection */
  CSS_INJECTION: 5000,
} as const;

/**
 * Size limits for security
 */
export const SIZE_LIMITS = {
  /** Maximum JavaScript code size */
  MAX_JS_SIZE: 50000,
  /** Maximum CSS code size */
  MAX_CSS_SIZE: 100000,
  /** Maximum number of arguments */
  MAX_ARGS: 10,
  /** Maximum argument size */
  MAX_ARG_SIZE: 10000,
} as const;

/**
 * Dangerous patterns for JavaScript validation
 */
export const DANGEROUS_JS_PATTERNS = [
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /setTimeout\s*\(/gi,
  /setInterval\s*\(/gi,
  /import\s*\(/gi,
  /require\s*\(/gi,
  /process\./gi,
  /global\./gi,
  /window\.location\s*=/gi,
  /document\.location\s*=/gi,
  /location\.href\s*=/gi,
  /location\.replace/gi,
  /location\.assign/gi,
  /XMLHttpRequest/gi,
  /fetch\s*\(/gi,
  /__proto__/gi,
  /constructor/gi,
] as const;

/**
 * Dangerous patterns for CSS validation
 */
export const DANGEROUS_CSS_PATTERNS = [
  /javascript:/gi,
  /expression\s*\(/gi,
  /behavior\s*:/gi,
  /binding\s*:/gi,
  /-moz-binding/gi,
  /eval\s*\(/gi,
  /data:.*script/gi,
] as const;