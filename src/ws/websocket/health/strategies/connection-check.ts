/**
 * Connection health check strategy
 * @module ws/websocket/health/strategies/connection-check
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 */

import { HealthCheckStrategy, type HealthCheckStrategyResult } from './base.js';
import type { HealthMetrics, HealthCheckContext } from '../types.js';

/**
 * Connection health check
 * @nist au-3 "Content of audit records"
 */
export class ConnectionCheckStrategy extends HealthCheckStrategy {
  async check(_context: HealthCheckContext, metrics: HealthMetrics): Promise<HealthCheckStrategyResult> {
    const issues: HealthCheckStrategyResult['issues'] = [];
    
    // Check connection turnover rate
    const turnoverRate = metrics.connectionTurnover.disconnected / Math.max(metrics.connectionTurnover.period, 1);
    const maxTurnoverRate = this.getThreshold('maxTurnoverRate', 10);
    const warningTurnoverRate = this.getThreshold('warningTurnoverRate', 5);

    if (turnoverRate > maxTurnoverRate) {
      issues.push({
        severity: 'high',
        message: `Critical connection turnover: ${turnoverRate.toFixed(1)} disconnections/min`,
        recommendation: 'Investigate network stability, client errors, or server performance issues.',
      });
    } else if (turnoverRate > warningTurnoverRate) {
      issues.push({
        severity: 'medium',
        message: `High connection turnover: ${turnoverRate.toFixed(1)} disconnections/min`,
        recommendation: 'Monitor connection stability and review client connection patterns.',
      });
    }

    // Check authenticated connection ratio
    const authRatio = metrics.totalConnections > 0 
      ? metrics.authenticatedConnections / metrics.totalConnections 
      : 0;
    const minAuthRatio = this.getThreshold('minAuthRatio', 0.8);

    if (authRatio < minAuthRatio && metrics.totalConnections > 0) {
      issues.push({
        severity: 'medium',
        message: `Low authentication ratio: ${(authRatio * 100).toFixed(1)}%`,
        recommendation: 'Review authentication process and check for unauthorized connection attempts.',
      });
    }

    // Check for connection limit
    const maxConnections = this.getThreshold('maxConnections', 1000);
    if (metrics.activeConnections > maxConnections) {
      issues.push({
        severity: 'critical',
        message: `Connection limit exceeded: ${metrics.activeConnections} active connections`,
        recommendation: 'Consider scaling horizontally or increasing connection limits.',
      });
    }

    return {
      passed: issues.filter(i => i.severity === 'critical').length === 0,
      issues,
      metrics: {
        activeConnections: metrics.activeConnections,
        authenticatedConnections: metrics.authenticatedConnections,
        connectionTurnover: metrics.connectionTurnover,
      },
    };
  }
}