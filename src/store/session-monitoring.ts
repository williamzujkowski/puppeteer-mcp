/**
 * Comprehensive monitoring and health checks for session persistence
 * @module store/session-monitoring
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { SessionStore } from './session-store.interface.js';
import type { SessionData } from '../types/session.js';
import { getRedisClient, isRedisAvailable, checkRedisHealth } from '../utils/redis-client.js';
import { pino } from 'pino';
import { EventEmitter } from 'events';

/**
 * Performance metrics for session operations
 */
export interface SessionMetrics {
  operations: {
    create: { count: number; avgLatency: number; errors: number };
    get: { count: number; avgLatency: number; errors: number; cacheMisses: number };
    update: { count: number; avgLatency: number; errors: number };
    delete: { count: number; avgLatency: number; errors: number };
    touch: { count: number; avgLatency: number; errors: number };
  };
  store: {
    type: string;
    available: boolean;
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  };
  redis?: {
    available: boolean;
    latency?: number;
    memoryUsage?: number;
    keyCount?: number;
    connections?: number;
  };
  fallback: {
    activations: number;
    lastActivation?: Date;
    totalFallbackTime: number;
  };
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    redis: {
      available: boolean;
      latency?: number;
      error?: string;
    };
    sessionStore: {
      available: boolean;
      latency?: number;
      error?: string;
    };
    fallback: {
      available: boolean;
      error?: string;
    };
  };
  metrics: SessionMetrics;
  alerts: Array<{
    level: 'warning' | 'critical';
    message: string;
    timestamp: Date;
  }>;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  healthCheckInterval: number;
  metricsRetentionPeriod: number;
  alertThresholds: {
    maxLatency: number;
    maxErrorRate: number;
    maxFallbackTime: number;
    minAvailability: number;
  };
  enableDetailedMetrics: boolean;
  enableAlerting: boolean;
}

/**
 * Session store monitoring system
 */
export class SessionStoreMonitor extends EventEmitter {
  private logger: pino.Logger;
  private config: MonitoringConfig;
  private metrics: SessionMetrics = {} as SessionMetrics;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsHistory: Array<{ timestamp: Date; metrics: SessionMetrics }> = [];
  private alertHistory: Array<{ timestamp: Date; level: string; message: string }> = [];
  private isRunning = false;
  private startTime = Date.now();

  constructor(
    private sessionStore: SessionStore,
    config: Partial<MonitoringConfig> = {},
    logger?: pino.Logger
  ) {
    super();
    this.logger = logger ?? pino({ level: 'info' });
    
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        maxLatency: 1000, // 1 second
        maxErrorRate: 0.05, // 5%
        maxFallbackTime: 300000, // 5 minutes
        minAvailability: 0.99 // 99%
      },
      enableDetailedMetrics: true,
      enableAlerting: true,
      ...config
    };

    this.initializeMetrics();
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): void {
    this.metrics = {
      operations: {
        create: { count: 0, avgLatency: 0, errors: 0 },
        get: { count: 0, avgLatency: 0, errors: 0, cacheMisses: 0 },
        update: { count: 0, avgLatency: 0, errors: 0 },
        delete: { count: 0, avgLatency: 0, errors: 0 },
        touch: { count: 0, avgLatency: 0, errors: 0 }
      },
      store: {
        type: this.sessionStore.constructor.name,
        available: true,
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0
      },
      fallback: {
        activations: 0,
        totalFallbackTime: 0
      }
    };
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();

    // Start health check interval
    this.healthCheckInterval = setInterval(() => {
      void this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Don't keep the process alive
    this.healthCheckInterval.unref();

    // Initial health check
    await this.performHealthCheck();

    this.logger.info('Session store monitoring started');
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    this.logger.info('Session store monitoring stopped');
  }

  /**
   * Record operation metrics
   */
  recordOperation(
    operation: keyof SessionMetrics['operations'],
    latency: number,
    _success: boolean,
    cacheMiss?: boolean
  ): void {
    if (!this.config.enableDetailedMetrics) {
      return;
    }

    const opMetrics = this.metrics.operations[operation];
    
    // Update count
    opMetrics.count++;
    
    // Update average latency
    opMetrics.avgLatency = (opMetrics.avgLatency * (opMetrics.count - 1) + latency) / opMetrics.count;
    
    // Update errors
    if (!_success) {
      opMetrics.errors++;
    }
    
    // Update cache misses for get operations
    if (operation === 'get' && cacheMiss) {
      (opMetrics as any).cacheMisses++;
    }

    // Check for alerts
    if (this.config.enableAlerting) {
      this.checkOperationAlerts(operation, latency, _success);
    }

    this.emit('operation:recorded', { operation, latency, success: _success, cacheMiss });
  }

  /**
   * Check for operation-level alerts
   */
  private checkOperationAlerts(
    operation: keyof SessionMetrics['operations'],
    latency: number,
    success: boolean
  ): void {
    const opMetrics = this.metrics.operations[operation];
    
    // High latency alert
    if (latency > this.config.alertThresholds.maxLatency) {
      this.raiseAlert('warning', `High latency detected for ${operation}: ${latency}ms`);
    }

    // High error rate alert
    if (opMetrics.count > 10) { // Only check after enough operations
      const errorRate = opMetrics.errors / opMetrics.count;
      if (errorRate > this.config.alertThresholds.maxErrorRate) {
        this.raiseAlert('critical', `High error rate for ${operation}: ${(errorRate * 100).toFixed(2)}%`);
      }
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date();
    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp,
      checks: {
        redis: { available: false },
        sessionStore: { available: false },
        fallback: { available: false }
      },
      metrics: this.metrics,
      alerts: []
    };

    // Check Redis health
    await this.checkRedisHealth(result);
    
    // Check session store health
    await this.checkSessionStoreHealth(result);
    
    // Check fallback health
    await this.checkFallbackHealth(result);

    // Update Redis metrics
    await this.updateRedisMetrics();

    // Update session store metrics
    await this.updateSessionStoreMetrics();

    // Determine overall status
    this.determineOverallStatus(result);

    // Store metrics history
    this.storeMetricsHistory();

    // Clean up old data
    this.cleanupOldData();

    this.emit('health:check', result);
    
    return result;
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(result: HealthCheckResult): Promise<void> {
    try {
      const redisHealth = await checkRedisHealth();
      
      result.checks.redis = {
        available: redisHealth.available,
        latency: redisHealth.latency,
        error: redisHealth.error
      };

      if (!redisHealth.available && redisHealth.error) {
        result.alerts.push({
          level: 'critical',
          message: `Redis unavailable: ${redisHealth.error}`,
          timestamp: new Date()
        });
      }

      if (redisHealth.latency && redisHealth.latency > this.config.alertThresholds.maxLatency) {
        result.alerts.push({
          level: 'warning',
          message: `Redis high latency: ${redisHealth.latency}ms`,
          timestamp: new Date()
        });
      }
    } catch (error) {
      result.checks.redis = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check session store health
   */
  private async checkSessionStoreHealth(result: HealthCheckResult): Promise<void> {
    try {
      const start = Date.now();
      
      // Test session store with a simple operation
      const testSessionData: SessionData = {
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
      
      result.checks.sessionStore = {
        available: true,
        latency
      };

      if (latency > this.config.alertThresholds.maxLatency) {
        result.alerts.push({
          level: 'warning',
          message: `Session store high latency: ${latency}ms`,
          timestamp: new Date()
        });
      }
    } catch (error) {
      result.checks.sessionStore = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      result.alerts.push({
        level: 'critical',
        message: `Session store unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Check fallback health
   */
  private async checkFallbackHealth(result: HealthCheckResult): Promise<void> {
    try {
      // For Redis session store, check if fallback is available
      if (this.sessionStore.constructor.name === 'RedisSessionStore') {
        const redisStore = this.sessionStore as any;
        const fallbackStore = redisStore.fallbackStore;
        
        if (fallbackStore) {
          const testSessionData: SessionData = {
            userId: 'fallback-health-check',
            username: 'fallback-health-check',
            roles: [],
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 1000).toISOString()
          };

          const testId = await fallbackStore.create(testSessionData);
          await fallbackStore.delete(testId);
          
          result.checks.fallback = { available: true };
        } else {
          result.checks.fallback = { available: false, error: 'No fallback store configured' };
        }
      } else {
        result.checks.fallback = { available: true };
      }
    } catch (error) {
      result.checks.fallback = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update Redis-specific metrics
   */
  private async updateRedisMetrics(): Promise<void> {
    const redisClient = getRedisClient();
    
    if (!redisClient || !isRedisAvailable()) {
      this.metrics.redis = { available: false };
      return;
    }

    try {
      const info = await redisClient.info();
      const keyCount = await redisClient.dbsize();
      
      // Parse memory usage from info
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch ? parseInt(memoryMatch[1], 10) : undefined;
      
      // Parse connection count
      const connectionsMatch = info.match(/connected_clients:(\d+)/);
      const connections = connectionsMatch ? parseInt(connectionsMatch[1], 10) : undefined;

      this.metrics.redis = {
        available: true,
        keyCount,
        memoryUsage,
        connections
      };
    } catch (error) {
      this.metrics.redis = {
        available: false
      };
    }
  }

  /**
   * Update session store metrics
   */
  private async updateSessionStoreMetrics(): Promise<void> {
    try {
      // Update basic store info
      this.metrics.store.type = this.sessionStore.constructor.name;
      this.metrics.store.available = true;

      // For Redis store, get session counts
      if (this.sessionStore.constructor.name === 'RedisSessionStore') {
        const redisStore = this.sessionStore as any;
        const { redis, client } = redisStore.getStore();
        
        if (redis) {
          const sessionKeys = await client.keys(`${redisStore.SESSION_KEY_PREFIX}*`);
          this.metrics.store.totalSessions = sessionKeys.length;
          
          // Count active sessions (non-expired)
          let activeSessions = 0;
          for (const key of sessionKeys) {
            const ttl = await client.ttl(key);
            if (ttl > 0) {
              activeSessions++;
            }
          }
          
          this.metrics.store.activeSessions = activeSessions;
          this.metrics.store.expiredSessions = this.metrics.store.totalSessions - activeSessions;
        }
      }
    } catch (error) {
      this.metrics.store.available = false;
      this.logger.error({ error }, 'Failed to update session store metrics');
    }
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(result: HealthCheckResult): void {
    const criticalAlerts = result.alerts.filter(a => a.level === 'critical');
    const warningAlerts = result.alerts.filter(a => a.level === 'warning');

    if (criticalAlerts.length > 0) {
      result.status = 'unhealthy';
    } else if (warningAlerts.length > 0 || !result.checks.redis.available) {
      result.status = 'degraded';
    } else {
      result.status = 'healthy';
    }
  }

  /**
   * Store metrics history
   */
  private storeMetricsHistory(): void {
    this.metricsHistory.push({
      timestamp: new Date(),
      metrics: JSON.parse(JSON.stringify(this.metrics))
    });
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod;
    
    // Clean up metrics history
    this.metricsHistory = this.metricsHistory.filter(
      entry => entry.timestamp.getTime() > cutoffTime
    );
    
    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(
      entry => entry.timestamp.getTime() > cutoffTime
    );
  }

  /**
   * Raise an alert
   */
  private raiseAlert(level: 'warning' | 'critical', message: string): void {
    const alert = {
      level,
      message,
      timestamp: new Date()
    };

    this.alertHistory.push(alert);
    
    this.logger[level === 'critical' ? 'error' : 'warn'](alert, `Session store alert: ${message}`);
    
    this.emit('alert', alert);
  }

  /**
   * Get current metrics
   */
  getMetrics(): SessionMetrics {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(since?: Date): Array<{ timestamp: Date; metrics: SessionMetrics }> {
    if (since) {
      return this.metricsHistory.filter(entry => entry.timestamp >= since);
    }
    return this.metricsHistory;
  }

  /**
   * Get alert history
   */
  getAlertHistory(since?: Date): Array<{ timestamp: Date; level: string; message: string }> {
    if (since) {
      return this.alertHistory.filter(entry => entry.timestamp >= since);
    }
    return this.alertHistory;
  }

  /**
   * Get uptime statistics
   */
  getUptimeStats(): {
    startTime: Date;
    uptime: number;
    availability: number;
  } {
    const uptime = Date.now() - this.startTime;
    
    // Calculate availability based on health checks
    const totalChecks = this.metricsHistory.length;
    const healthyChecks = this.metricsHistory.filter(entry => 
      entry.metrics.store.available
    ).length;
    
    const availability = totalChecks > 0 ? healthyChecks / totalChecks : 1;

    return {
      startTime: new Date(this.startTime),
      uptime,
      availability
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.initializeMetrics();
    this.metricsHistory = [];
    this.alertHistory = [];
    this.emit('metrics:reset');
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isRunning: boolean;
    config: MonitoringConfig;
    uptime: number;
    metricsCount: number;
    alertCount: number;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      uptime: Date.now() - this.startTime,
      metricsCount: this.metricsHistory.length,
      alertCount: this.alertHistory.length
    };
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    prometheus?: string;
    json: SessionMetrics;
  } {
    const prometheusMetrics = this.generatePrometheusMetrics();
    
    return {
      prometheus: prometheusMetrics,
      json: this.getMetrics()
    };
  }

  /**
   * Generate Prometheus-compatible metrics
   */
  private generatePrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    // Operation metrics
    for (const [operation, opMetrics] of Object.entries(metrics.operations)) {
      lines.push(`# HELP session_operation_total Total number of session operations`);
      lines.push(`# TYPE session_operation_total counter`);
      lines.push(`session_operation_total{operation="${operation}"} ${opMetrics.count}`);

      lines.push(`# HELP session_operation_latency_seconds Average latency of session operations`);
      lines.push(`# TYPE session_operation_latency_seconds gauge`);
      lines.push(`session_operation_latency_seconds{operation="${operation}"} ${opMetrics.avgLatency / 1000}`);

      lines.push(`# HELP session_operation_errors_total Total number of session operation errors`);
      lines.push(`# TYPE session_operation_errors_total counter`);
      lines.push(`session_operation_errors_total{operation="${operation}"} ${opMetrics.errors}`);
    }

    // Store metrics
    lines.push(`# HELP session_store_available Whether the session store is available`);
    lines.push(`# TYPE session_store_available gauge`);
    lines.push(`session_store_available{type="${metrics.store.type}"} ${metrics.store.available ? 1 : 0}`);

    lines.push(`# HELP session_store_total_sessions Total number of sessions in store`);
    lines.push(`# TYPE session_store_total_sessions gauge`);
    lines.push(`session_store_total_sessions{type="${metrics.store.type}"} ${metrics.store.totalSessions}`);

    lines.push(`# HELP session_store_active_sessions Number of active sessions in store`);
    lines.push(`# TYPE session_store_active_sessions gauge`);
    lines.push(`session_store_active_sessions{type="${metrics.store.type}"} ${metrics.store.activeSessions}`);

    // Redis metrics
    if (metrics.redis) {
      lines.push(`# HELP redis_available Whether Redis is available`);
      lines.push(`# TYPE redis_available gauge`);
      lines.push(`redis_available ${metrics.redis.available ? 1 : 0}`);

      if (metrics.redis.keyCount !== undefined) {
        lines.push(`# HELP redis_keys_total Total number of keys in Redis`);
        lines.push(`# TYPE redis_keys_total gauge`);
        lines.push(`redis_keys_total ${metrics.redis.keyCount}`);
      }

      if (metrics.redis.memoryUsage !== undefined) {
        lines.push(`# HELP redis_memory_usage_bytes Memory usage of Redis`);
        lines.push(`# TYPE redis_memory_usage_bytes gauge`);
        lines.push(`redis_memory_usage_bytes ${metrics.redis.memoryUsage}`);
      }
    }

    // Fallback metrics
    lines.push(`# HELP session_fallback_activations_total Total number of fallback activations`);
    lines.push(`# TYPE session_fallback_activations_total counter`);
    lines.push(`session_fallback_activations_total ${metrics.fallback.activations}`);

    return lines.join('\n');
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
    this.metricsHistory = [];
    this.alertHistory = [];
    this.logger.info('Session store monitor destroyed');
  }
}