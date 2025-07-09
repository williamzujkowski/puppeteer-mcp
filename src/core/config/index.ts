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

// Parse and validate configuration
const parseConfig = (): Config => {
  const jwtSecret = generateSecureSecret();
  const serverConfig = parseServerConfig();
  const securityConfig = parseSecurityConfig(jwtSecret);

  const rawConfig = {
    ...serverConfig,
    ...parseTLSConfig(),
    ...parseLoggingConfig(),
    ...securityConfig,
    ...parseSessionConfig(),
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
    const errorMessages = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n');
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

// Re-export all schemas and parsers for testing
export * from './schemas.js';
export * from './parsers.js';