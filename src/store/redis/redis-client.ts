/**
 * Redis client management and connection handling
 * @module store/redis/redis-client
 * @nist ac-12 "Session termination"
 * @nist sc-5 "Denial of service protection"
 */

import { getRedisClient, isRedisAvailable } from '../../utils/redis-client.js';
import type { RedisClient, RedisStoreInfo, FallbackStore, StoreLogger } from './types.js';

/**
 * Redis client manager with connection handling and fallback
 */
export class RedisClientManager {
  private logger: StoreLogger;
  private fallbackStore: FallbackStore;

  constructor(logger: StoreLogger, fallbackStore: FallbackStore) {
    this.logger = logger;
    this.fallbackStore = fallbackStore;
  }

  /**
   * Get the primary Redis client or fallback to in-memory store
   */
  getStore(): RedisStoreInfo {
    const redisClient = getRedisClient();
    if (redisClient && isRedisAvailable()) {
      return { redis: true, client: redisClient as RedisClient };
    }
    
    this.logger.warn('Redis unavailable, using in-memory fallback');
    return { redis: false, client: this.fallbackStore };
  }

  /**
   * Check if Redis is available and healthy
   */
  async isRedisHealthy(): Promise<boolean> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient || !isRedisAvailable()) {
        return false;
      }

      await redisClient.ping();
      return true;
    } catch (error) {
      this.logger.error({ error }, 'Redis health check failed');
      return false;
    }
  }

  /**
   * Get Redis connection info
   */
  getConnectionInfo(): { 
    connected: boolean; 
    client: RedisClient | null;
    fallbackAvailable: boolean;
  } {
    const redisClient = getRedisClient();
    const connected = redisClient && isRedisAvailable();
    
    return {
      connected: Boolean(connected),
      client: connected ? redisClient as RedisClient : null,
      fallbackAvailable: true
    };
  }

  /**
   * Execute operation with automatic fallback
   */
  async executeWithFallback<T>(
    operation: (client: RedisClient) => Promise<T>,
    fallbackOperation: (store: FallbackStore) => Promise<T>
  ): Promise<T> {
    const { redis, client } = this.getStore();

    try {
      if (redis) {
        return operation(client as RedisClient);
      } else {
        return await fallbackOperation(client as FallbackStore);
      }
    } catch (error) {
      this.logger.error({ error }, 'Redis operation failed');
      
      // If Redis operation failed, try fallback
      if (redis) {
        this.logger.warn('Falling back to in-memory store');
        return fallbackOperation(this.fallbackStore);
      }
      
      throw error;
    }
  }

  /**
   * Test Redis connection with detailed diagnostics
   */
  async testConnection(): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
    version?: string;
  }> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient || !isRedisAvailable()) {
        return {
          success: false,
          error: 'Redis not configured or unavailable'
        };
      }

      const start = Date.now();
      await redisClient.ping();
      const latency = Date.now() - start;

      return {
        success: true,
        latency
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}