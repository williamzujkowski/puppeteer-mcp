/**
 * Strategy management for browser recycling
 * @module puppeteer/pool/recycling/strategy-manager
 * @nist ac-12 "Session termination"
 */

import {
  TimeBasedStrategy,
  UsageBasedStrategy,
  HealthBasedStrategy,
  ResourceBasedStrategy,
  HybridStrategy,
} from './recycling-strategies.js';
import type { RecyclingConfig } from './types.js';
import { RecyclingStrategy } from './types.js';
import type { RecyclingStrategyResult } from './recycling-strategies.js';

/**
 * Strategy metrics interface
 */
export interface StrategyMetrics {
  ageMs: number;
  idleTimeMs: number;
  useCount: number;
  pageCount: number;
  healthScore: number;
  errorRate: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
}

/**
 * Strategy manager for recycling decisions
 * @nist ac-12 "Session termination"
 */
export class StrategyManager {
  private timeBasedStrategy: TimeBasedStrategy;
  private usageBasedStrategy: UsageBasedStrategy;
  private healthBasedStrategy: HealthBasedStrategy;
  private resourceBasedStrategy: ResourceBasedStrategy;
  private hybridStrategy: HybridStrategy;

  constructor() {
    this.timeBasedStrategy = new TimeBasedStrategy();
    this.usageBasedStrategy = new UsageBasedStrategy();
    this.healthBasedStrategy = new HealthBasedStrategy();
    this.resourceBasedStrategy = new ResourceBasedStrategy();
    this.hybridStrategy = new HybridStrategy();
  }

  /**
   * Calculate score based on strategy
   */
  calculateScore(
    metrics: StrategyMetrics,
    strategy: RecyclingStrategy,
    config: RecyclingConfig
  ): RecyclingStrategyResult {
    switch (strategy) {
      case RecyclingStrategy.TIME_BASED:
        return this.timeBasedStrategy.calculate(
          metrics.ageMs,
          metrics.idleTimeMs,
          config
        );
        
      case RecyclingStrategy.USAGE_BASED:
        return this.usageBasedStrategy.calculate(
          metrics.useCount,
          metrics.pageCount,
          config
        );
        
      case RecyclingStrategy.HEALTH_BASED:
        return this.healthBasedStrategy.calculate(
          metrics.healthScore,
          metrics.errorRate,
          config
        );
        
      case RecyclingStrategy.RESOURCE_BASED:
        return this.resourceBasedStrategy.calculate(
          metrics.memoryUsageMB,
          metrics.cpuUsagePercent,
          config
        );
        
      case RecyclingStrategy.HYBRID:
      default:
        return this.hybridStrategy.calculate(metrics, config);
    }
  }
}