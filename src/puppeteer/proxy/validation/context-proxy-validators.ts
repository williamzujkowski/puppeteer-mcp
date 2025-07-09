/**
 * Context proxy-specific validators
 * @module puppeteer/proxy/validation/context-proxy-validators
 * @nist cm-6 "Configuration settings"
 */

import type { ContextProxyConfig } from '../../types/proxy.js';
import { contextProxyConfigSchema } from '../../types/proxy.js';
import { BaseValidator, type ValidationContext } from './validator-base.js';
import { SchemaValidator } from './proxy-validators.js';
import { validateProxyConfig } from './index.js';

/**
 * Context proxy enabled validator
 */
export class ContextProxyEnabledValidator extends BaseValidator<ContextProxyConfig> {
  protected doValidate(context: ValidationContext<ContextProxyConfig>): void {
    if (!context.config.enabled) return;

    if (!context.config.proxy && !context.config.pool) {
      context.errors.push('Proxy configuration must include either a single proxy or a proxy pool');
    }

    if (context.config.proxy && context.config.pool) {
      context.warnings.push('Both single proxy and proxy pool specified, pool will take precedence');
    }
  }
}

/**
 * Context proxy single validator
 */
export class ContextProxySingleValidator extends BaseValidator<ContextProxyConfig> {
  protected async doValidate(context: ValidationContext<ContextProxyConfig>): Promise<void> {
    if (!context.config.enabled || !context.config.proxy) return;

    const proxyValidation = await validateProxyConfig(context.config.proxy, context.options);
    context.errors.push(...proxyValidation.errors);
    context.warnings.push(...proxyValidation.warnings);
  }
}

/**
 * Context proxy pool validator
 */
export class ContextProxyPoolValidator extends BaseValidator<ContextProxyConfig> {
  protected async doValidate(context: ValidationContext<ContextProxyConfig>): Promise<void> {
    if (!context.config.enabled || !context.config.pool) return;

    if (context.config.pool.proxies.length === 0) {
      context.errors.push('Proxy pool must contain at least one proxy');
      return;
    }

    await this.validatePoolProxies(context);
  }

  private async validatePoolProxies(context: ValidationContext<ContextProxyConfig>): Promise<void> {
    const pool = context.config.pool;
    if (!pool) return;
    
    for (const [index, proxy] of pool.proxies.entries()) {
      const proxyValidation = await validateProxyConfig(proxy, context.options);
      
      if (proxyValidation.errors.length > 0) {
        context.errors.push(...proxyValidation.errors.map((e) => `Pool proxy ${index}: ${e}`));
      }
      
      if (proxyValidation.warnings.length > 0) {
        context.warnings.push(...proxyValidation.warnings.map((w) => `Pool proxy ${index}: ${w}`));
      }
    }
  }
}

/**
 * Context proxy rotation validator
 */
export class ContextProxyRotationValidator extends BaseValidator<ContextProxyConfig> {
  protected doValidate(context: ValidationContext<ContextProxyConfig>): void {
    if (!context.config.enabled) return;

    if (context.config.rotateOnInterval && context.config.rotationInterval < 60000) {
      context.warnings.push('Rotation interval less than 1 minute may cause excessive proxy switching');
    }
  }
}

/**
 * Factory for creating context proxy validation chains
 */
export class ContextProxyValidatorFactory {
  static createContextProxyValidatorChain(): BaseValidator<ContextProxyConfig> {
    const schemaValidator = new SchemaValidator(contextProxyConfigSchema);
    const enabledValidator = new ContextProxyEnabledValidator();
    const singleValidator = new ContextProxySingleValidator();
    const poolValidator = new ContextProxyPoolValidator();
    const rotationValidator = new ContextProxyRotationValidator();

    schemaValidator
      .setNext(enabledValidator)
      .setNext(singleValidator)
      .setNext(poolValidator)
      .setNext(rotationValidator);

    return schemaValidator;
  }
}