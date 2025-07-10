/**
 * Health metrics collection
 * @module ws/websocket/health/metrics-collector
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 * @nist si-4 "System monitoring"
 */

import type { pino } from 'pino';
import type { HealthMetrics, HealthCheckContext } from './types.js';

/**
 * Metrics tracking data
 */
interface MetricsData {
  messagesProcessed: number;
  errorsCount: number;
  lastErrorTime?: number;
  responseTimes: number[];
  connectionStats: {
    connected: number;
    disconnected: number;
    periodStart: number;
  };
  startTime: number;
}

/**
 * Collects and manages health metrics
 * @nist si-4 "System monitoring"
 */
export class MetricsCollector {
  private logger: pino.Logger;
  private data: MetricsData;
  private readonly maxResponseTimeSamples: number;

  constructor(logger: pino.Logger, maxResponseTimeSamples = 100) {
    this.logger = logger.child({ module: 'metrics-collector' });
    this.maxResponseTimeSamples = maxResponseTimeSamples;
    this.data = {
      messagesProcessed: 0,
      errorsCount: 0,
      responseTimes: [],
      connectionStats: {
        connected: 0,
        disconnected: 0,
        periodStart: Date.now(),
      },
      startTime: Date.now(),
    };
  }

  /**
   * Record message processing
   */
  recordMessageProcessed(responseTime?: number): void {
    this.data.messagesProcessed++;
    
    if (responseTime !== undefined && responseTime >= 0) {
      this.data.responseTimes.push(responseTime);
      
      // Keep only recent response times
      if (this.data.responseTimes.length > this.maxResponseTimeSamples) {
        this.data.responseTimes = this.data.responseTimes.slice(-this.maxResponseTimeSamples);
      }
    }
  }

  /**
   * Record error occurrence
   * @nist au-3 "Content of audit records"
   */
  recordError(error: Error | string): void {
    this.data.errorsCount++;
    this.data.lastErrorTime = Date.now();
    
    this.logger.error('Error recorded in metrics', {
      error: error instanceof Error ? error.message : error,
      totalErrors: this.data.errorsCount,
    });
  }

  /**
   * Record connection event
   */
  recordConnection(type: 'connected' | 'disconnected'): void {
    this.data.connectionStats[type]++;
  }

  /**
   * Collect current metrics
   * @nist si-4 "System monitoring"
   */
  collectMetrics(context: HealthCheckContext): HealthMetrics {
    const connectionStats = context.connectionManager.getStats();
    const subscriptionStats = context.eventHandler.getSubscriptionStats();

    const averageResponseTime = this.calculateAverageResponseTime();
    const periodMinutes = this.calculatePeriodMinutes();

    // Reset connection stats if period is too long (> 1 hour)
    if (periodMinutes > 60) {
      this.resetConnectionStats();
    }

    return {
      uptime: Date.now() - this.data.startTime,
      totalConnections: connectionStats.total,
      activeConnections: connectionStats.total,
      authenticatedConnections: connectionStats.authenticated,
      totalSubscriptions: subscriptionStats.totalSubscriptions,
      messagesProcessed: this.data.messagesProcessed,
      errorsCount: this.data.errorsCount,
      lastErrorTime: this.data.lastErrorTime,
      memoryUsage: process.memoryUsage(),
      averageResponseTime,
      connectionTurnover: {
        connected: this.data.connectionStats.connected,
        disconnected: this.data.connectionStats.disconnected,
        period: Math.max(periodMinutes, 1),
      },
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.data = {
      messagesProcessed: 0,
      errorsCount: 0,
      responseTimes: [],
      connectionStats: {
        connected: 0,
        disconnected: 0,
        periodStart: Date.now(),
      },
      startTime: Date.now(),
    };
    
    this.logger.info('Metrics reset');
  }

  /**
   * Get current metrics data
   */
  getMetricsData(): Readonly<MetricsData> {
    return { ...this.data };
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    if (this.data.responseTimes.length === 0) {
      return 0;
    }

    const sum = this.data.responseTimes.reduce((total, time) => total + time, 0);
    return sum / this.data.responseTimes.length;
  }

  /**
   * Calculate period in minutes
   */
  private calculatePeriodMinutes(): number {
    return (Date.now() - this.data.connectionStats.periodStart) / 60000;
  }

  /**
   * Reset connection statistics
   */
  private resetConnectionStats(): void {
    this.data.connectionStats = {
      connected: 0,
      disconnected: 0,
      periodStart: Date.now(),
    };
    
    this.logger.debug('Connection statistics reset');
  }
}