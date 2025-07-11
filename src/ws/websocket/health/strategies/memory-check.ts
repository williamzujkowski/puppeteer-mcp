/**
 * Memory usage health check strategy
 * @module ws/websocket/health/strategies/memory-check
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 */

import { HealthCheckStrategy, type HealthCheckStrategyResult } from './base.js';
import type { HealthMetrics, HealthCheckContext } from '../types.js';

/**
 * Memory usage health check
 * @nist au-3 "Content of audit records"
 */
export class MemoryCheckStrategy extends HealthCheckStrategy {
  async check(
    _context: HealthCheckContext,
    metrics: HealthMetrics,
  ): Promise<HealthCheckStrategyResult> {
    const issues: HealthCheckStrategyResult['issues'] = [];
    const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    const maxMemoryMB = this.getThreshold('maxMemoryMB', 500);
    const warningMemoryMB = this.getThreshold('warningMemoryMB', 400);

    if (memoryMB > maxMemoryMB) {
      issues.push({
        severity: 'critical',
        message: `Critical memory usage: ${memoryMB.toFixed(0)}MB (threshold: ${maxMemoryMB}MB)`,
        recommendation:
          'Immediate investigation required. Consider restarting the server or increasing heap size.',
      });
    } else if (memoryMB > warningMemoryMB) {
      issues.push({
        severity: 'medium',
        message: `High memory usage: ${memoryMB.toFixed(0)}MB (warning threshold: ${warningMemoryMB}MB)`,
        recommendation:
          'Monitor memory usage trends. Consider investigating potential memory leaks.',
      });
    }

    // Check memory growth rate
    const heapUsedPercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (heapUsedPercent > 90) {
      issues.push({
        severity: 'high',
        message: `Heap usage at ${heapUsedPercent.toFixed(1)}% of total heap`,
        recommendation: 'Consider increasing Node.js heap size with --max-old-space-size flag.',
      });
    }

    return {
      passed: issues.filter((i) => i.severity === 'critical').length === 0,
      issues,
      metrics: {
        memoryUsage: metrics.memoryUsage,
      },
    };
  }
}
