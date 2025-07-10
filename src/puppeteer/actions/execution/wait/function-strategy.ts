/**
 * Function wait strategy implementation
 * @module puppeteer/actions/execution/wait/function-strategy
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { WaitConditionConfig } from '../types.js';
import type { WaitResult, FunctionValidationResult } from './types.js';
import { BaseWaitStrategy } from './base-strategy.js';
import { DEFAULT_CONFIG } from '../types.js';

/**
 * Security patterns for function validation
 * @nist si-10 "Information input validation"
 */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /eval\s*\(/gi, name: 'eval' },
  { pattern: /Function\s*\(/gi, name: 'Function constructor' },
  { pattern: /setTimeout\s*\(/gi, name: 'setTimeout' },
  { pattern: /setInterval\s*\(/gi, name: 'setInterval' },
  { pattern: /import\s*\(/gi, name: 'dynamic import' },
  { pattern: /require\s*\(/gi, name: 'require' },
  { pattern: /XMLHttpRequest/gi, name: 'XMLHttpRequest' },
  { pattern: /fetch\s*\(/gi, name: 'fetch' },
  { pattern: /process\s*\./gi, name: 'process access' },
  { pattern: /child_process/gi, name: 'child_process' },
  { pattern: /__proto__/gi, name: 'prototype pollution' },
  { pattern: /constructor\s*\[/gi, name: 'constructor access' },
];

/**
 * Maximum allowed function size in bytes
 */
const MAX_FUNCTION_SIZE = 10000;

/**
 * Wait for function strategy
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */
export class FunctionWaitStrategy extends BaseWaitStrategy {
  constructor(private readonly enableSecurityValidation: boolean = true) {
    super('function');
  }

  /**
   * Execute function wait
   */
  protected async executeWait(page: Page, config: WaitConditionConfig): Promise<WaitResult> {
    const startTime = Date.now();
    const timeout = config.duration || DEFAULT_CONFIG.TIMEOUT.element;

    // Security validation
    if (this.enableSecurityValidation) {
      const validation = this.validateFunctionSecurity(config.functionToEvaluate!);
      if (!validation.valid) {
        throw new Error(`Function validation failed: ${validation.error}`);
      }
    }

    await page.waitForFunction(config.functionToEvaluate!, { timeout });

    return {
      success: true,
      condition: 'function_returned_truthy',
      actualDuration: Date.now() - startTime,
      details: {
        functionLength: config.functionToEvaluate!.length,
      },
    };
  }

  /**
   * Validate function configuration
   */
  validate(config: WaitConditionConfig): boolean {
    if (!config.functionToEvaluate) {
      this.logger.error('Function is required for function wait');
      return false;
    }

    if (typeof config.functionToEvaluate !== 'string') {
      this.logger.error('Function must be a string');
      return false;
    }

    if (config.functionToEvaluate.trim().length === 0) {
      this.logger.error('Function cannot be empty');
      return false;
    }

    return true;
  }

  /**
   * Validate function for security risks
   * @nist si-10 "Information input validation"
   */
  validateFunctionSecurity(functionCode: string): FunctionValidationResult {
    // Check length
    if (functionCode.length > MAX_FUNCTION_SIZE) {
      return {
        valid: false,
        error: `Function code exceeds maximum size of ${MAX_FUNCTION_SIZE} bytes`,
      };
    }

    // Check for dangerous patterns
    for (const { pattern, name } of DANGEROUS_PATTERNS) {
      if (pattern.test(functionCode)) {
        return {
          valid: false,
          error: `Function contains potentially dangerous pattern: ${name}`,
          pattern: pattern.source,
        };
      }
    }

    // Check for suspicious Unicode characters
    if (this.containsSuspiciousUnicode(functionCode)) {
      return {
        valid: false,
        error: 'Function contains suspicious Unicode characters',
      };
    }

    return { valid: true };
  }

  /**
   * Check for suspicious Unicode characters that might hide malicious code
   */
  private containsSuspiciousUnicode(code: string): boolean {
    // Check for zero-width characters and other suspicious Unicode
    const suspiciousRanges = [
      /[\u200B-\u200F]/g, // Zero-width characters
      /[\u202A-\u202E]/g, // Directional formatting
      /[\uFEFF]/g,        // Zero-width no-break space
    ];

    return suspiciousRanges.some(pattern => pattern.test(code));
  }

  /**
   * Execute wait for function with arguments
   */
  async executeWaitForFunction(
    functionToEvaluate: string,
    page: Page,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.element,
    args: unknown[] = [],
  ): Promise<WaitResult> {
    const startTime = Date.now();

    // Security validation
    if (this.enableSecurityValidation) {
      const validation = this.validateFunctionSecurity(functionToEvaluate);
      if (!validation.valid) {
        throw new Error(`Function validation failed: ${validation.error}`);
      }
    }

    await page.waitForFunction(functionToEvaluate, { timeout }, ...args);

    return {
      success: true,
      condition: 'function_returned_truthy',
      actualDuration: Date.now() - startTime,
      details: {
        functionLength: functionToEvaluate.length,
        argsCount: args.length,
        hasArgs: args.length > 0,
      },
    };
  }
}