/**
 * Proxy validation utility functions
 * @module puppeteer/proxy/validation/utils
 * @nist cm-6 "Configuration settings"
 * @nist ia-5 "Authenticator management"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import type { ProxyConfig } from '../../types/proxy.js';
import { ProxyProtocol } from '../../types/proxy.js';

/**
 * Sanitize proxy configuration for logging
 * @nist au-3 "Content of audit records"
 * @nist ia-5 "Authenticator management"
 */
export function sanitizeProxyConfigForLogging(config: ProxyConfig): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
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
  protocol: ProxyConfig['protocol'] = ProxyProtocol.HTTP,
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