/**
 * Application configuration module
 * @module core/config
 * @nist cm-7 "Least functionality"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { randomBytes } from 'crypto';
import { configSchema, type Config } from './schemas.js';
import {
  parseServerConfig,
  parseTLSConfig,
  parseLoggingConfig,
  parseSecurityConfig,
  parseSessionConfig,
  parseRateLimitingConfig,
  parseDatabaseConfig,
  parseRedisConfig,
  parseCORSConfig,
  parseAPIConfig,
  parseGRPCConfig,
  parseWebSocketConfig,
  parseSecurityHeadersConfig,
  parsePuppeteerConfig,
  parseTelemetryConfig,
} from './parsers.js';

// Generate secure default secret if not provided
const generateSecureSecret = (): string => {
  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.JWT_SECRET === undefined || process.env.JWT_SECRET === '')
  ) {
    throw new Error('JWT_SECRET must be set in production environment');
  }
  return process.env.JWT_SECRET ?? randomBytes(32).toString('hex');
};

// Generate secure session secret if not provided
const generateSecureSessionSecret = (): string => {
  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.SESSION_SECRET === undefined || process.env.SESSION_SECRET === '')
  ) {
    throw new Error('SESSION_SECRET must be set in production environment');
  }
  return process.env.SESSION_SECRET ?? randomBytes(32).toString('hex');
};

// Parse and validate configuration
const parseConfig = (): Config => {
  const jwtSecret = generateSecureSecret();
  const sessionSecret = generateSecureSessionSecret();
  const serverConfig = parseServerConfig();
  const securityConfig = parseSecurityConfig(jwtSecret);

  const rawConfig = {
    ...serverConfig,
    ...parseTLSConfig(),
    ...parseLoggingConfig(),
    ...securityConfig,
    ...parseSessionConfig(sessionSecret),
    ...parseRateLimitingConfig(),
    ...parseDatabaseConfig(),
    ...parseRedisConfig(),
    ...parseCORSConfig(securityConfig.ALLOWED_ORIGINS),
    ...parseAPIConfig(),
    ...parseGRPCConfig(),
    ...parseWebSocketConfig(),
    ...parseSecurityHeadersConfig(),
    ...parsePuppeteerConfig(),
    ...parseTelemetryConfig(),
  };

  // Validate configuration
  const result = configSchema.safeParse(rawConfig);
  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }

  return result.data;
};

// Export validated configuration
export const config = parseConfig();

// Export types
export type { Config } from './schemas.js';

// Helper function to get configuration subset
export function getConfigSection<K extends keyof Config>(section: K): Config[K] {
  // eslint-disable-next-line security/detect-object-injection
  return config[section];
}

// Helper function to check if in production
export function isProduction(): boolean {
  return config.NODE_ENV === 'production';
}

// Helper function to check if in development
export function isDevelopment(): boolean {
  return config.NODE_ENV === 'development';
}

// Helper function to check if in test
export function isTest(): boolean {
  return config.NODE_ENV === 'test';
}

// Validate production configuration
export function validateProductionConfig(): void {
  if (!isProduction()) {
    return;
  }

  // In production, ensure critical security settings
  const criticalErrors: string[] = [];

  if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
    criticalErrors.push('JWT_SECRET must be set to a secure value (at least 32 characters)');
  }

  if (!config.SESSION_SECRET || config.SESSION_SECRET.length < 32) {
    criticalErrors.push('SESSION_SECRET must be set to a secure value (at least 32 characters)');
  }

  if (!config.TLS_ENABLED) {
    criticalErrors.push('TLS must be enabled in production (TLS_ENABLED=true)');
  }

  if (!config.CORS_ORIGIN || config.CORS_ORIGIN === '*') {
    criticalErrors.push('CORS_ORIGIN must be set to specific origins in production');
  }

  if (criticalErrors.length > 0) {
    throw new Error(`Production configuration validation failed:\n${criticalErrors.join('\n')}`);
  }
}

// Re-export all schemas and parsers for testing
export * from './schemas.js';
export * from './parsers.js';
