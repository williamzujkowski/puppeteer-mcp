/**
 * Optimization engine strategy for performance monitoring
 * @module puppeteer/pool/performance/strategies/optimization-engine
 * @nist si-4 "Information system monitoring"
 * @nist au-5 "Response to audit processing failures"
 */

import type { EventEmitter } from 'events';
import type {
  PerformanceMetricType,
  OptimizationRecommendation,
  PerformanceSummary,
  PerformanceMonitoringConfig,
} from '../types/performance-monitor.types.js';
import type { IOptimizationEngine } from '../types/strategy.interfaces.js';

/**
 * Optimization engine strategy implementation
 */
export class OptimizationEngine implements IOptimizationEngine {
  readonly monitor: EventEmitter;
  readonly config: PerformanceMonitoringConfig;
  
  private recommendations: Map<string, OptimizationRecommendation> = new Map();
  private lastOptimizationCheck = new Date(0);
  private readonly maxRecommendations = 100;
  private readonly optimizationInterval = 5 * 60 * 1000; // 5 minutes

  constructor(monitor: EventEmitter, config: PerformanceMonitoringConfig) {
    this.monitor = monitor;
    this.config = config;
  }

  /**
   * Generate optimization recommendations based on performance summary
   * @nist au-5 "Response to audit processing failures"
   */
  generateRecommendations(summary: PerformanceSummary): void {
    if (!this.config.enablePerformanceOptimization || !this.shouldGenerateRecommendations()) {
      return;
    }

    this.lastOptimizationCheck = new Date();
    
    // Analyze all metrics and generate recommendations
    const recommendations = this.analyzeAllMetrics(summary);
    
    // Add all recommendations
    for (const recommendation of recommendations) {
      this.addRecommendation(recommendation);
    }
  }

  /**
   * Get optimization recommendations
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getRecommendations(applied?: boolean): OptimizationRecommendation[] {
    const recommendations = Array.from(this.recommendations.values());
    return applied !== undefined
      ? recommendations.filter(r => r.applied === applied)
      : recommendations;
  }

  /**
   * Apply an optimization recommendation
   * @nist au-5 "Response to audit processing failures"
   */
  applyRecommendation(
    recommendationId: string,
    result: { successful: boolean; actualImprovement: number; notes: string }
  ): boolean {
    const recommendation = this.recommendations.get(recommendationId);
    if (recommendation && !recommendation.applied) {
      recommendation.applied = true;
      recommendation.appliedAt = new Date();
      recommendation.result = result;
      
      this.monitor.emit('recommendation-applied', recommendation);
      return true;
    }
    return false;
  }

  /**
   * Check if it's time to generate new recommendations
   */
  shouldGenerateRecommendations(): boolean {
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - this.lastOptimizationCheck.getTime();
    return timeSinceLastCheck >= this.optimizationInterval;
  }

  /**
   * Get recommendation statistics
   */
  getRecommendationStatistics(): {
    total: number;
    applied: number;
    pending: number;
    byPriority: Record<'low' | 'medium' | 'high' | 'critical', number>;
    byType: Record<string, number>;
    successRate: number;
  } {
    const recommendations = Array.from(this.recommendations.values());
    const applied = recommendations.filter(r => r.applied);
    const successful = applied.filter(r => r.result?.successful);

    const byPriority = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byType: Record<string, number> = {};

    for (const rec of recommendations) {
      byPriority[rec.priority]++;
      byType[rec.type] = (byType[rec.type] || 0) + 1;
    }

    return {
      total: recommendations.length,
      applied: applied.length,
      pending: recommendations.length - applied.length,
      byPriority,
      byType,
      successRate: applied.length > 0 ? successful.length / applied.length : 0,
    };
  }

  /**
   * Get high-priority recommendations
   */
  getHighPriorityRecommendations(): OptimizationRecommendation[] {
    return Array.from(this.recommendations.values()).filter(
      r => !r.applied && (r.priority === 'high' || r.priority === 'critical')
    );
  }

  /**
   * Clear old recommendations
   */
  clearOldRecommendations(maxAge: number): void {
    const cutoff = new Date(Date.now() - maxAge);
    
    for (const [id, recommendation] of this.recommendations) {
      if (recommendation.timestamp < cutoff) {
        this.recommendations.delete(id);
      }
    }
  }

  /**
   * Auto-apply recommendations if enabled
   */
  autoApplyRecommendations(): void {
    if (!this.config.autoOptimizationEnabled) {
      return;
    }

    const safeRecommendations = this.getSafeAutoApplyRecommendations();
    
    for (const recommendation of safeRecommendations) {
      this.monitor.emit('auto-optimization-requested', recommendation);
    }
  }

  /**
   * Analyze specific metric and generate recommendation if threshold exceeded
   * @private
   */
  private analyzeMetricPerformance(summary: PerformanceSummary, type: PerformanceMetricType): OptimizationRecommendation | null {
    const metric = summary.metrics[type];
    if (!metric) return null;

    const templates = {
      [PerformanceMetricType.LATENCY]: {
        condition: () => metric.current > this.config.optimizationThresholds.maxLatency,
        rec: () => ({
          id: `latency-opt-${Date.now()}`,
          type: 'configuration' as const,
          priority: (metric.current > this.config.optimizationThresholds.maxLatency * 2 ? 'high' : 'medium') as const,
          title: 'Optimize Latency Performance',
          description: `Current latency ${metric.current}ms exceeds threshold ${this.config.optimizationThresholds.maxLatency}ms`,
          impact: 'Improve response times by 20-30%',
          implementation: 'Enable connection pooling, optimize request processing, and implement caching',
          expectedImprovement: 25,
          confidence: 0.8,
        })
      },
      [PerformanceMetricType.ERROR_RATE]: {
        condition: () => metric.current > this.config.optimizationThresholds.maxErrorRate,
        rec: () => ({
          id: `error-rate-opt-${Date.now()}`,
          type: 'recycling' as const,
          priority: 'critical' as const,
          title: 'Reduce Error Rate',
          description: `Current error rate ${metric.current}% exceeds threshold ${this.config.optimizationThresholds.maxErrorRate}%`,
          impact: 'Reduce errors by 50-70%',
          implementation: 'Implement aggressive browser recycling, health checks, and error recovery',
          expectedImprovement: 60,
          confidence: 0.9,
        })
      },
      [PerformanceMetricType.THROUGHPUT]: {
        condition: () => metric.current < this.config.optimizationThresholds.minThroughput,
        rec: () => ({
          id: `throughput-opt-${Date.now()}`,
          type: 'scaling' as const,
          priority: 'high' as const,
          title: 'Improve Throughput',
          description: `Current throughput ${metric.current} below threshold ${this.config.optimizationThresholds.minThroughput}`,
          impact: 'Increase throughput by 40-60%',
          implementation: 'Scale up browser pool size and optimize queue management',
          expectedImprovement: 50,
          confidence: 0.7,
        })
      },
      [PerformanceMetricType.RESOURCE_UTILIZATION]: {
        condition: () => metric.current > this.config.optimizationThresholds.maxResourceUtilization,
        rec: () => ({
          id: `resource-opt-${Date.now()}`,
          type: 'resource_management' as const,
          priority: 'medium' as const,
          title: 'Optimize Resource Usage',
          description: `Resource utilization ${metric.current}% exceeds threshold ${this.config.optimizationThresholds.maxResourceUtilization}%`,
          impact: 'Reduce resource usage by 15-25%',
          implementation: 'Implement memory management, browser recycling, and resource monitoring',
          expectedImprovement: 20,
          confidence: 0.6,
        })
      },
    };

    const template = templates[type];
    if (template && template.condition()) {
      return { ...template.rec(), timestamp: new Date(), applied: false };
    }
    return null;
  }

  /**
   * Analyze all performance metrics and generate recommendations
   * @private
   */
  private analyzeAllMetrics(summary: PerformanceSummary): OptimizationRecommendation[] {
    const metrics = [
      PerformanceMetricType.LATENCY,
      PerformanceMetricType.ERROR_RATE,
      PerformanceMetricType.THROUGHPUT,
      PerformanceMetricType.RESOURCE_UTILIZATION,
    ];

    return metrics
      .map(type => this.analyzeMetricPerformance(summary, type))
      .filter((rec): rec is OptimizationRecommendation => rec !== null);
  }

  /**
   * Add a recommendation to the collection
   * @private
   */
  private addRecommendation(recommendation: OptimizationRecommendation): void {
    this.recommendations.set(recommendation.id, recommendation);
    this.monitor.emit('recommendation-generated', recommendation);

    // Maintain max recommendations
    if (this.recommendations.size > this.maxRecommendations) {
      const oldestId = this.recommendations.keys().next().value;
      this.recommendations.delete(oldestId);
    }
  }

  /**
   * Get recommendations safe for auto-application
   * @private
   */
  private getSafeAutoApplyRecommendations(): OptimizationRecommendation[] {
    // Only auto-apply low-risk configuration changes
    return Array.from(this.recommendations.values()).filter(
      r => !r.applied && 
           r.type === 'configuration' && 
           r.priority !== 'critical' &&
           r.confidence > 0.8
    );
  }
}