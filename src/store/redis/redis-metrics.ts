/**
 * Redis performance metrics and monitoring
 * @module store/redis/redis-metrics
 * @nist au-3 "Audit logging for session operations"
 */

import type { StoreLogger, RedisMetrics } from './types.js';

/**
 * Redis performance metrics collector and analyzer
 */
export class RedisMetricsCollector {
  private logger: StoreLogger;
  private operationCounts: Map<string, number> = new Map();
  private operationLatencies: Map<string, number[]> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private lastMetricsReset = Date.now();
  private readonly MAX_LATENCY_SAMPLES = 1000;

  constructor(logger: StoreLogger) {
    this.logger = logger;
  }

  /**
   * Record operation execution time
   */
  recordOperation(operation: string, latencyMs: number, success: boolean = true): void {
    // Update operation count
    const currentCount = this.operationCounts.get(operation) || 0;
    this.operationCounts.set(operation, currentCount + 1);

    // Record latency for successful operations
    if (success) {
      let latencies = this.operationLatencies.get(operation) || [];
      latencies.push(latencyMs);
      
      // Keep only recent samples
      if (latencies.length > this.MAX_LATENCY_SAMPLES) {
        latencies = latencies.slice(-this.MAX_LATENCY_SAMPLES);
      }
      
      this.operationLatencies.set(operation, latencies);
    } else {
      // Record error
      const errorCount = this.errorCounts.get(operation) || 0;
      this.errorCounts.set(operation, errorCount + 1);
    }
  }

  /**
   * Get current Redis metrics
   */
  getCurrentMetrics(): Promise<RedisMetrics> {
    const now = Date.now();
    const timeElapsedMs = now - this.lastMetricsReset;
    const timeElapsedSec = timeElapsedMs / 1000;

    // Calculate operations per second
    const totalOperations = Array.from(this.operationCounts.values())
      .reduce((sum, count) => sum + count, 0);
    const operationsPerSecond = timeElapsedSec > 0 ? totalOperations / timeElapsedSec : 0;

    // Calculate average latency across all operations
    const allLatencies: number[] = [];
    for (const latencies of Array.from(this.operationLatencies.values())) {
      allLatencies.push(...latencies);
    }
    const averageLatency = allLatencies.length > 0 
      ? allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length 
      : 0;

    // Calculate error rate
    const totalErrors = Array.from(this.errorCounts.values())
      .reduce((sum, count) => sum + count, 0);
    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

    return Promise.resolve({
      operationsPerSecond,
      averageLatency,
      errorRate,
      memoryUsage: 0, // Would need Redis INFO command for actual memory usage
      connectionCount: 1, // Simplified for this implementation
      lastUpdated: new Date().toISOString()
    });
  }

  /**
   * Get detailed operation metrics
   */
  getOperationMetrics(): Map<string, {
    count: number;
    averageLatency: number;
    errorCount: number;
    errorRate: number;
  }> {
    const metrics = new Map();

    for (const [operation, count] of Array.from(this.operationCounts.entries())) {
      const latencies = this.operationLatencies.get(operation) || [];
      const averageLatency = latencies.length > 0 
        ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
        : 0;
      
      const errorCount = this.errorCounts.get(operation) || 0;
      const errorRate = count > 0 ? (errorCount / count) * 100 : 0;

      metrics.set(operation, {
        count,
        averageLatency,
        errorCount,
        errorRate
      });
    }

    return metrics;
  }

  /**
   * Get performance percentiles for an operation
   */
  getLatencyPercentiles(operation: string): {
    p50: number;
    p95: number;
    p99: number;
    count: number;
  } {
    const latencies = this.operationLatencies.get(operation) || [];
    
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0, count: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;
    
    const p50Index = Math.floor(count * 0.5);
    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);

    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0,
      count
    };
  }

  /**
   * Monitor operation performance
   */
  async monitorOperation<T>(
    operation: string,
    func: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    let success = true;
    
    try {
      const result = await func();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const latency = Date.now() - start;
      this.recordOperation(operation, latency, success);
    }
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(): {
    trending: 'up' | 'down' | 'stable';
    averageLatencyTrend: number[];
    operationsTrend: number[];
    errorRateTrend: number[];
  } {
    // This would require historical data storage for a complete implementation
    // For now, return basic trends based on current metrics
    const metrics = this.getOperationMetrics();
    const allLatencies = Array.from(metrics.values()).map(m => m.averageLatency);
    const avgLatency = allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length;
    
    // Simplified trending logic
    let trending: 'up' | 'down' | 'stable' = 'stable';
    if (avgLatency > 100) {
      trending = 'down'; // Performance degrading
    } else if (avgLatency < 50) {
      trending = 'up'; // Performance good
    }

    return {
      trending,
      averageLatencyTrend: allLatencies,
      operationsTrend: Array.from(metrics.values()).map(m => m.count),
      errorRateTrend: Array.from(metrics.values()).map(m => m.errorRate)
    };
  }

  /**
   * Detect performance anomalies
   */
  detectAnomalies(): {
    highLatency: string[];
    highErrorRate: string[];
    lowThroughput: string[];
  } {
    const metrics = this.getOperationMetrics();
    const anomalies = {
      highLatency: [] as string[],
      highErrorRate: [] as string[],
      lowThroughput: [] as string[]
    };

    for (const [operation, metric] of Array.from(metrics.entries())) {
      // High latency threshold: > 500ms
      if (metric.averageLatency > 500) {
        anomalies.highLatency.push(operation);
      }
      
      // High error rate threshold: > 5%
      if (metric.errorRate > 5) {
        anomalies.highErrorRate.push(operation);
      }
      
      // Low throughput detection would need baseline comparison
      // For now, flag operations with very few executions
      if (metric.count < 10 && Date.now() - this.lastMetricsReset > 60000) {
        anomalies.lowThroughput.push(operation);
      }
    }

    return anomalies;
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<{
    summary: RedisMetrics;
    operationBreakdown: Map<string, any>;
    anomalies: Array<{ operation: string; issue: string; severity: 'low' | 'medium' | 'high' }>;
    recommendations: string[];
  }> {
    const summary = await this.getCurrentMetrics();
    const operationBreakdown = this.getOperationMetrics();
    const rawAnomalies = this.detectAnomalies();
    
    const recommendations: string[] = [];
    
    if (rawAnomalies.highLatency.length > 0) {
      recommendations.push(`Optimize high-latency operations: ${rawAnomalies.highLatency.join(', ')}`);
    }
    
    if (rawAnomalies.highErrorRate.length > 0) {
      recommendations.push(`Investigate error-prone operations: ${rawAnomalies.highErrorRate.join(', ')}`);
    }
    
    // Convert anomalies to expected format
    const anomalies: Array<{ operation: string; issue: string; severity: 'low' | 'medium' | 'high' }> = [];
    
    for (const op of rawAnomalies.highLatency) {
      anomalies.push({ operation: op, issue: 'High latency', severity: 'high' });
    }
    
    for (const op of rawAnomalies.highErrorRate) {
      anomalies.push({ operation: op, issue: 'High error rate', severity: 'high' });
    }
    
    for (const op of rawAnomalies.lowThroughput) {
      anomalies.push({ operation: op, issue: 'Low throughput', severity: 'medium' });
    }
    
    // Add more recommendations based on metrics
    return {
      summary,
      operationBreakdown,
      anomalies,
      recommendations
    };
  }

  /**
   * Reset metrics collection
   */
  resetMetrics(): void {
    this.operationCounts.clear();
    this.operationLatencies.clear();
    this.errorCounts.clear();
    this.lastMetricsReset = Date.now();
    
    this.logger.info('Redis metrics reset');
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    timestamp: string;
    metrics: Record<string, unknown>;
  } {
    return {
      timestamp: new Date().toISOString(),
      metrics: {
        operations: Object.fromEntries(this.operationCounts),
        errors: Object.fromEntries(this.errorCounts),
        latencyStats: Object.fromEntries(
          Array.from(this.operationLatencies.entries()).map(([op, latencies]) => [
            op,
            {
              count: latencies.length,
              avg: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
              min: Math.min(...latencies),
              max: Math.max(...latencies)
            }
          ])
        )
      }
    };
  }

  /**
   * Set performance thresholds for alerting
   */
  setPerformanceThresholds(thresholds: {
    maxLatency?: number;
    maxErrorRate?: number;
    minThroughput?: number;
  }): void {
    // Store thresholds for future anomaly detection
    // This would be expanded in a full implementation
    this.logger.info({ thresholds }, 'Performance thresholds updated');
  }
}