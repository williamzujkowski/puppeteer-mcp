/**
 * Redis configuration parser
 * @module core/config/redis-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean, parseInt } from './base-parsers.js';

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
  REDIS_ENABLE_OFFLINE_QUEUE: boolean;
  REDIS_LAZY_CONNECT: boolean;
  REDIS_FAMILY: 'IPv4' | 'IPv6';
  REDIS_MAX_RETRIES: number;
  REDIS_RETRY_DELAY: number;
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
    REDIS_MAX_RETRIES: parseInt(process.env.REDIS_MAX_RETRIES, 3),
    REDIS_RETRY_DELAY: parseInt(process.env.REDIS_RETRY_DELAY, 100),
  };
}