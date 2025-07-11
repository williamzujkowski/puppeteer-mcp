/**
 * Session health monitoring and status checking
 * @module store/monitoring/session-health-checker
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { SessionStore } from '../session-store.interface.js';
import type {
  HealthCheckResult,
  HealthChecks,
  Alert,
  TestSessionData
} from './types.js';
import { checkRedisHealth } from '../../utils/redis-client.js';
import { pino } from 'pino';

/**
 * Session health checker
 */
export class SessionHealthChecker {
  private _logger: pino.Logger;

  constructor(
    private sessionStore: SessionStore,
    logger?: pino.Logger
  ) {
    this._logger = logger ?? pino({ level: 'info' });
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(
    alertThresholds: { maxLatency: number }
  ): Promise<HealthCheckResult> {
    const timestamp = new Date();
    const checks: HealthChecks = {
      redis: { available: false },
      sessionStore: { available: false },
      fallback: { available: false }
    };
    const alerts: Alert[] = [];

    // Check Redis health
    await this.checkRedisHealth(checks, alerts, alertThresholds);
    
    // Check session store health
    await this.checkSessionStoreHealth(checks, alerts, alertThresholds);
    
    // Check fallback health
    await this.checkFallbackHealth(checks);

    // Determine overall status
    const status = this.determineOverallStatus(alerts, checks);

    return {
      status,
      timestamp,
      checks,
      metrics: {} as any, // Will be populated by metrics collector
      alerts
    };
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(
    checks: HealthChecks,
    alerts: Alert[],
    thresholds: { maxLatency: number }
  ): Promise<void> {
    try {
      const redisHealth = await checkRedisHealth();
      
      checks.redis = {
        available: redisHealth.available,
        latency: redisHealth.latency,
        error: redisHealth.error
      };

      if (!redisHealth.available && redisHealth.error) {
        alerts.push({
          level: 'critical',
          message: `Redis unavailable: ${redisHealth.error}`,
          timestamp: new Date()
        });
      }

      if (redisHealth.latency && redisHealth.latency > thresholds.maxLatency) {
        alerts.push({
          level: 'warning',
          message: `Redis high latency: ${redisHealth.latency}ms`,
          timestamp: new Date()
        });
      }
    } catch (error) {
      checks.redis = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check session store health
   */
  private async checkSessionStoreHealth(
    checks: HealthChecks,
    alerts: Alert[],
    thresholds: { maxLatency: number }
  ): Promise<void> {
    try {
      const start = Date.now();
      
      // Test session store with a simple operation
      const testSessionData: TestSessionData = {
        userId: 'health-check',
        username: 'health-check',
        roles: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000).toISOString()
      };

      const testId = await this.sessionStore.create(testSessionData);
      await this.sessionStore.get(testId);
      await this.sessionStore.delete(testId);
      
      const latency = Date.now() - start;
      
      checks.sessionStore = {
        available: true,
        latency
      };

      if (latency > thresholds.maxLatency) {
        alerts.push({
          level: 'warning',
          message: `Session store high latency: ${latency}ms`,
          timestamp: new Date()
        });
      }
    } catch (error) {
      checks.sessionStore = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      alerts.push({
        level: 'critical',
        message: `Session store unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Check fallback health
   */
  private async checkFallbackHealth(checks: HealthChecks): Promise<void> {
    try {
      if (this.sessionStore.constructor.name !== 'RedisSessionStore') {
        checks.fallback = { available: true };
        return;
      }

      const redisStore = this.sessionStore as { fallbackStore?: any };
      const fallbackStore = redisStore.fallbackStore;
      
      if (!fallbackStore) {
        checks.fallback = { available: false, error: 'No fallback store configured' };
        return;
      }

      await this.testFallbackStore(fallbackStore);
      checks.fallback = { available: true };
    } catch (error) {
      checks.fallback = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test fallback store
   */
  private async testFallbackStore(fallbackStore: { create: (data: TestSessionData) => Promise<string>; delete: (id: string) => Promise<void> }): Promise<void> {
    const testSessionData: TestSessionData = {
      userId: 'fallback-health-check',
      username: 'fallback-health-check',
      roles: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000).toISOString()
    };

    const testId = await fallbackStore.create(testSessionData);
    await fallbackStore.delete(testId);
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(
    alerts: Alert[],
    checks: HealthChecks
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const criticalAlerts = alerts.filter(a => a.level === 'critical');
    const warningAlerts = alerts.filter(a => a.level === 'warning');

    if (criticalAlerts.length > 0) {
      return 'unhealthy';
    } else if (warningAlerts.length > 0 || !checks.redis.available) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}