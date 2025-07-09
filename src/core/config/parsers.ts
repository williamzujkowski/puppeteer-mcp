/**
 * Configuration parser utilities
 * @module core/config/parsers
 * @nist cm-7 "Least functionality"
 */

/**
 * Parse boolean environment variable
 */
export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Parse integer environment variable
 */
export function parseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float environment variable
 */
export function parseFloat(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse array environment variable (comma-separated)
 */
export function parseArray(value: string | undefined, defaultValue: string[]): string[] {
  if (value === undefined || value === '') return defaultValue;
  return value.split(',').map(item => item.trim());
}

/**
 * Parse JSON environment variable
 */
export function parseJSON<T>(value: string | undefined, defaultValue: T): T {
  if (value === undefined || value === '') return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Parse server configuration from environment
 */
export function parseServerConfig(): {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  HOST: string;
} {
  return {
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'test' | 'production') ?? 'development',
    PORT: parseInt(process.env.PORT, 8443),
    HOST: process.env.HOST ?? '0.0.0.0',
  };
}

/**
 * Parse TLS configuration from environment
 */
export function parseTLSConfig(): {
  TLS_ENABLED: boolean;
  TLS_CERT_PATH: string | undefined;
  TLS_KEY_PATH: string | undefined;
  TLS_CA_PATH: string | undefined;
  TLS_MIN_VERSION: 'TLSv1.2' | 'TLSv1.3';
} {
  return {
    TLS_ENABLED: parseBoolean(process.env.TLS_ENABLED, true),
    TLS_CERT_PATH: process.env.TLS_CERT_PATH,
    TLS_KEY_PATH: process.env.TLS_KEY_PATH,
    TLS_CA_PATH: process.env.TLS_CA_PATH,
    TLS_MIN_VERSION: (process.env.TLS_MIN_VERSION as 'TLSv1.2' | 'TLSv1.3') ?? 'TLSv1.2',
  };
}

/**
 * Parse logging configuration from environment
 */
export function parseLoggingConfig(): {
  LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  LOG_FORMAT: 'json' | 'pretty';
  AUDIT_LOG_ENABLED: boolean;
  AUDIT_LOG_PATH: string;
} {
  return {
    LOG_LEVEL: (process.env.LOG_LEVEL as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') ?? 'info',
    LOG_FORMAT: (process.env.LOG_FORMAT as 'json' | 'pretty') ?? 'json',
    AUDIT_LOG_ENABLED: parseBoolean(process.env.AUDIT_LOG_ENABLED, true),
    AUDIT_LOG_PATH: process.env.AUDIT_LOG_PATH ?? './logs/audit',
  };
}

/**
 * Parse security configuration from environment
 */
export function parseSecurityConfig(jwtSecret: string): {
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  ALLOWED_ORIGINS: string[];
  TRUSTED_PROXIES: string[];
  ENABLE_INTRUSION_DETECTION: boolean;
  MAX_LOGIN_ATTEMPTS: number;
  LOGIN_LOCKOUT_DURATION: number;
  ENABLE_ANOMALY_DETECTION: boolean;
  ENABLE_THREAT_INTEL: boolean;
} {
  return {
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '24h',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    ALLOWED_ORIGINS: parseArray(process.env.ALLOWED_ORIGINS, ['https://localhost:8443']),
    TRUSTED_PROXIES: parseArray(process.env.TRUSTED_PROXIES, []),
    ENABLE_INTRUSION_DETECTION: parseBoolean(process.env.ENABLE_INTRUSION_DETECTION, true),
    MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 5),
    LOGIN_LOCKOUT_DURATION: parseInt(process.env.LOGIN_LOCKOUT_DURATION, 900000),
    ENABLE_ANOMALY_DETECTION: parseBoolean(process.env.ENABLE_ANOMALY_DETECTION, true),
    ENABLE_THREAT_INTEL: parseBoolean(process.env.ENABLE_THREAT_INTEL, false),
  };
}

/**
 * Parse session configuration from environment
 */
export function parseSessionConfig(): {
  SESSION_STORE_TYPE: 'memory' | 'redis';
  SESSION_TIMEOUT: number;
  SESSION_CLEANUP_INTERVAL: number;
  SESSION_MAX_AGE: number;
  ENABLE_SESSION_MONITORING: boolean;
} {
  return {
    SESSION_STORE_TYPE: (process.env.SESSION_STORE_TYPE as 'memory' | 'redis') ?? 'memory',
    SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT, 86400000),
    SESSION_CLEANUP_INTERVAL: parseInt(process.env.SESSION_CLEANUP_INTERVAL, 900000),
    SESSION_MAX_AGE: parseInt(process.env.SESSION_MAX_AGE, 604800000),
    ENABLE_SESSION_MONITORING: parseBoolean(process.env.ENABLE_SESSION_MONITORING, true),
  };
}

/**
 * Parse rate limiting configuration from environment
 */
export function parseRateLimitingConfig(): {
  RATE_LIMIT_ENABLED: boolean;
  RATE_LIMIT_WINDOW: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: boolean;
  RATE_LIMIT_SKIP_FAILED_REQUESTS: boolean;
} {
  return {
    RATE_LIMIT_ENABLED: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW, 900000),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
    RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: parseBoolean(process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS, false),
    RATE_LIMIT_SKIP_FAILED_REQUESTS: parseBoolean(process.env.RATE_LIMIT_SKIP_FAILED_REQUESTS, false),
  };
}

/**
 * Parse database configuration from environment
 */
export function parseDatabaseConfig(): {
  DATABASE_TYPE: 'sqlite' | 'postgres' | 'mysql';
  DATABASE_PATH: string;
  DATABASE_HOST: string | undefined;
  DATABASE_PORT: number | undefined;
  DATABASE_NAME: string | undefined;
  DATABASE_USER: string | undefined;
  DATABASE_PASSWORD: string | undefined;
  DATABASE_SSL: boolean;
  DATABASE_POOL_MIN: number;
  DATABASE_POOL_MAX: number;
} {
  return {
    DATABASE_TYPE: (process.env.DATABASE_TYPE as 'sqlite' | 'postgres' | 'mysql') ?? 'sqlite',
    DATABASE_PATH: process.env.DATABASE_PATH ?? './data/app.db',
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PORT: process.env.DATABASE_PORT !== undefined && process.env.DATABASE_PORT !== '' ? parseInt(process.env.DATABASE_PORT, 5432) : undefined,
    DATABASE_NAME: process.env.DATABASE_NAME,
    DATABASE_USER: process.env.DATABASE_USER,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_SSL: parseBoolean(process.env.DATABASE_SSL, false),
    DATABASE_POOL_MIN: parseInt(process.env.DATABASE_POOL_MIN, 2),
    DATABASE_POOL_MAX: parseInt(process.env.DATABASE_POOL_MAX, 10),
  };
}

/**
 * Parse Redis configuration from environment
 */
export function parseRedisConfig(): {
  REDIS_URL: string | undefined;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string | undefined;
  REDIS_DB: number;
  REDIS_KEY_PREFIX: string;
  REDIS_ENABLE_TLS: boolean;
  REDIS_ENABLE_READY_CHECK: boolean;
  REDIS_CONNECT_TIMEOUT: number;
  REDIS_COMMAND_TIMEOUT: number;
  REDIS_KEEP_ALIVE: number;
  REDIS_RECONNECT_ON_ERROR: boolean;
  REDIS_MAX_RETRIES_PER_REQUEST: number;
} {
  return {
    REDIS_URL: process.env.REDIS_URL,
    REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT, 6379),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_DB: parseInt(process.env.REDIS_DB, 0),
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX ?? 'puppeteer-mcp:',
    REDIS_ENABLE_TLS: parseBoolean(process.env.REDIS_ENABLE_TLS, false),
    REDIS_ENABLE_READY_CHECK: parseBoolean(process.env.REDIS_ENABLE_READY_CHECK, true),
    REDIS_CONNECT_TIMEOUT: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10000),
    REDIS_COMMAND_TIMEOUT: parseInt(process.env.REDIS_COMMAND_TIMEOUT, 5000),
    REDIS_KEEP_ALIVE: parseInt(process.env.REDIS_KEEP_ALIVE, 30000),
    REDIS_RECONNECT_ON_ERROR: parseBoolean(process.env.REDIS_RECONNECT_ON_ERROR, true),
    REDIS_MAX_RETRIES_PER_REQUEST: parseInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST, 3),
    REDIS_ENABLE_OFFLINE_QUEUE: parseBoolean(process.env.REDIS_ENABLE_OFFLINE_QUEUE, true),
    REDIS_LAZY_CONNECT: parseBoolean(process.env.REDIS_LAZY_CONNECT, false),
    REDIS_FAMILY: (process.env.REDIS_FAMILY as 'IPv4' | 'IPv6') ?? 'IPv4',
  };
}

/**
 * Parse CORS configuration from environment
 */
export function parseCORSConfig(allowedOrigins: string[]): {
  CORS_ENABLED: boolean;
  CORS_CREDENTIALS: boolean;
  CORS_MAX_AGE: number;
  CORS_ALLOWED_METHODS: string[];
  CORS_ALLOWED_HEADERS: string[];
  CORS_EXPOSED_HEADERS: string[];
  ALLOWED_ORIGINS: string[];
} {
  return {
    CORS_ENABLED: parseBoolean(process.env.CORS_ENABLED, true),
    CORS_CREDENTIALS: parseBoolean(process.env.CORS_CREDENTIALS, true),
    CORS_MAX_AGE: parseInt(process.env.CORS_MAX_AGE, 86400),
    CORS_ALLOWED_METHODS: parseArray(process.env.CORS_ALLOWED_METHODS, ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
    CORS_ALLOWED_HEADERS: parseArray(process.env.CORS_ALLOWED_HEADERS, [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Session-ID',
    ]),
    CORS_EXPOSED_HEADERS: parseArray(process.env.CORS_EXPOSED_HEADERS, ['X-Request-ID', 'X-RateLimit-Remaining']),
    ALLOWED_ORIGINS: allowedOrigins,
  };
}

/**
 * Parse API configuration from environment
 */
export function parseAPIConfig(): {
  API_PREFIX: string;
  API_TIMEOUT: number;
  API_MAX_PAYLOAD_SIZE: string;
} {
  return {
    API_PREFIX: process.env.API_PREFIX ?? '/api/v1',
    API_TIMEOUT: parseInt(process.env.API_TIMEOUT, 30000),
    API_MAX_PAYLOAD_SIZE: process.env.API_MAX_PAYLOAD_SIZE ?? '10mb',
  };
}

/**
 * Parse gRPC configuration from environment
 */
export function parseGRPCConfig(): {
  GRPC_ENABLED: boolean;
  GRPC_PORT: number;
  GRPC_HOST: string;
  GRPC_MAX_RECEIVE_MESSAGE_SIZE: number;
  GRPC_MAX_SEND_MESSAGE_SIZE: number;
  GRPC_KEEPALIVE_TIME: number;
  GRPC_KEEPALIVE_TIMEOUT: number;
  GRPC_KEEPALIVE_WITHOUT_CALLS: boolean;
  GRPC_MAX_CONNECTION_IDLE: number;
  GRPC_MAX_CONNECTION_AGE: number;
  GRPC_MAX_CONNECTION_AGE_GRACE: number;
} {
  return {
    GRPC_ENABLED: parseBoolean(process.env.GRPC_ENABLED, true),
    GRPC_PORT: parseInt(process.env.GRPC_PORT, 50051),
    GRPC_HOST: process.env.GRPC_HOST ?? '0.0.0.0',
    GRPC_MAX_RECEIVE_MESSAGE_SIZE: parseInt(process.env.GRPC_MAX_RECEIVE_MESSAGE_SIZE, 4194304),
    GRPC_MAX_SEND_MESSAGE_SIZE: parseInt(process.env.GRPC_MAX_SEND_MESSAGE_SIZE, 4194304),
    GRPC_KEEPALIVE_TIME: parseInt(process.env.GRPC_KEEPALIVE_TIME, 7200000),
    GRPC_KEEPALIVE_TIMEOUT: parseInt(process.env.GRPC_KEEPALIVE_TIMEOUT, 20000),
    GRPC_KEEPALIVE_WITHOUT_CALLS: parseBoolean(process.env.GRPC_KEEPALIVE_WITHOUT_CALLS, false),
    GRPC_MAX_CONNECTION_IDLE: parseInt(process.env.GRPC_MAX_CONNECTION_IDLE, 3600000),
    GRPC_MAX_CONNECTION_AGE: parseInt(process.env.GRPC_MAX_CONNECTION_AGE, 86400000),
    GRPC_MAX_CONNECTION_AGE_GRACE: parseInt(process.env.GRPC_MAX_CONNECTION_AGE_GRACE, 5000),
  };
}

/**
 * Parse WebSocket configuration from environment
 */
export function parseWebSocketConfig(): {
  WS_ENABLED: boolean;
  WS_PATH: string;
  WS_HEARTBEAT_INTERVAL: number;
  WS_MAX_PAYLOAD: number;
} {
  return {
    WS_ENABLED: parseBoolean(process.env.WS_ENABLED, true),
    WS_PATH: process.env.WS_PATH ?? '/ws',
    WS_HEARTBEAT_INTERVAL: parseInt(process.env.WS_HEARTBEAT_INTERVAL, 30000),
    WS_MAX_PAYLOAD: parseInt(process.env.WS_MAX_PAYLOAD, 1048576),
  };
}

/**
 * Parse security headers configuration from environment
 */
export function parseSecurityHeadersConfig(): {
  SECURITY_HEADERS_ENABLED: boolean;
  HSTS_MAX_AGE: number;
  CSP_DIRECTIVES: Record<string, string>;
} {
  return {
    SECURITY_HEADERS_ENABLED: parseBoolean(process.env.SECURITY_HEADERS_ENABLED, true),
    HSTS_MAX_AGE: parseInt(process.env.HSTS_MAX_AGE, 31536000),
    CSP_DIRECTIVES: parseJSON<Record<string, string>>(process.env.CSP_DIRECTIVES, {}),
  };
}

/**
 * Parse Puppeteer configuration from environment
 */
export function parsePuppeteerConfig(): {
  PUPPETEER_HEADLESS: boolean;
  PUPPETEER_ARGS: string[];
  PUPPETEER_EXECUTABLE_PATH: string | undefined;
  PUPPETEER_USER_DATA_DIR: string | undefined;
  PUPPETEER_DEFAULT_VIEWPORT_WIDTH: number;
  PUPPETEER_DEFAULT_VIEWPORT_HEIGHT: number;
  PUPPETEER_SLOW_MO: number;
} {
  return {
    PUPPETEER_HEADLESS: parseBoolean(process.env.PUPPETEER_HEADLESS, true),
    PUPPETEER_ARGS: parseArray(process.env.PUPPETEER_ARGS, ['--no-sandbox', '--disable-setuid-sandbox']),
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
    PUPPETEER_USER_DATA_DIR: process.env.PUPPETEER_USER_DATA_DIR,
    PUPPETEER_DEFAULT_VIEWPORT_WIDTH: parseInt(process.env.PUPPETEER_DEFAULT_VIEWPORT_WIDTH, 1920),
    PUPPETEER_DEFAULT_VIEWPORT_HEIGHT: parseInt(process.env.PUPPETEER_DEFAULT_VIEWPORT_HEIGHT, 1080),
    PUPPETEER_SLOW_MO: parseInt(process.env.PUPPETEER_SLOW_MO, 0),
  };
}

// Re-export telemetry parser (moved to separate file due to size)
export { parseTelemetryConfig } from './telemetry-parser.js';