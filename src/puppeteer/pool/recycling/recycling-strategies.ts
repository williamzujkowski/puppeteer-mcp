/**
 * Different recycling strategies (time-based, usage-based, etc.)
 * @module puppeteer/pool/recycling/recycling-strategies
 * @nist ac-12 "Session termination"
 */

import { createLogger } from '../../../utils/logger.js';
import type { RecyclingConfig } from './types.js';
import { RecyclingReason } from './types.js';

const logger = createLogger('recycling-strategies');

/**
 * Recycling strategy interface
 */
export interface RecyclingStrategyResult {
  score: number;
  reasons: RecyclingReason[];
}

/**
 * Time-based recycling strategy
 */
export class TimeBasedStrategy {
  /**
   * Calculate time-based recycling score
   */
  calculate(ageMs: number, idleTimeMs: number, config: RecyclingConfig): RecyclingStrategyResult {
    const reasons: RecyclingReason[] = [];
    let score = 0;

    // Age-based scoring
    if (ageMs > config.maxLifetimeMs) {
      score += 100;
      reasons.push(RecyclingReason.MAX_LIFETIME);
    } else {
      score += (ageMs / config.maxLifetimeMs) * 60;
    }

    // Idle time scoring
    if (idleTimeMs > config.maxIdleTimeMs) {
      score += 40;
    } else {
      score += (idleTimeMs / config.maxIdleTimeMs) * 20;
    }

    return {
      score: Math.min(100, score),
      reasons,
    };
  }
}

/**
 * Usage-based recycling strategy
 */
export class UsageBasedStrategy {
  /**
   * Calculate usage-based recycling score
   */
  calculate(useCount: number, pageCount: number, config: RecyclingConfig): RecyclingStrategyResult {
    const reasons: RecyclingReason[] = [];
    let score = 0;

    // Use count scoring
    if (useCount > config.maxUseCount) {
      score += 100;
      reasons.push(RecyclingReason.MAX_USAGE);
    } else {
      score += (useCount / config.maxUseCount) * 60;
    }

    // Page count scoring
    if (pageCount > config.maxPageCount) {
      score += 40;
    } else {
      score += (pageCount / config.maxPageCount) * 20;
    }

    return {
      score: Math.min(100, score),
      reasons,
    };
  }
}

/**
 * Health-based recycling strategy
 */
export class HealthBasedStrategy {
  /**
   * Calculate health-based recycling score
   */
  calculate(
    healthScore: number,
    errorRate: number,
    config: RecyclingConfig,
  ): RecyclingStrategyResult {
    const reasons: RecyclingReason[] = [];
    let score = 0;

    // Health score (inverted - lower health = higher recycling score)
    if (healthScore < config.healthThreshold) {
      score += 100;
      reasons.push(RecyclingReason.HEALTH_DEGRADATION);
    } else {
      score += (100 - healthScore) * 0.8;
    }

    // Error rate scoring
    if (errorRate > 10) {
      score += 40;
      reasons.push(RecyclingReason.ERROR_THRESHOLD);
    } else {
      score += errorRate * 2;
    }

    return {
      score: Math.min(100, score),
      reasons,
    };
  }
}

/**
 * Resource-based recycling strategy
 */
export class ResourceBasedStrategy {
  /**
   * Calculate resource-based recycling score
   */
  calculate(
    memoryUsageMB: number,
    cpuUsagePercent: number,
    config: RecyclingConfig,
  ): RecyclingStrategyResult {
    const reasons: RecyclingReason[] = [];
    let score = 0;

    // Memory usage scoring
    if (memoryUsageMB > config.maxMemoryUsageMB) {
      score += 100;
      reasons.push(RecyclingReason.MEMORY_PRESSURE);
    } else {
      score += (memoryUsageMB / config.maxMemoryUsageMB) * 60;
    }

    // CPU usage scoring
    if (cpuUsagePercent > config.maxCpuUsagePercent) {
      score += 40;
      reasons.push(RecyclingReason.CPU_PRESSURE);
    } else {
      score += (cpuUsagePercent / config.maxCpuUsagePercent) * 20;
    }

    return {
      score: Math.min(100, score),
      reasons,
    };
  }
}

/**
 * Hybrid recycling strategy
 */
export class HybridStrategy {
  private timeBasedStrategy = new TimeBasedStrategy();
  private usageBasedStrategy = new UsageBasedStrategy();
  private healthBasedStrategy = new HealthBasedStrategy();
  private resourceBasedStrategy = new ResourceBasedStrategy();

  /**
   * Calculate hybrid recycling score
   */
  calculate(
    metrics: {
      ageMs: number;
      idleTimeMs: number;
      useCount: number;
      pageCount: number;
      healthScore: number;
      errorRate: number;
      memoryUsageMB: number;
      cpuUsagePercent: number;
    },
    config: RecyclingConfig,
  ): RecyclingStrategyResult {
    const reasons: RecyclingReason[] = [];

    // Calculate individual scores
    const timeResult = this.timeBasedStrategy.calculate(metrics.ageMs, metrics.idleTimeMs, config);

    const usageResult = this.usageBasedStrategy.calculate(
      metrics.useCount,
      metrics.pageCount,
      config,
    );

    const healthResult = this.healthBasedStrategy.calculate(
      metrics.healthScore,
      metrics.errorRate,
      config,
    );

    const resourceResult = this.resourceBasedStrategy.calculate(
      metrics.memoryUsageMB,
      metrics.cpuUsagePercent,
      config,
    );

    // Collect all reasons
    reasons.push(...timeResult.reasons);
    reasons.push(...usageResult.reasons);
    reasons.push(...healthResult.reasons);
    reasons.push(...resourceResult.reasons);

    // Calculate weighted score
    const score =
      timeResult.score * config.weightTimeBasedScore +
      usageResult.score * config.weightUsageBasedScore +
      healthResult.score * config.weightHealthBasedScore +
      resourceResult.score * config.weightResourceBasedScore;

    logger.debug(
      {
        timeScore: timeResult.score,
        usageScore: usageResult.score,
        healthScore: healthResult.score,
        resourceScore: resourceResult.score,
        finalScore: score,
        reasons,
      },
      'Hybrid strategy calculation completed',
    );

    return {
      score: Math.min(100, score),
      reasons: [...new Set(reasons)], // Remove duplicates
    };
  }
}
