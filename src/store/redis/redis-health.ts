/**
 * Redis health monitoring and connection status
 * @module store/redis/redis-health
 * @nist sc-5 "Denial of service protection"
 */

import type { RedisClient, StoreLogger, RedisHealthResult, HealthCheckResult } from './types.js';
import { getRedisClient, isRedisAvailable } from '../../utils/redis-client.js';

/**
 * Redis health monitoring and status checking
 */
export class RedisHealthMonitor {
  private logger: StoreLogger;
  private healthHistory: RedisHealthResult[] = [];
  private readonly MAX_HISTORY_SIZE = 100;

  constructor(logger: StoreLogger) {
    this.logger = logger;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const redisHealth = await this.checkRedisHealth();
    
    // Record health status in history
    this.recordHealthStatus(redisHealth);

    return {
      redis: redisHealth,
      fallback: { available: true }, // In-memory fallback is always available
    };
  }

  /**
   * Check Redis health with detailed diagnostics
   */
  async checkRedisHealth(): Promise<RedisHealthResult> {
    const redisClient = getRedisClient();
    
    if (!redisClient || !isRedisAvailable()) {
      return {
        available: false,
        error: 'Redis not configured or unavailable'
      };
    }

    try {
      const start = Date.now();
      await redisClient.ping();
      const latency = Date.now() - start;
      
      return {
        available: true,
        latency
      };
    } catch (error) {
      const healthResult: RedisHealthResult = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      this.logger.error({ error }, 'Redis health check failed');
      return healthResult;
    }
  }

  /**
   * Check if Redis is responding within acceptable latency
   */
  async isRedisHealthy(maxLatencyMs: number = 1000): Promise<boolean> {
    const health = await this.checkRedisHealth();
    return health.available && (health.latency ?? 0) <= maxLatencyMs;
  }

  /**
   * Get Redis connection statistics
   */
  async getConnectionStats(): Promise<{
    isConnected: boolean;
    latency?: number;
    uptime?: number;
    lastCheck: string;
  }> {
    const health = await this.checkRedisHealth();
    
    return {
      isConnected: health.available,
      latency: health.latency,
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * Monitor Redis health continuously
   */
  startHealthMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
    const interval = setInterval(() => {
      void (async () => {
        try {
          const health = await this.checkRedisHealth();
          this.recordHealthStatus(health);
          
          if (!health.available) {
            this.logger.warn({ health }, 'Redis health check failed during monitoring');
          }
        } catch (error) {
          this.logger.error({ error }, 'Error during health monitoring');
        }
      })();
    }, intervalMs);

    // Don't keep process alive
    interval.unref();
    
    this.logger.info({ intervalMs }, 'Started Redis health monitoring');
    return interval;
  }

  /**
   * Get health trends and statistics
   */
  getHealthTrends(): {
    availability: number;
    averageLatency: number;
    recentFailures: number;
    totalChecks: number;
  } {
    if (this.healthHistory.length === 0) {
      return {
        availability: 0,
        averageLatency: 0,
        recentFailures: 0,
        totalChecks: 0
      };
    }

    const totalChecks = this.healthHistory.length;
    const availableChecks = this.healthHistory.filter(h => h.available).length;
    const availability = (availableChecks / totalChecks) * 100;
    
    const latencies = this.healthHistory
      .filter(h => h.available && h.latency !== undefined)
      .map(h => h.latency as number);
    
    const averageLatency = latencies.length > 0 
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
      : 0;

    // Recent failures in last 10 checks
    const recentChecks = this.healthHistory.slice(-10);
    const recentFailures = recentChecks.filter(h => !h.available).length;

    return {
      availability,
      averageLatency,
      recentFailures,
      totalChecks
    };
  }

  /**
   * Check if Redis is in degraded state
   */
  isDegraded(): boolean {
    const trends = this.getHealthTrends();
    
    // Consider degraded if:
    // - Availability < 95% in recent checks
    // - Average latency > 500ms
    // - More than 3 recent failures
    return trends.availability < 95 || 
           trends.averageLatency > 500 || 
           trends.recentFailures > 3;
  }

  /**
   * Get detailed health report
   */
  getHealthReport(): {
    current: RedisHealthResult;
    trends: ReturnType<typeof this.getHealthTrends>;
    isDegraded: boolean;
    recommendations: string[];
  } {
    const current = this.healthHistory[this.healthHistory.length - 1] ?? {
      available: false,
      error: 'No health data available'
    };
    
    const trends = this.getHealthTrends();
    const isDegraded = this.isDegraded();
    
    const recommendations: string[] = [];
    
    if (!current.available) {
      recommendations.push('Check Redis server status and configuration');
    }
    
    if (trends.averageLatency > 200) {
      recommendations.push('Consider Redis performance optimization');
    }
    
    if (trends.recentFailures > 1) {
      recommendations.push('Investigate connection stability issues');
    }
    
    if (trends.availability < 99) {
      recommendations.push('Review Redis deployment and monitoring');
    }

    return {
      current,
      trends,
      isDegraded,
      recommendations
    };
  }

  /**
   * Reset health monitoring history
   */
  resetHealthHistory(): void {
    this.healthHistory = [];
    this.logger.info('Redis health history reset');
  }

  /**
   * Record health status in history
   */
  private recordHealthStatus(health: RedisHealthResult): void {
    this.healthHistory.push({
      ...health,
      // Add timestamp if not present
      ...(health as any).timestamp ? {} : { timestamp: new Date().toISOString() }
    });

    // Maintain maximum history size
    if (this.healthHistory.length > this.MAX_HISTORY_SIZE) {
      this.healthHistory = this.healthHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Test Redis functionality beyond ping
   */
  async performDetailedHealthCheck(): Promise<{
    ping: boolean;
    read: boolean;
    write: boolean;
    delete: boolean;
    latency: number;
  }> {
    const testKey = `health_check_${Date.now()}`;
    const testValue = 'health_check_value';
    const start = Date.now();
    
    const result = {
      ping: false,
      read: false,
      write: false,
      delete: false,
      latency: 0
    };

    try {
      const redisClient = getRedisClient() as RedisClient;
      
      // Test ping
      await redisClient.ping();
      result.ping = true;
      
      // Test write
      await redisClient.setex(testKey, 60, testValue);
      result.write = true;
      
      // Test read
      const retrieved = await redisClient.get(testKey);
      result.read = retrieved === testValue;
      
      // Test delete
      const deleted = await redisClient.del(testKey);
      result.delete = deleted === 1;
      
      result.latency = Date.now() - start;
      
    } catch (error) {
      this.logger.error({ error }, 'Detailed health check failed');
    }

    return result;
  }
}