/**
 * Performance health check strategy
 * @module ws/websocket/health/strategies/performance-check
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 */

import { HealthCheckStrategy, type HealthCheckStrategyResult } from './base.js';
import type { HealthMetrics, HealthCheckContext } from '../types.js';

/**
 * Performance health check
 * @nist au-3 "Content of audit records"
 */
export class PerformanceCheckStrategy extends HealthCheckStrategy {
  async check(
    _context: HealthCheckContext,
    metrics: HealthMetrics,
  ): Promise<HealthCheckStrategyResult> {
    const issues: HealthCheckStrategyResult['issues'] = [];

    // Check response time
    const maxResponseTime = this.getThreshold('maxResponseTime', 1000);
    const warningResponseTime = this.getThreshold('warningResponseTime', 500);

    if (metrics.averageResponseTime > maxResponseTime) {
      issues.push({
        severity: 'high',
        message: `Critical response time: ${metrics.averageResponseTime.toFixed(0)}ms`,
        recommendation: 'Optimize message processing, reduce payload sizes, or scale resources.',
      });
    } else if (metrics.averageResponseTime > warningResponseTime) {
      issues.push({
        severity: 'medium',
        message: `Slow response times: ${metrics.averageResponseTime.toFixed(0)}ms`,
        recommendation: 'Monitor performance trends and consider optimization.',
      });
    }

    // Check error rate
    const errorRate =
      metrics.messagesProcessed > 0 ? metrics.errorsCount / metrics.messagesProcessed : 0;
    const maxErrorRate = this.getThreshold('maxErrorRate', 0.1);
    const warningErrorRate = this.getThreshold('warningErrorRate', 0.05);

    if (errorRate > maxErrorRate) {
      issues.push({
        severity: 'critical',
        message: `Critical error rate: ${(errorRate * 100).toFixed(1)}%`,
        recommendation: 'Investigate error logs immediately and fix underlying causes.',
      });
    } else if (errorRate > warningErrorRate) {
      issues.push({
        severity: 'medium',
        message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        recommendation: 'Review error patterns and implement error handling improvements.',
      });
    }

    // Check recent errors
    const recentErrorThreshold = this.getThreshold('recentErrorThresholdMs', 300000); // 5 minutes
    if (metrics.lastErrorTime && Date.now() - metrics.lastErrorTime < recentErrorThreshold) {
      issues.push({
        severity: 'low',
        message: 'Recent errors detected',
        recommendation: 'Check logs for recent error patterns and trends.',
      });
    }

    // Check uptime
    const minUptimeMs = this.getThreshold('minUptimeMs', 300000); // 5 minutes
    if (metrics.uptime < minUptimeMs) {
      issues.push({
        severity: 'low',
        message: `Server recently started (uptime: ${(metrics.uptime / 1000).toFixed(0)}s)`,
        recommendation: 'Monitor stability during startup period.',
      });
    }

    return {
      passed: issues.filter((i) => i.severity === 'critical').length === 0,
      issues,
      metrics: {
        averageResponseTime: metrics.averageResponseTime,
        errorsCount: metrics.errorsCount,
        messagesProcessed: metrics.messagesProcessed,
        uptime: metrics.uptime,
      },
    };
  }
}
