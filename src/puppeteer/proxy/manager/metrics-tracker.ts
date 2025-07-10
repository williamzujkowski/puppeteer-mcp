/**
 * Proxy metrics tracking
 * @module puppeteer/proxy/manager/metrics-tracker
 * @nist si-4 "Information system monitoring"
 */

import type { ProxyInstance } from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('proxy-metrics-tracker');

/**
 * Tracks and updates proxy metrics
 */
export class ProxyMetricsTracker {
  /**
   * Record a failed request
   */
  recordFailure(proxy: ProxyInstance, error: string): void {
    proxy.metrics.requestCount++;
    proxy.metrics.failureCount++;
    proxy.metrics.lastUsed = new Date();

    // Update health status
    proxy.health.consecutiveFailures++;
    if (proxy.health.consecutiveFailures >= 3) {
      proxy.health.healthy = false;
      proxy.health.lastError = error;
    }

    logger.warn({
      msg: 'Proxy request failed',
      proxyId: proxy.id,
      error,
      consecutiveFailures: proxy.health.consecutiveFailures,
    });
  }

  /**
   * Record a successful request
   */
  recordSuccess(proxy: ProxyInstance, responseTime: number): void {
    proxy.metrics.requestCount++;
    proxy.metrics.successCount++;
    proxy.metrics.lastUsed = new Date();
    proxy.health.consecutiveFailures = 0;

    // Update average response time
    const totalRequests = proxy.metrics.requestCount;
    proxy.metrics.averageResponseTime =
      (proxy.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    // Mark as healthy if it was unhealthy
    if (!proxy.health.healthy) {
      proxy.health.healthy = true;
      delete proxy.health.lastError;
    }
  }

  /**
   * Get proxy performance score
   */
  getPerformanceScore(proxy: ProxyInstance): number {
    const { metrics, health } = proxy;
    
    if (!health.healthy) return 0;
    
    const successRate = metrics.requestCount > 0
      ? metrics.successCount / metrics.requestCount
      : 1;
    
    const responseTimeScore = Math.max(0, 1 - metrics.averageResponseTime / 10000);
    
    return (successRate * 0.7 + responseTimeScore * 0.3);
  }

  /**
   * Get pool statistics
   */
  getPoolStats(proxies: ProxyInstance[]): {
    total: number;
    healthy: number;
    unhealthy: number;
    averageResponseTime: number;
    totalRequests: number;
    successRate: number;
  } {
    const stats = {
      total: proxies.length,
      healthy: 0,
      unhealthy: 0,
      averageResponseTime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      successRate: 0,
    };

    for (const proxy of proxies) {
      if (proxy.health.healthy) {
        stats.healthy++;
      } else {
        stats.unhealthy++;
      }

      stats.totalRequests += proxy.metrics.requestCount;
      stats.successfulRequests += proxy.metrics.successCount;
      stats.averageResponseTime += proxy.metrics.averageResponseTime;
    }

    if (stats.healthy > 0) {
      stats.averageResponseTime /= stats.healthy;
    }

    if (stats.totalRequests > 0) {
      stats.successRate = stats.successfulRequests / stats.totalRequests;
    }

    return {
      total: stats.total,
      healthy: stats.healthy,
      unhealthy: stats.unhealthy,
      averageResponseTime: stats.averageResponseTime,
      totalRequests: stats.totalRequests,
      successRate: stats.successRate,
    };
  }
}