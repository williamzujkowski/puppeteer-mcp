/**
 * Application configuration module
 * @module core/config
 * @nist cm-7 "Least functionality"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { z } from 'zod';
import { randomBytes } from 'crypto';

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

// Define configuration schema
const configSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.number().int().positive().default(8443),
  HOST: z.string().default('0.0.0.0'),

  // TLS Configuration
  /**
   * @nist sc-8 "Transmission confidentiality and integrity"
   * @nist sc-13 "Cryptographic protection"
   */
  TLS_ENABLED: z.boolean().default(true),
  TLS_CERT_PATH: z.string().optional(),
  TLS_KEY_PATH: z.string().optional(),
  TLS_CA_PATH: z.string().optional(),
  TLS_MIN_VERSION: z.enum(['TLSv1.2', 'TLSv1.3']).default('TLSv1.2'),

  // Logging
  /**
   * @nist au-2 "Audit events"
   * @nist au-3 "Content of audit records"
   */
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  AUDIT_LOG_ENABLED: z.boolean().default(true),
  AUDIT_LOG_PATH: z.string().default('./logs/audit'),

  // Security
  /**
   * @nist ia-5 "Authenticator management"
   * @nist sc-13 "Cryptographic protection"
   */
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('24h'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  JWT_ALGORITHM: z.enum(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512']).default('HS512'),
  BCRYPT_ROUNDS: z.number().int().min(10).max(20).default(12),

  // Session Configuration
  /**
   * @nist ac-12 "Session termination"
   */
  SESSION_TIMEOUT: z
    .number()
    .int()
    .positive()
    .default(30 * 60 * 1000), // 30 minutes
  SESSION_ABSOLUTE_TIMEOUT: z
    .number()
    .int()
    .positive()
    .default(12 * 60 * 60 * 1000), // 12 hours
  SESSION_RENEWAL_THRESHOLD: z
    .number()
    .int()
    .positive()
    .default(5 * 60 * 1000), // 5 minutes

  // Rate limiting
  /**
   * @nist sc-5 "Denial of service protection"
   */
  RATE_LIMIT_WINDOW: z
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.number().int().positive().default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.boolean().default(false),
  RATE_LIMIT_SKIP_FAILED_REQUESTS: z.boolean().default(false),

  // Database (future use)
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z.boolean().default(true),
  DATABASE_POOL_MIN: z.number().int().positive().default(2),
  DATABASE_POOL_MAX: z.number().int().positive().default(10),

  REDIS_URL: z.string().optional(),
  REDIS_TLS: z.boolean().default(true),
  REDIS_KEY_PREFIX: z.string().default('mcp:'),

  // CORS
  /**
   * @nist ac-4 "Information flow enforcement"
   */
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z.boolean().default(true),
  CORS_MAX_AGE: z.number().int().positive().default(86400), // 24 hours

  // Express Configuration
  /**
   * @nist sc-5 "Denial of service protection"
   * Trust proxy setting for Express. Set to false, number, or specific proxy
   * to prevent IP spoofing. See: https://expressjs.com/en/guide/behind-proxies.html
   */
  TRUST_PROXY: z.union([z.boolean(), z.number(), z.string()]).optional(),

  // API Configuration
  API_VERSION: z.string().default('v1'),
  API_PREFIX: z.string().default('/api'),

  // gRPC Configuration
  GRPC_PORT: z.number().int().positive().default(50051),
  GRPC_HOST: z.string().default('0.0.0.0'),
  GRPC_MAX_RECEIVE_MESSAGE_SIZE: z
    .number()
    .int()
    .positive()
    .default(4 * 1024 * 1024), // 4MB
  GRPC_MAX_SEND_MESSAGE_SIZE: z
    .number()
    .int()
    .positive()
    .default(4 * 1024 * 1024), // 4MB
  GRPC_MAX_MESSAGE_SIZE: z
    .number()
    .int()
    .positive()
    .default(4 * 1024 * 1024), // 4MB
  GRPC_KEEPALIVE_TIME: z.number().int().positive().default(120000), // 2 minutes
  GRPC_KEEPALIVE_TIMEOUT: z.number().int().positive().default(20000), // 20 seconds
  GRPC_TLS_CERT_PATH: z.string().optional(),
  GRPC_TLS_KEY_PATH: z.string().optional(),
  GRPC_TLS_CA_PATH: z.string().optional(),
  GRPC_TLS_CLIENT_AUTH: z.boolean().default(false),

  // WebSocket Configuration
  WS_PATH: z.string().default('/ws'),
  WS_HEARTBEAT_INTERVAL: z.number().int().positive().default(30000), // 30 seconds
  WS_MAX_PAYLOAD: z
    .number()
    .int()
    .positive()
    .default(1024 * 1024), // 1MB
  WS_ALLOWED_ORIGINS: z.string().optional(),

  // Security Headers
  /**
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  HSTS_MAX_AGE: z.number().int().positive().default(31536000), // 1 year
  CSP_DIRECTIVES: z.string().default("default-src 'self'"),

  // Puppeteer Configuration
  /**
   * @nist ac-4 "Information flow enforcement"
   * @nist sc-5 "Denial of service protection"
   */
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  PUPPETEER_HEADLESS: z.boolean().default(true),
  PUPPETEER_ARGS: z.string().optional(), // Comma-separated list of args
  BROWSER_POOL_MAX_SIZE: z.number().int().positive().default(5),
  BROWSER_IDLE_TIMEOUT: z.number().int().positive().default(300000), // 5 minutes
  PUPPETEER_DOWNLOAD_PATH: z.string().optional(),
  PUPPETEER_CACHE_ENABLED: z.boolean().default(true),
});

// Helper functions to parse environment variables
const parseIntEnv = (value: string | undefined): number | undefined => {
  return value !== undefined && value !== '' ? parseInt(value, 10) : undefined;
};

const parseBoolEnv = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value === 'true';
};

// Parse server configuration
const parseServerConfig = (): Partial<z.infer<typeof configSchema>> => ({
  NODE_ENV: ['development', 'test', 'production'].includes(process.env.NODE_ENV ?? '')
    ? (process.env.NODE_ENV as 'development' | 'test' | 'production')
    : undefined,
  PORT: parseIntEnv(process.env.PORT),
  HOST: process.env.HOST,
});

// Parse TLS configuration
const parseTLSConfig = (): Partial<z.infer<typeof configSchema>> => ({
  TLS_ENABLED: process.env.TLS_ENABLED !== 'false',
  TLS_CERT_PATH: process.env.TLS_CERT_PATH,
  TLS_KEY_PATH: process.env.TLS_KEY_PATH,
  TLS_CA_PATH: process.env.TLS_CA_PATH,
  TLS_MIN_VERSION: ['TLSv1.2', 'TLSv1.3'].includes(process.env.TLS_MIN_VERSION ?? '')
    ? (process.env.TLS_MIN_VERSION as 'TLSv1.2' | 'TLSv1.3')
    : undefined,
});

// Parse logging configuration
const parseLoggingConfig = (): Partial<z.infer<typeof configSchema>> => ({
  LOG_LEVEL: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(
    process.env.LOG_LEVEL ?? '',
  )
    ? (process.env.LOG_LEVEL as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal')
    : undefined,
  LOG_FORMAT: ['json', 'pretty'].includes(process.env.LOG_FORMAT ?? '')
    ? (process.env.LOG_FORMAT as 'json' | 'pretty')
    : undefined,
  AUDIT_LOG_ENABLED: process.env.AUDIT_LOG_ENABLED !== 'false',
  AUDIT_LOG_PATH: process.env.AUDIT_LOG_PATH,
});

// Parse security configuration
const parseSecurityConfig = (): Partial<z.infer<typeof configSchema>> => ({
  JWT_SECRET: generateSecureSecret(),
  JWT_EXPIRY: process.env.JWT_EXPIRY,
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY,
  JWT_ALGORITHM: ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'].includes(
    process.env.JWT_ALGORITHM ?? '',
  )
    ? (process.env.JWT_ALGORITHM as 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512')
    : undefined,
  BCRYPT_ROUNDS: parseIntEnv(process.env.BCRYPT_ROUNDS),
});

// Parse session configuration
const parseSessionConfig = (): Partial<z.infer<typeof configSchema>> => ({
  SESSION_TIMEOUT: parseIntEnv(process.env.SESSION_TIMEOUT),
  SESSION_ABSOLUTE_TIMEOUT: parseIntEnv(process.env.SESSION_ABSOLUTE_TIMEOUT),
  SESSION_RENEWAL_THRESHOLD: parseIntEnv(process.env.SESSION_RENEWAL_THRESHOLD),
});

// Parse rate limiting configuration
const parseRateLimitConfig = (): Partial<z.infer<typeof configSchema>> => ({
  RATE_LIMIT_WINDOW: parseIntEnv(process.env.RATE_LIMIT_WINDOW),
  RATE_LIMIT_MAX_REQUESTS: parseIntEnv(process.env.RATE_LIMIT_MAX_REQUESTS),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: parseBoolEnv(
    process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
  ),
  RATE_LIMIT_SKIP_FAILED_REQUESTS: parseBoolEnv(process.env.RATE_LIMIT_SKIP_FAILED_REQUESTS),
});

// Parse database configuration
const parseDatabaseConfig = (): Partial<z.infer<typeof configSchema>> => ({
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_SSL: process.env.DATABASE_SSL !== 'false',
  DATABASE_POOL_MIN: parseIntEnv(process.env.DATABASE_POOL_MIN),
  DATABASE_POOL_MAX: parseIntEnv(process.env.DATABASE_POOL_MAX),
  REDIS_URL: process.env.REDIS_URL,
  REDIS_TLS: process.env.REDIS_TLS !== 'false',
  REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX,
});

// Parse CORS configuration
const parseCORSConfig = (): Partial<z.infer<typeof configSchema>> => ({
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS !== 'false',
  CORS_MAX_AGE: parseIntEnv(process.env.CORS_MAX_AGE),
  TRUST_PROXY:
    process.env.TRUST_PROXY !== undefined
      ? process.env.TRUST_PROXY === 'true'
        ? true
        : process.env.TRUST_PROXY === 'false'
          ? false
          : (parseIntEnv(process.env.TRUST_PROXY) ?? process.env.TRUST_PROXY)
      : undefined,
});

// Parse API configuration
const parseAPIConfig = (): Partial<z.infer<typeof configSchema>> => ({
  API_VERSION: process.env.API_VERSION,
  API_PREFIX: process.env.API_PREFIX,
});

// Parse gRPC configuration
const parseGRPCConfig = (): Partial<z.infer<typeof configSchema>> => ({
  GRPC_PORT: parseIntEnv(process.env.GRPC_PORT),
  GRPC_HOST: process.env.GRPC_HOST,
  GRPC_MAX_RECEIVE_MESSAGE_SIZE: parseIntEnv(process.env.GRPC_MAX_RECEIVE_MESSAGE_SIZE),
  GRPC_MAX_SEND_MESSAGE_SIZE: parseIntEnv(process.env.GRPC_MAX_SEND_MESSAGE_SIZE),
  GRPC_MAX_MESSAGE_SIZE: parseIntEnv(process.env.GRPC_MAX_MESSAGE_SIZE),
  GRPC_KEEPALIVE_TIME: parseIntEnv(process.env.GRPC_KEEPALIVE_TIME),
  GRPC_KEEPALIVE_TIMEOUT: parseIntEnv(process.env.GRPC_KEEPALIVE_TIMEOUT),
  GRPC_TLS_CERT_PATH: process.env.GRPC_TLS_CERT_PATH,
  GRPC_TLS_KEY_PATH: process.env.GRPC_TLS_KEY_PATH,
  GRPC_TLS_CA_PATH: process.env.GRPC_TLS_CA_PATH,
  GRPC_TLS_CLIENT_AUTH: parseBoolEnv(process.env.GRPC_TLS_CLIENT_AUTH),
});

// Parse WebSocket configuration
const parseWebSocketConfig = (): Partial<z.infer<typeof configSchema>> => ({
  WS_PATH: process.env.WS_PATH,
  WS_HEARTBEAT_INTERVAL: parseIntEnv(process.env.WS_HEARTBEAT_INTERVAL),
  WS_MAX_PAYLOAD: parseIntEnv(process.env.WS_MAX_PAYLOAD),
  WS_ALLOWED_ORIGINS: process.env.WS_ALLOWED_ORIGINS,
});

// Parse security headers configuration
const parseSecurityHeadersConfig = (): Partial<z.infer<typeof configSchema>> => ({
  HSTS_MAX_AGE: parseIntEnv(process.env.HSTS_MAX_AGE),
  CSP_DIRECTIVES: process.env.CSP_DIRECTIVES,
});

// Parse Puppeteer configuration
const parsePuppeteerConfig = (): Partial<z.infer<typeof configSchema>> => ({
  PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
  PUPPETEER_HEADLESS: parseBoolEnv(process.env.PUPPETEER_HEADLESS, true),
  PUPPETEER_ARGS: process.env.PUPPETEER_ARGS,
  BROWSER_POOL_MAX_SIZE: parseIntEnv(process.env.BROWSER_POOL_MAX_SIZE),
  BROWSER_IDLE_TIMEOUT: parseIntEnv(process.env.BROWSER_IDLE_TIMEOUT),
  PUPPETEER_DOWNLOAD_PATH: process.env.PUPPETEER_DOWNLOAD_PATH,
  PUPPETEER_CACHE_ENABLED: parseBoolEnv(process.env.PUPPETEER_CACHE_ENABLED, true),
});

// Parse and validate configuration
const parseConfig = (): z.infer<typeof configSchema> => {
  try {
    return configSchema.parse({
      ...parseServerConfig(),
      ...parseTLSConfig(),
      ...parseLoggingConfig(),
      ...parseSecurityConfig(),
      ...parseSessionConfig(),
      ...parseRateLimitConfig(),
      ...parseDatabaseConfig(),
      ...parseCORSConfig(),
      ...parseAPIConfig(),
      ...parseGRPCConfig(),
      ...parseWebSocketConfig(),
      ...parseSecurityHeadersConfig(),
      ...parsePuppeteerConfig(),
    });
  } catch (error) {
    // Use process.stderr.write for critical configuration errors before logger is initialized
    process.stderr.write(
      `Configuration validation failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    throw new Error('Invalid configuration');
  }
};

// Export validated configuration
export const config = parseConfig();

// Type export for use in other modules
export type Config = z.infer<typeof configSchema>;

/**
 * Validate required production configuration
 * @nist cm-6 "Configuration settings"
 * @nist cm-7 "Least functionality"
 */
export const validateProductionConfig = (): void => {
  if (config.NODE_ENV === 'production') {
    // Ensure TLS is enabled in production
    if (!config.TLS_ENABLED) {
      throw new Error('TLS must be enabled in production');
    }

    // Ensure proper JWT configuration
    if (config.JWT_SECRET === generateSecureSecret()) {
      throw new Error('JWT_SECRET must be explicitly set in production');
    }

    // Ensure audit logging is enabled
    if (!config.AUDIT_LOG_ENABLED) {
      throw new Error('Audit logging must be enabled in production');
    }

    // Ensure CORS is properly configured
    if (config.CORS_ORIGIN === '*') {
      // Use process.stderr.write for critical warnings before logger is initialized
      process.stderr.write(
        'Warning: CORS origin is set to * in production. Consider restricting to specific origins.\n',
      );
    }
  }
};
