/**
 * Configuration schemas
 * @module core/config/schemas
 * @nist cm-7 "Least functionality"
 */

import { z } from 'zod';

// Server configuration schema
export const serverConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.number().int().positive().default(8443),
  HOST: z.string().default('0.0.0.0'),
  TRUST_PROXY: z.union([z.boolean(), z.string(), z.number()]).optional(),
});

// TLS Configuration schema
export const tlsConfigSchema = z.object({
  TLS_ENABLED: z.boolean().default(true),
  TLS_CERT_PATH: z.string().optional(),
  TLS_KEY_PATH: z.string().optional(),
  TLS_CA_PATH: z.string().optional(),
  TLS_MIN_VERSION: z.enum(['TLSv1.2', 'TLSv1.3']).default('TLSv1.2'),
});

// Logging configuration schema
export const loggingConfigSchema = z.object({
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  AUDIT_LOG_ENABLED: z.boolean().default(true),
  AUDIT_LOG_PATH: z.string().default('./logs/audit'),
});

// Security configuration schema
export const securityConfigSchema = z.object({
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_ALGORITHM: z.string().default('HS256'),
  ALLOWED_ORIGINS: z.array(z.string()).default(['https://localhost:8443']),
  TRUSTED_PROXIES: z.array(z.string()).default([]),
  ENABLE_INTRUSION_DETECTION: z.boolean().default(true),
  MAX_LOGIN_ATTEMPTS: z.number().int().positive().default(5),
  LOGIN_LOCKOUT_DURATION: z.number().int().positive().default(900000),
  ENABLE_ANOMALY_DETECTION: z.boolean().default(true),
  ENABLE_THREAT_INTEL: z.boolean().default(false),
});

// Session configuration schema
export const sessionConfigSchema = z.object({
  SESSION_STORE_TYPE: z.enum(['memory', 'redis']).default('memory'),
  SESSION_TIMEOUT: z.number().int().positive().default(86400000),
  SESSION_CLEANUP_INTERVAL: z.number().int().positive().default(900000),
  SESSION_MAX_AGE: z.number().int().positive().default(604800000),
  SESSION_SECRET: z.string(),
  SESSION_RENEWAL_THRESHOLD: z.number().int().positive().default(300000),
  ENABLE_SESSION_MONITORING: z.boolean().default(true),
  SESSION_STORE_MONITORING_ENABLED: z.boolean().default(true),
  SESSION_STORE_REPLICATION_ENABLED: z.boolean().default(false),
  SESSION_STORE_MIGRATION_ENABLED: z.boolean().default(false),
});

// Rate limiting configuration schema
export const rateLimitingConfigSchema = z.object({
  RATE_LIMIT_ENABLED: z.boolean().default(true),
  RATE_LIMIT_WINDOW: z.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.number().int().positive().default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.boolean().default(false),
  RATE_LIMIT_SKIP_FAILED_REQUESTS: z.boolean().default(false),
});

// Database configuration schema
export const databaseConfigSchema = z.object({
  DATABASE_TYPE: z.enum(['sqlite', 'postgres', 'mysql']).default('sqlite'),
  DATABASE_PATH: z.string().default('./data/app.db'),
  DATABASE_HOST: z.string().optional(),
  DATABASE_PORT: z.number().int().positive().optional(),
  DATABASE_NAME: z.string().optional(),
  DATABASE_USER: z.string().optional(),
  DATABASE_PASSWORD: z.string().optional(),
  DATABASE_SSL: z.boolean().default(false),
  DATABASE_POOL_MIN: z.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.number().int().positive().default(10),
});

// Redis configuration schema
export const redisConfigSchema = z.object({
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.number().int().nonnegative().default(0),
  REDIS_KEY_PREFIX: z.string().default('puppeteer-mcp:'),
  REDIS_ENABLE_TLS: z.boolean().default(false),
  REDIS_ENABLE_READY_CHECK: z.boolean().default(true),
  REDIS_CONNECT_TIMEOUT: z.number().int().positive().default(10000),
  REDIS_COMMAND_TIMEOUT: z.number().int().positive().default(5000),
  REDIS_KEEP_ALIVE: z.number().int().positive().default(30000),
  REDIS_RECONNECT_ON_ERROR: z.boolean().default(true),
  REDIS_MAX_RETRIES_PER_REQUEST: z.number().int().positive().default(3),
  REDIS_ENABLE_OFFLINE_QUEUE: z.boolean().default(true),
  REDIS_LAZY_CONNECT: z.boolean().default(false),
  REDIS_FAMILY: z.enum(['IPv4', 'IPv6']).default('IPv4'),
  REDIS_MAX_RETRIES: z.number().int().positive().default(3),
  REDIS_RETRY_DELAY: z.number().int().positive().default(100),
});

// CORS configuration schema
export const corsConfigSchema = z.object({
  CORS_ENABLED: z.boolean().default(true),
  CORS_CREDENTIALS: z.boolean().default(true),
  CORS_MAX_AGE: z.number().int().positive().default(86400),
  CORS_ALLOWED_METHODS: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
  CORS_ALLOWED_HEADERS: z
    .array(z.string())
    .default(['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-ID']),
  CORS_EXPOSED_HEADERS: z.array(z.string()).default(['X-Request-ID', 'X-RateLimit-Remaining']),
  CORS_ORIGIN: z.string().optional(),
});

// API configuration schema
export const apiConfigSchema = z.object({
  API_PREFIX: z.string().default('/api/v1'),
  API_TIMEOUT: z.number().int().positive().default(30000),
  API_MAX_PAYLOAD_SIZE: z.string().default('10mb'),
});

// gRPC configuration schema
export const grpcConfigSchema = z.object({
  GRPC_ENABLED: z.boolean().default(true),
  GRPC_PORT: z.number().int().positive().default(50051),
  GRPC_HOST: z.string().default('0.0.0.0'),
  GRPC_MAX_RECEIVE_MESSAGE_SIZE: z.number().int().positive().default(4194304),
  GRPC_MAX_SEND_MESSAGE_SIZE: z.number().int().positive().default(4194304),
  GRPC_KEEPALIVE_TIME: z.number().int().positive().default(7200000),
  GRPC_KEEPALIVE_TIMEOUT: z.number().int().positive().default(20000),
  GRPC_KEEPALIVE_WITHOUT_CALLS: z.boolean().default(false),
  GRPC_MAX_CONNECTION_IDLE: z.number().int().positive().default(3600000),
  GRPC_MAX_CONNECTION_AGE: z.number().int().positive().default(86400000),
  GRPC_MAX_CONNECTION_AGE_GRACE: z.number().int().positive().default(5000),
});

// WebSocket configuration schema
export const websocketConfigSchema = z.object({
  WS_ENABLED: z.boolean().default(true),
  WS_PATH: z.string().default('/ws'),
  WS_HEARTBEAT_INTERVAL: z.number().int().positive().default(30000),
  WS_MAX_PAYLOAD: z.number().int().positive().default(1048576),
});

// Security headers configuration schema
export const securityHeadersConfigSchema = z.object({
  SECURITY_HEADERS_ENABLED: z.boolean().default(true),
  HSTS_MAX_AGE: z.number().int().positive().default(31536000),
  CSP_DIRECTIVES: z.record(z.string()).default({}),
});

// Puppeteer configuration schema
export const puppeteerConfigSchema = z.object({
  PUPPETEER_HEADLESS: z.boolean().default(true),
  PUPPETEER_ARGS: z.array(z.string()).default(['--no-sandbox', '--disable-setuid-sandbox']),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  PUPPETEER_USER_DATA_DIR: z.string().optional(),
  PUPPETEER_DEFAULT_VIEWPORT_WIDTH: z.number().int().positive().default(1920),
  PUPPETEER_DEFAULT_VIEWPORT_HEIGHT: z.number().int().positive().default(1080),
  PUPPETEER_SLOW_MO: z.number().int().nonnegative().default(0),
  BROWSER_POOL_MAX_SIZE: z.number().int().positive().default(5),
  BROWSER_IDLE_TIMEOUT: z.number().int().positive().default(300000),
  PUPPETEER_DOWNLOAD_PATH: z.string().optional(),
  PUPPETEER_CACHE_ENABLED: z.boolean().default(true),
});

// Telemetry configuration schema
export const telemetryConfigSchema = z.object({
  TELEMETRY_ENABLED: z.boolean().default(false),
  TELEMETRY_SERVICE_NAME: z.string().default('puppeteer-mcp'),
  TELEMETRY_SERVICE_VERSION: z.string().default('1.0.0'),
  TELEMETRY_ENVIRONMENT: z.string().default('production'),
  TELEMETRY_DEPLOYMENT_ENVIRONMENT: z.string().optional(),
  TELEMETRY_EXPORTER_TYPE: z.enum(['console', 'otlp', 'jaeger', 'zipkin', 'none']).default('none'),
  TELEMETRY_EXPORTER_ENDPOINT: z.string().optional(),
  TELEMETRY_EXPORTER_HEADERS: z.record(z.string()).default({}),
  TELEMETRY_EXPORTER_TIMEOUT: z.number().int().positive().default(30000),
  TELEMETRY_EXPORTER_COMPRESSION: z.enum(['gzip', 'none']).default('none'),
  TELEMETRY_SAMPLING_RATIO: z.number().min(0).max(1).default(0.1),
  TELEMETRY_LOG_LEVEL: z
    .enum(['none', 'error', 'warn', 'info', 'debug', 'verbose', 'all'])
    .default('error'),
  TELEMETRY_METRICS_INTERVAL: z.number().int().positive().default(60000),
  TELEMETRY_METRICS_TIMEOUT: z.number().int().positive().default(30000),
  TELEMETRY_RESOURCE_ATTRIBUTES: z.record(z.string()).default({}),
  TELEMETRY_TRACE_ID_RATIO_BASED: z.boolean().default(true),
  TELEMETRY_TRACE_PARENT_BASED: z.boolean().default(true),
  TELEMETRY_PROPAGATORS: z.array(z.string()).default(['tracecontext', 'baggage']),
  TELEMETRY_INSTRUMENTATION_HTTP: z.boolean().default(true),
  TELEMETRY_INSTRUMENTATION_EXPRESS: z.boolean().default(true),
  TELEMETRY_INSTRUMENTATION_GRPC: z.boolean().default(true),
  TELEMETRY_INSTRUMENTATION_REDIS: z.boolean().default(true),
  TELEMETRY_INSTRUMENTATION_DNS: z.boolean().default(true),
  TELEMETRY_INSTRUMENTATION_NET: z.boolean().default(true),
  TELEMETRY_BATCH_SPAN_PROCESSOR: z.boolean().default(true),
  TELEMETRY_BATCH_MAX_QUEUE_SIZE: z.number().int().positive().default(2048),
  TELEMETRY_BATCH_MAX_EXPORT_BATCH_SIZE: z.number().int().positive().default(512),
  TELEMETRY_BATCH_SCHEDULED_DELAY: z.number().int().positive().default(5000),
  TELEMETRY_BATCH_EXPORT_TIMEOUT: z.number().int().positive().default(30000),
});

// Complete configuration schema combining all sections
export const configSchema = z.object({
  ...serverConfigSchema.shape,
  ...tlsConfigSchema.shape,
  ...loggingConfigSchema.shape,
  ...securityConfigSchema.shape,
  ...sessionConfigSchema.shape,
  ...rateLimitingConfigSchema.shape,
  ...databaseConfigSchema.shape,
  ...redisConfigSchema.shape,
  ...corsConfigSchema.shape,
  ...apiConfigSchema.shape,
  ...grpcConfigSchema.shape,
  ...websocketConfigSchema.shape,
  ...securityHeadersConfigSchema.shape,
  ...puppeteerConfigSchema.shape,
  ...telemetryConfigSchema.shape,
});

export type Config = z.infer<typeof configSchema>;
