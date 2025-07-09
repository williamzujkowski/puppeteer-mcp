/**
 * Cache operations and utilities
 * @module puppeteer/pool/circuit-breaker/cache-operations
 * @nist cp-10 "Information system recovery and reconstitution"
 */

import { CacheEntry } from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('circuit-breaker-cache-ops');

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

/**
 * Cache operations class
 */
export class CacheOperations<T = any> {
  protected cache: Map<string, CacheEntry<T>> = new Map();
  protected accessOrder: string[] = [];
  protected stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(
    protected name: string,
    protected maxSize: number,
    protected maxAge: number
  ) {}

  /**
   * Get cached value
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access order (LRU)
    this.updateAccessOrder(key);
    this.stats.hits++;
    
    logger.debug({
      cache: this.name,
      key,
      age: Date.now() - entry.timestamp.getTime(),
    }, 'Cache hit');

    return entry.result;
  }

  /**
   * Set cached value
   */
  set(key: string, value: T): void {
    // Check if we need to evict
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      result: value,
      timestamp: new Date(),
    });

    this.updateAccessOrder(key);

    logger.debug({
      cache: this.name,
      key,
      cacheSize: this.cache.size,
    }, 'Value cached');
  }

  /**
   * Delete cached value
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }
    return deleted;
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    
    logger.info({
      cache: this.name,
      clearedEntries: previousSize,
    }, 'Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate,
    };
  }

  /**
   * Get all cached keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if entry is expired
   */
  protected isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp.getTime() > this.maxAge;
  }

  /**
   * Update access order for LRU
   */
  protected updateAccessOrder(key: string): void {
    // Remove from current position
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used entry
   */
  protected evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
      
      logger.debug({
        cache: this.name,
        evictedKey: lruKey,
        cacheSize: this.cache.size,
      }, 'LRU entry evicted');
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug({
        cache: this.name,
        expiredCount: expiredKeys.length,
        remainingSize: this.cache.size,
      }, 'Expired entries cleaned up');
    }
  }
}