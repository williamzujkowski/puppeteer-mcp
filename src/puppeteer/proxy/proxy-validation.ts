/**
 * Proxy Validation Utilities
 * @module puppeteer/proxy/proxy-validation
 * @nist cm-6 "Configuration settings"
 * @nist ia-5 "Authenticator management"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { z } from 'zod';
import type { ProxyConfig, ContextProxyConfig } from '../types/proxy.js';
import { proxyConfigSchema, contextProxyConfigSchema } from '../types/proxy.js';
import { createLogger } from '../../utils/logger.js';
import { AppError } from '../../core/errors/app-error.js';
import * as net from 'net';
import * as tls from 'tls';
import { promisify } from 'util';

const logger = createLogger('proxy-validation');

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
 * Validate proxy configuration
 * @nist cm-6 "Configuration settings"
 * @nist ia-5 "Authenticator management"
 */
export async function validateProxyConfig(
  config: unknown,
  options: { checkConnectivity?: boolean } = {},
): Promise<ProxyValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Schema validation
    const parsed = proxyConfigSchema.parse(config);

    // Additional validation
    if (parsed.auth) {
      // Check for weak credentials
      if (parsed.auth.password.length < 8) {
        warnings.push('Proxy password should be at least 8 characters long');
      }
      if (parsed.auth.username.toLowerCase() === 'admin' || 
          parsed.auth.username.toLowerCase() === 'user') {
        warnings.push('Proxy username appears to be a default value');
      }
    }

    // Validate bypass list patterns
    for (const pattern of parsed.bypass) {
      if (!isValidBypassPattern(pattern)) {
        errors.push(`Invalid bypass pattern: ${pattern}`);
      }
    }

    // Check port ranges for common proxy ports
    const commonProxyPorts = [1080, 3128, 8080, 8888];
    if (!commonProxyPorts.includes(parsed.port)) {
      warnings.push(`Port ${parsed.port} is not a common proxy port`);
    }

    // Connectivity check if requested
    if (options.checkConnectivity && errors.length === 0) {
      try {
        await checkProxyConnectivity(parsed);
      } catch (error) {
        errors.push(`Connectivity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized: errors.length === 0 ? parsed : undefined,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
    } else {
      errors.push(error instanceof Error ? error.message : 'Invalid proxy configuration');
    }

    return {
      valid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Validate context proxy configuration
 * @nist cm-6 "Configuration settings"
 */
export async function validateContextProxyConfig(
  config: unknown,
  options: { checkConnectivity?: boolean } = {},
): Promise<ContextProxyValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Schema validation
    const parsed = contextProxyConfigSchema.parse(config);

    // Additional validation
    if (parsed.enabled) {
      if (!parsed.proxy && !parsed.pool) {
        errors.push('Proxy configuration must include either a single proxy or a proxy pool');
      }

      if (parsed.proxy && parsed.pool) {
        warnings.push('Both single proxy and proxy pool specified, pool will take precedence');
      }

      // Validate proxy if present
      if (parsed.proxy) {
        const proxyValidation = await validateProxyConfig(parsed.proxy, options);
        errors.push(...proxyValidation.errors);
        warnings.push(...proxyValidation.warnings);
      }

      // Validate pool if present
      if (parsed.pool) {
        if (parsed.pool.proxies.length === 0) {
          errors.push('Proxy pool must contain at least one proxy');
        }

        for (let i = 0; i < parsed.pool.proxies.length; i++) {
          const proxyValidation = await validateProxyConfig(parsed.pool.proxies[i], options);
          errors.push(...proxyValidation.errors.map((e) => `Pool proxy ${i}: ${e}`));
          warnings.push(...proxyValidation.warnings.map((w) => `Pool proxy ${i}: ${w}`));
        }
      }

      // Validate rotation settings
      if (parsed.rotateOnInterval && parsed.rotationInterval < 60000) {
        warnings.push('Rotation interval less than 1 minute may cause excessive proxy switching');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized: errors.length === 0 ? parsed : undefined,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
    } else {
      errors.push(error instanceof Error ? error.message : 'Invalid context proxy configuration');
    }

    return {
      valid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Check if a bypass pattern is valid
 * @private
 */
function isValidBypassPattern(pattern: string): boolean {
  // Check for valid domain patterns
  const domainRegex = /^(\*\.)?([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/;
  
  // Check for valid IP patterns
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  
  // Check for valid IP range patterns
  const ipRangeRegex = /^(\d{1,3}\.){0,3}\*$/;
  
  return domainRegex.test(pattern) || ipRegex.test(pattern) || ipRangeRegex.test(pattern);
}

/**
 * Check proxy connectivity
 * @private
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
async function checkProxyConnectivity(config: ProxyConfig): Promise<void> {
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

/**
 * Sanitize proxy configuration for logging
 * @nist au-3 "Content of audit records"
 * @nist ia-5 "Authenticator management"
 */
export function sanitizeProxyConfigForLogging(config: ProxyConfig): Record<string, any> {
  const sanitized: Record<string, any> = {
    protocol: config.protocol,
    host: config.host,
    port: config.port,
    bypass: config.bypass,
    name: config.name,
    tags: config.tags,
    priority: config.priority,
  };

  if (config.auth) {
    sanitized.auth = {
      username: config.auth.username,
      password: '***REDACTED***',
    };
  }

  return sanitized;
}

/**
 * Validate proxy authentication credentials
 * @nist ia-5 "Authenticator management"
 */
export function validateProxyCredentials(
  username: string,
  password: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Username validation
  if (!username || username.trim().length === 0) {
    errors.push('Username cannot be empty');
  }
  if (username.length > 256) {
    errors.push('Username too long (max 256 characters)');
  }
  if (!/^[\w.-]+$/.test(username)) {
    errors.push('Username contains invalid characters');
  }

  // Password validation
  if (!password || password.length === 0) {
    errors.push('Password cannot be empty');
  }
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (password.length > 256) {
    errors.push('Password too long (max 256 characters)');
  }

  // Check for common weak passwords
  const weakPasswords = ['password', '12345678', 'password123', 'admin123', 'proxy123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too weak');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate secure proxy configuration
 * @nist cm-6 "Configuration settings"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export function generateSecureProxyConfig(
  host: string,
  port: number,
  protocol: ProxyConfig['protocol'] = 'http',
): Partial<ProxyConfig> {
  return {
    protocol,
    host,
    port,
    bypass: [
      'localhost',
      '127.0.0.1',
      '::1',
      '10.*',
      '172.16.*',
      '192.168.*',
      '*.local',
    ],
    connectionTimeout: 30000,
    requestTimeout: 60000,
    maxRetries: 3,
    rejectUnauthorized: true,
    healthCheckInterval: 300000,
    healthCheckUrl: 'https://www.google.com',
  };
}