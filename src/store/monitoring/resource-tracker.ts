/**
 * Resource usage tracking for sessions
 * @module store/monitoring/resource-tracker
 * @nist au-3 "Content of audit records"
 */

import type { SessionStore } from '../session-store.interface.js';
import type { RedisMetrics, StoreMetrics } from './types.js';
import { getRedisClient, isRedisAvailable } from '../../utils/redis-client.js';
import { pino } from 'pino';

/**
 * Resource usage information
 */
export interface ResourceUsage {
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  sessions: {
    count: number;
    avgSize: number;
    totalSize: number;
  };
}

/**
 * Resource tracker for session monitoring
 */
export class ResourceTracker {
  private logger: pino.Logger;

  constructor(
    private sessionStore: SessionStore,
    logger?: pino.Logger
  ) {
    this.logger = logger ?? pino({ level: 'info' });
  }

  /**
   * Get current resource usage
   */
  async getResourceUsage(): Promise<ResourceUsage> {
    const memoryUsage = process.memoryUsage();
    
    return {
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      sessions: await this.getSessionResourceUsage()
    };
  }

  /**
   * Get session-specific resource usage
   */
  private async getSessionResourceUsage(): Promise<ResourceUsage['sessions']> {
    try {
      if (this.sessionStore.constructor.name === 'RedisSessionStore') {
        return await this.getRedisSessionUsage();
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to get session resource usage');
    }
    return { count: 0, avgSize: 0, totalSize: 0 };
  }

  /**
   * Get Redis-specific session usage
   */
  private async getRedisSessionUsage(): Promise<ResourceUsage['sessions']> {
    const redisStore = this.sessionStore as any;
    const { redis, client } = redisStore.getStore();
    
    if (!redis || !client) {
      return { count: 0, avgSize: 0, totalSize: 0 };
    }

    const sessionKeys = await client.keys(`${redisStore.SESSION_KEY_PREFIX}*`);
    const count = sessionKeys.length;

    // Sample sessions to estimate average size
    const sampleSize = Math.min(10, count);
    let sampledSize = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const key = sessionKeys[i];
      if (key) {
        const value = await client.get(key) as string | null;
        if (value) {
          sampledSize += Buffer.byteLength(value, 'utf8');
        }
      }
    }

    const avgSize = sampleSize > 0 ? sampledSize / sampleSize : 0;
    const totalSize = avgSize * count;

    return { count, avgSize, totalSize };
  }

  /**
   * Update Redis metrics
   */
  async updateRedisMetrics(): Promise<RedisMetrics | undefined> {
    const redisClient = getRedisClient();
    
    if (!redisClient || !isRedisAvailable()) {
      return { available: false };
    }

    try {
      const [info, keyCount] = await Promise.all([
        redisClient.info(),
        redisClient.dbsize()
      ]);
      
      return {
        available: true,
        keyCount,
        memoryUsage: this.parseInfoValue(info, 'used_memory'),
        connections: this.parseInfoValue(info, 'connected_clients')
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to update Redis metrics');
      return { available: false };
    }
  }

  /**
   * Parse value from Redis info string
   */
  private parseInfoValue(info: string | undefined, key: string): number | undefined {
    if (!info) return undefined;
    const match = info.match(new RegExp(`${key}:(\\d+)`));
    return match?.[1] ? parseInt(match[1], 10) : undefined;
  }

  /**
   * Update session store metrics
   */
  async updateStoreMetrics(): Promise<Partial<StoreMetrics>> {
    const updates: Partial<StoreMetrics> = {
      type: this.sessionStore.constructor.name,
      available: true
    };

    try {
      // For Redis store, get session counts
      if (this.sessionStore.constructor.name === 'RedisSessionStore') {
        const redisStore = this.sessionStore as any;
        const { redis, client } = redisStore.getStore();
        
        if (redis && client) {
          const sessionKeys = await client.keys(`${redisStore.SESSION_KEY_PREFIX}*`);
          updates.totalSessions = sessionKeys.length;
          
          // Count active sessions (non-expired)
          let activeSessions = 0;
          let expiredSessions = 0;
          
          for (const key of sessionKeys) {
            const ttl = await client.ttl(key);
            if (ttl > 0) {
              activeSessions++;
            } else if (ttl === -1) {
              // No expiration set
              activeSessions++;
            } else {
              expiredSessions++;
            }
          }
          
          updates.activeSessions = activeSessions;
          updates.expiredSessions = expiredSessions;
        }
      }
    } catch (error) {
      updates.available = false;
      this.logger.error({ error }, 'Failed to update session store metrics');
    }

    return updates;
  }

  /**
   * Check if resources are within limits
   */
  checkResourceLimits(
    maxMemoryMB: number = 1024,
    _maxSessions: number = 10000
  ): { withinLimits: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let withinLimits = true;

    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.rss / (1024 * 1024);

    if (memoryMB > maxMemoryMB) {
      warnings.push(`Memory usage (${memoryMB.toFixed(2)}MB) exceeds limit (${maxMemoryMB}MB)`);
      withinLimits = false;
    }

    // This would need to be async in a real implementation
    // For now, just return the check structure
    return { withinLimits, warnings };
  }

  /**
   * Get resource utilization percentage
   */
  getResourceUtilization(): {
    memory: number;
    sessions: number;
  } {
    const memoryUsage = process.memoryUsage();
    const maxHeap = memoryUsage.heapTotal;
    const usedHeap = memoryUsage.heapUsed;
    
    return {
      memory: maxHeap > 0 ? (usedHeap / maxHeap) * 100 : 0,
      sessions: 0 // Would need max session limit to calculate
    };
  }
}