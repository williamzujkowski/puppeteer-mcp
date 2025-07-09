/**
 * Utility functions for compatibility operations
 * @module puppeteer/pool/compatibility/compatibility-utils
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */

import { createLogger } from '../../../utils/logger.js';
import type {
  CompatibilityConfig,
  UsageStatistics,
  MigrationMetrics,
  ExtendedMigrationMetrics,
} from './types.js';
import type { OptimizationConfig } from '../browser-pool-optimized.js';
import { CompatibilityReporter } from './compatibility-reporter.js';

const logger = createLogger('compatibility-utils');

/**
 * Utility functions for compatibility operations
 * @nist ac-3 "Access enforcement"
 */
export class CompatibilityUtils {
  /**
   * Merge compatibility configurations
   * @nist cm-7 "Least functionality"
   */
  static mergeConfigs(
    baseConfig: CompatibilityConfig,
    overrideConfig: Partial<CompatibilityConfig>,
  ): CompatibilityConfig {
    const mergedConfig = {
      ...baseConfig,
      ...overrideConfig,
    };

    // Deep merge optimization config
    if (baseConfig.optimization && overrideConfig.optimization) {
      mergedConfig.optimization = {
        ...baseConfig.optimization,
        ...overrideConfig.optimization,
      };
    }

    logger.debug(
      {
        baseConfig: Object.keys(baseConfig),
        overrideConfig: Object.keys(overrideConfig),
        result: Object.keys(mergedConfig),
      },
      'Compatibility configurations merged',
    );

    return mergedConfig;
  }

  /**
   * Validate configuration consistency
   * @nist ac-3 "Access enforcement"
   */
  static validateConfigConsistency(config: CompatibilityConfig): string[] {
    const issues: string[] = [];

    // Check for conflicting settings
    if (config.enableOptimization && config.useLegacyBehavior) {
      issues.push('Cannot enable optimization and use legacy behavior simultaneously');
    }

    if (config.migrationMode && !config.fallbackToLegacy) {
      issues.push('Migration mode should have fallback to legacy enabled');
    }

    if (config.enableOptimization && !config.optimization) {
      issues.push('Optimization enabled but no optimization config provided');
    }

    // Check optimization config consistency
    if (config.optimization) {
      issues.push(...CompatibilityUtils.validateOptimizationConfig(config.optimization));
    }

    return issues;
  }

  /**
   * Validate optimization configuration
   * @nist ac-3 "Access enforcement"
   */
  private static validateOptimizationConfig(config: Partial<OptimizationConfig>): string[] {
    const issues: string[] = [];

    // Check scaling configuration
    CompatibilityUtils.validateScalingConfig(config.scaling, issues);

    // Check recycling configuration
    CompatibilityUtils.validateRecyclingConfig(config.recycling, issues);

    return issues;
  }

  /**
   * Validate scaling configuration
   * @nist ac-3 "Access enforcement"
   */
  private static validateScalingConfig(
    scaling: Partial<OptimizationConfig>['scaling'],
    issues: string[],
  ): void {
    if (!scaling) {
      return;
    }

    CompatibilityUtils.validateScalingSizes(scaling, issues);
    CompatibilityUtils.validateScalingUtilization(scaling, issues);
    CompatibilityUtils.validateScalingThresholds(scaling, issues);
  }

  /**
   * Validate scaling sizes
   * @nist ac-3 "Access enforcement"
   */
  private static validateScalingSizes(
    scaling: NonNullable<Partial<OptimizationConfig>['scaling']>,
    issues: string[],
  ): void {
    if (scaling.minSize && scaling.maxSize && scaling.minSize >= scaling.maxSize) {
      issues.push('Scaling minSize must be less than maxSize');
    }
  }

  /**
   * Validate scaling utilization
   * @nist ac-3 "Access enforcement"
   */
  private static validateScalingUtilization(
    scaling: NonNullable<Partial<OptimizationConfig>['scaling']>,
    issues: string[],
  ): void {
    if (
      scaling.targetUtilization &&
      (scaling.targetUtilization < 0 || scaling.targetUtilization > 100)
    ) {
      issues.push('Target utilization must be between 0 and 100');
    }
  }

  /**
   * Validate scaling thresholds
   * @nist ac-3 "Access enforcement"
   */
  private static validateScalingThresholds(
    scaling: NonNullable<Partial<OptimizationConfig>['scaling']>,
    issues: string[],
  ): void {
    if (
      scaling.scaleUpThreshold &&
      scaling.scaleDownThreshold &&
      scaling.scaleUpThreshold <= scaling.scaleDownThreshold
    ) {
      issues.push('Scale up threshold must be greater than scale down threshold');
    }
  }

  /**
   * Validate recycling configuration
   * @nist ac-3 "Access enforcement"
   */
  private static validateRecyclingConfig(
    recycling: Partial<OptimizationConfig>['recycling'],
    issues: string[],
  ): void {
    if (!recycling) {
      return;
    }

    if (recycling.maxLifetimeMs && recycling.maxLifetimeMs < 60000) {
      issues.push('Browser lifetime should be at least 60 seconds');
    }

    if (recycling.maxIdleTimeMs && recycling.maxIdleTimeMs < 10000) {
      issues.push('Idle time should be at least 10 seconds');
    }
  }

  /**
   * Calculate migration metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static calculateMigrationMetrics(metrics: MigrationMetrics): ExtendedMigrationMetrics {
    const totalCalls = metrics.optimizedCalls + metrics.legacyFallbacks;

    return {
      ...metrics,
      optimizedSuccessRate: totalCalls > 0 ? (metrics.optimizedCalls / totalCalls) * 100 : 0,
      fallbackRate: totalCalls > 0 ? (metrics.legacyFallbacks / totalCalls) * 100 : 0,
    };
  }

  /**
   * Generate usage statistics summary
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static generateUsageSummary(usage: UsageStatistics): {
    classification: 'light' | 'moderate' | 'heavy' | 'critical';
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const recommendations: string[] = [];
    let classification: 'light' | 'moderate' | 'heavy' | 'critical' = 'light';
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Classify usage based on pool size
    if (usage.peakPoolSize > 50) {
      classification = 'critical';
      riskLevel = 'high';
      recommendations.push('Consider dedicated infrastructure for high-scale usage');
    } else if (usage.peakPoolSize > 20) {
      classification = 'heavy';
      riskLevel = 'medium';
      recommendations.push('Enable aggressive optimization features');
    } else if (usage.peakPoolSize > 10) {
      classification = 'moderate';
      riskLevel = 'medium';
      recommendations.push('Enable adaptive scaling');
    }

    // Consider error rate
    if (usage.errorRate > 15) {
      riskLevel = 'high';
      recommendations.push('Address high error rate before migration');
    } else if (usage.errorRate > 5) {
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      recommendations.push('Enable circuit breaker patterns');
    }

    // Consider resource usage
    if (usage.resourceUsage > 90) {
      riskLevel = 'high';
      recommendations.push('Critical resource usage - immediate optimization needed');
    } else if (usage.resourceUsage > 70) {
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      recommendations.push('Enable resource monitoring');
    }

    return {
      classification,
      recommendations,
      riskLevel,
    };
  }

  /**
   * Format migration metrics for display
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static formatMigrationMetrics(metrics: ExtendedMigrationMetrics): string {
    const totalCalls = metrics.optimizedCalls + metrics.legacyFallbacks;

    return [
      `Total Operations: ${totalCalls}`,
      `Optimized Success: ${metrics.optimizedCalls} (${metrics.optimizedSuccessRate.toFixed(1)}%)`,
      `Legacy Fallbacks: ${metrics.legacyFallbacks} (${metrics.fallbackRate.toFixed(1)}%)`,
      `Errors: ${metrics.errors}`,
    ].join(', ');
  }

  /**
   * Generate compatibility report
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static generateCompatibilityReport(
    config: CompatibilityConfig,
    usage: UsageStatistics,
    metrics?: ExtendedMigrationMetrics,
  ): {
    summary: string;
    details: Record<string, unknown>;
    recommendations: string[];
  } {
    return CompatibilityReporter.generateCompatibilityReport(config, usage, metrics);
  }
}
