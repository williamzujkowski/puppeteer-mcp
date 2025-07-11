/**
 * Validation result builder
 * @module puppeteer/proxy/validation/result-builder
 * @nist cm-6 "Configuration settings"
 */

import type { ProxyConfig, ContextProxyConfig } from '../../types/proxy.js';

/**
 * Proxy validation result
 * @nist cm-6 "Configuration settings"
 */
export interface ProxyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: ProxyConfig;
}

/**
 * Context proxy validation result
 */
export interface ContextProxyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: ContextProxyConfig;
}

/**
 * Result builder for validation results
 */
export class ValidationResultBuilder<T> {
  private errors: string[] = [];
  private warnings: string[] = [];
  private sanitized?: T;

  addErrors(errors: string[]): this {
    this.errors.push(...errors);
    return this;
  }

  addWarnings(warnings: string[]): this {
    this.warnings.push(...warnings);
    return this;
  }

  setSanitized(config: T): this {
    this.sanitized = config;
    return this;
  }

  build(): T extends ProxyConfig ? ProxyValidationResult : ContextProxyValidationResult {
    const result = {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      sanitized: this.errors.length === 0 ? this.sanitized : undefined,
    };

    return result as T extends ProxyConfig ? ProxyValidationResult : ContextProxyValidationResult;
  }
}
