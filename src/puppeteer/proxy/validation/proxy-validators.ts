/**
 * Proxy-specific validators
 * @module puppeteer/proxy/validation/proxy-validators
 * @nist cm-6 "Configuration settings"
 * @nist ia-5 "Authenticator management"
 */

import { z } from 'zod';
import * as net from 'net';
import type { ProxyConfig } from '../../types/proxy.js';
import { proxyConfigSchema } from '../../types/proxy.js';
import { BaseValidator, type ValidationContext } from './validator-base.js';

/**
 * Schema validator
 */
export class SchemaValidator<T> extends BaseValidator<T> {
  constructor(private schema: z.ZodSchema<T>) {
    super();
  }

  protected doValidate(context: ValidationContext<T>): void {
    try {
      const parsed = this.schema.parse(context.config);
      // Update config with parsed value
      Object.assign(context.config as Record<string, unknown>, parsed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        context.errors.push(...error.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
      } else {
        context.errors.push(error instanceof Error ? error.message : 'Invalid configuration');
      }
    }
  }
}

/**
 * Proxy auth validator
 */
export class ProxyAuthValidator extends BaseValidator<ProxyConfig> {
  protected doValidate(context: ValidationContext<ProxyConfig>): void {
    if (!context.config.auth) return;

    const authWarnings = this.validateAuthCredentials(context.config.auth);
    context.warnings.push(...authWarnings);
  }

  private validateAuthCredentials(auth: { username: string; password: string }): string[] {
    const warnings: string[] = [];

    if (auth.password.length < 8) {
      warnings.push('Proxy password should be at least 8 characters long');
    }

    const defaultUsernames = ['admin', 'user'];
    if (defaultUsernames.includes(auth.username.toLowerCase())) {
      warnings.push('Proxy username appears to be a default value');
    }

    return warnings;
  }
}

/**
 * Bypass pattern validator
 */
export class BypassPatternValidator extends BaseValidator<ProxyConfig> {
  protected doValidate(context: ValidationContext<ProxyConfig>): void {
    const invalidPatterns = context.config.bypass.filter(
      (pattern) => !this.isValidBypassPattern(pattern),
    );

    invalidPatterns.forEach((pattern) => {
      context.errors.push(`Invalid bypass pattern: ${pattern}`);
    });
  }

  private isValidBypassPattern(pattern: string): boolean {
    // Use safer regex patterns with explicit limits and anchors
    // eslint-disable-next-line security/detect-unsafe-regex
    const domainPattern = /^(?:\*\.)?(?:[a-zA-Z0-9-]{1,63}\.){0,10}[a-zA-Z0-9-]{1,63}$/;
    // eslint-disable-next-line security/detect-unsafe-regex
    const ipPattern = /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/;
    // eslint-disable-next-line security/detect-unsafe-regex
    const ipRangePattern = /^(?:\d{1,3}\.){0,3}\*$/;

    const validators = [domainPattern, ipPattern, ipRangePattern];

    return validators.some((regex) => regex.test(pattern));
  }
}

/**
 * Port validator
 */
export class PortValidator extends BaseValidator<ProxyConfig> {
  private readonly commonProxyPorts = [1080, 3128, 8080, 8888];

  protected doValidate(context: ValidationContext<ProxyConfig>): void {
    if (!this.commonProxyPorts.includes(context.config.port)) {
      context.warnings.push(`Port ${context.config.port} is not a common proxy port`);
    }
  }
}

/**
 * Connectivity validator
 */
export class ConnectivityValidator extends BaseValidator<ProxyConfig> {
  protected async doValidate(context: ValidationContext<ProxyConfig>): Promise<void> {
    if (context.options.checkConnectivity !== true || context.errors.length > 0) {
      return;
    }

    try {
      await this.checkProxyConnectivity(context.config);
    } catch (error) {
      context.errors.push(
        `Connectivity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async checkProxyConnectivity(config: ProxyConfig): Promise<void> {
    const timeout = config.connectionTimeout || 10000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Connection timeout after ${timeout}ms`));
      }, timeout);

      const socket = net.createConnection({
        host: config.host,
        port: config.port,
        timeout,
      });

      socket.on('connect', () => {
        clearTimeout(timer);
        socket.end();
        resolve();
      });

      socket.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      socket.on('timeout', () => {
        clearTimeout(timer);
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
    });
  }
}

/**
 * Factory for creating proxy validation chains
 */
export class ProxyValidatorFactory {
  static createProxyValidatorChain(): BaseValidator<ProxyConfig> {
    const schemaValidator = new SchemaValidator(proxyConfigSchema);
    const authValidator = new ProxyAuthValidator();
    const bypassValidator = new BypassPatternValidator();
    const portValidator = new PortValidator();
    const connectivityValidator = new ConnectivityValidator();

    (schemaValidator as any)
      .setNext(authValidator)
      .setNext(bypassValidator)
      .setNext(portValidator)
      .setNext(connectivityValidator);

    return schemaValidator;
  }
}
