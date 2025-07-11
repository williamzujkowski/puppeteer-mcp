/**
 * Cache management for circuit breaker fallback
 * @module puppeteer/pool/circuit-breaker/cache-manager
 * @nist si-4 "Information system monitoring"
 * @nist cp-10 "Information system recovery and reconstitution"
 */

import { createLogger } from '../../../utils/logger.js';
import { CacheOperations } from './cache-operations.js';

const logger = createLogger('circuit-breaker-cache');

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: number;
  maxAge: number; // milliseconds
  enableAutoCleanup: boolean;
  cleanupInterval: number; // milliseconds
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 100,
  maxAge: 3600000, // 1 hour
  enableAutoCleanup: true,
  cleanupInterval: 300000, // 5 minutes
};

// Re-export CacheStats from cache-operations
export type { CacheStats } from './cache-operations.js';

/**
 * LRU cache manager for circuit breaker fallback
 * @nist cp-10 "Information system recovery and reconstitution"
 */
export class CacheManager<T = any> extends CacheOperations<T> {
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    name: string,
    private config: CacheConfig = DEFAULT_CACHE_CONFIG,
  ) {
    super(name, config.maxSize, config.maxAge);
    if (config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    this.maxSize = this.config.maxSize;
    this.maxAge = this.config.maxAge;

    // Handle auto-cleanup changes
    if (oldConfig.enableAutoCleanup && !this.config.enableAutoCleanup) {
      this.stopAutoCleanup();
    } else if (!oldConfig.enableAutoCleanup && this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    } else if (oldConfig.cleanupInterval !== this.config.cleanupInterval) {
      this.stopAutoCleanup();
      this.startAutoCleanup();
    }

    logger.info(
      {
        cache: this.name,
        oldConfig,
        newConfig: this.config,
      },
      'Cache configuration updated',
    );
  }

  /**
   * Warm up cache with pre-computed values
   */
  warmUp(entries: Array<{ key: string; value: T }>): void {
    for (const { key, value } of entries) {
      this.set(key, value);
    }

    logger.info(
      {
        cache: this.name,
        entriesCount: entries.length,
      },
      'Cache warmed up',
    );
  }

  /**
   * Start automatic cleanup
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop automatic cleanup
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clear();

    logger.info(
      {
        cache: this.name,
        finalStats: this.getStats(),
      },
      'Cache manager destroyed',
    );
  }
}
