/**
 * Redis client for distributed operations
 * @module utils/redis-client
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist sc-28 "Protection of information at rest"
 */

import Redis, { RedisOptions } from 'ioredis';
import { config } from '../core/config.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;
let isConnected = false;

/**
 * Get Redis options from configuration
 */
function getRedisOptions(): RedisOptions {
  const options: RedisOptions = {
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      logger.debug({ attempt: times, delay }, 'Redis retry strategy');
      return delay;
    },
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
    keyPrefix: config.REDIS_KEY_PREFIX,
    lazyConnect: true,
  };

  // Parse Redis URL if provided
  if (config.REDIS_URL !== undefined && config.REDIS_URL !== null && config.REDIS_URL !== '') {
    try {
      const url = new URL(config.REDIS_URL);
      options.host = url.hostname;
      options.port = parseInt(url.port || '6379', 10);
      if (url.password !== '') {
        options.password = url.password;
      }
      if (url.username !== '') {
        options.username = url.username;
      }

      // Enable TLS if specified
      if (config.REDIS_TLS) {
        options.tls = {};
      }
    } catch (error) {
      logger.error({ error }, 'Failed to parse Redis URL');
      throw new Error('Invalid Redis URL configuration');
    }
  }

  return options;
}

/**
 * Initialize Redis client
 */
export async function initializeRedis(): Promise<Redis | null> {
  // Skip Redis if no URL is configured
  if (config.REDIS_URL === undefined || config.REDIS_URL === null || config.REDIS_URL === '') {
    logger.info('Redis URL not configured, using in-memory storage');
    return null;
  }

  if (redisClient !== null && isConnected) {
    return redisClient;
  }

  try {
    const options = getRedisOptions();
    redisClient = new Redis(options);

    // Set up event handlers
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (error) => {
      logger.error({ error }, 'Redis client error');
      isConnected = false;
    });

    redisClient.on('close', () => {
      logger.info('Redis client disconnected');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });

    // Connect to Redis
    await redisClient.connect();

    // Test the connection
    await redisClient.ping();

    return redisClient;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Redis client');
    redisClient = null;
    isConnected = false;
    return null;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): Redis | null {
  if (
    redisClient === null ||
    !isConnected ||
    config.REDIS_URL === undefined ||
    config.REDIS_URL === null ||
    config.REDIS_URL === ''
  ) {
    return null;
  }
  return redisClient;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && isConnected;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient !== null) {
    try {
      await redisClient.quit();
      logger.info('Redis client closed');
    } catch (error) {
      logger.error({ error }, 'Error closing Redis client');
      // Force disconnect if quit fails
      redisClient.disconnect();
    } finally {
      redisClient = null;
      isConnected = false;
    }
  }
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<{
  available: boolean;
  latency?: number;
  error?: string;
}> {
  if (redisClient === null || !isConnected) {
    return { available: false, error: 'Redis not connected' };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;
    return { available: true, latency };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  if (redisClient === null || !isConnected) {
    return false;
  }

  try {
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
}
