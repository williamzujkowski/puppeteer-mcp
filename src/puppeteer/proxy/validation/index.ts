/**
 * Proxy validation main module
 * @module puppeteer/proxy/validation
 * @nist cm-6 "Configuration settings"
 * @nist ia-5 "Authenticator management"
 */

import type { ProxyConfig, ContextProxyConfig } from '../../types/proxy.js';
import { ValidationContext } from './validator-base.js';
import { ProxyValidatorFactory } from './proxy-validators.js';
import { ContextProxyValidatorFactory } from './context-proxy-validators.js';
import {
  ValidationResultBuilder,
  type ProxyValidationResult,
  type ContextProxyValidationResult,
} from './result-builder.js';

// Re-export types and utilities
export type { ProxyValidationResult, ContextProxyValidationResult };
export {
  sanitizeProxyConfigForLogging,
  validateProxyCredentials,
  generateSecureProxyConfig,
} from './utils.js';

/**
 * Validate proxy configuration
 * @nist cm-6 "Configuration settings"
 * @nist ia-5 "Authenticator management"
 */
export async function validateProxyConfig(
  config: unknown,
  options: { checkConnectivity?: boolean } = {},
): Promise<ProxyValidationResult> {
  const context: ValidationContext<ProxyConfig> = {
    config: config as ProxyConfig,
    errors: [],
    warnings: [],
    options,
  };

  const validator = ProxyValidatorFactory.createProxyValidatorChain();

  try {
    await validator.validate(context);
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : 'Validation failed');
  }

  return new ValidationResultBuilder<ProxyConfig>()
    .addErrors(context.errors)
    .addWarnings(context.warnings)
    .setSanitized(context.config)
    .build();
}

/**
 * Validate context proxy configuration
 * @nist cm-6 "Configuration settings"
 */
export async function validateContextProxyConfig(
  config: unknown,
  options: { checkConnectivity?: boolean } = {},
): Promise<ContextProxyValidationResult> {
  const context: ValidationContext<ContextProxyConfig> = {
    config: config as ContextProxyConfig,
    errors: [],
    warnings: [],
    options,
  };

  const validator = ContextProxyValidatorFactory.createContextProxyValidatorChain();

  try {
    await validator.validate(context);
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : 'Validation failed');
  }

  return new ValidationResultBuilder<ContextProxyConfig>()
    .addErrors(context.errors)
    .addWarnings(context.warnings)
    .setSanitized(context.config)
    .build();
}
