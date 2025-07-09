/**
 * Compatibility validation logic
 * @module puppeteer/pool/compatibility/compatibility-checker
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */

import type {
  CompatibilityConfig,
  CompatibilityCheckResult,
  UsageStatistics,
  CompatibilityAnalysis,
} from './types.js';
import type { OptimizationConfig } from '../browser-pool-optimized.js';
import { VersionDetector } from './version-detector.js';
import { RecyclingStrategy } from '../browser-pool-recycler.js';
import { CompatibilityValidator } from './compatibility-validator.js';

/**
 * Compatibility checker for browser pool configurations
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */
export class CompatibilityChecker {
  /**
   * Check compatibility of configuration
   * @nist ac-3 "Access enforcement"
   */
  static checkCompatibility(config: CompatibilityConfig): CompatibilityCheckResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check version compatibility
    CompatibilityChecker.checkVersionCompatibility(issues, warnings);

    // Check configuration conflicts
    CompatibilityChecker.checkConfigurationConflicts(config, issues, warnings);

    // Check optimization configuration
    CompatibilityChecker.checkOptimizationCompatibility(config, issues, warnings, recommendations);

    // Generate general recommendations
    CompatibilityChecker.generateGeneralRecommendations(config, recommendations);

    return {
      isCompatible: issues.length === 0,
      issues,
      warnings,
      recommendations,
    };
  }

  /**
   * Check version compatibility
   * @nist ac-3 "Access enforcement"
   */
  private static checkVersionCompatibility(issues: string[], warnings: string[]): void {
    const currentVersion = VersionDetector.detectVersion();
    const versionCompatibility = VersionDetector.getVersionCompatibility(currentVersion);

    if (!versionCompatibility.isCompatible) {
      issues.push(`Version ${currentVersion} is not supported`);
    }

    if (versionCompatibility.requiredMigrations.length > 0) {
      warnings.push(`Migrations required: ${versionCompatibility.requiredMigrations.join(', ')}`);
    }

    if (versionCompatibility.deprecatedFeatures.length > 0) {
      warnings.push(`Deprecated features: ${versionCompatibility.deprecatedFeatures.join(', ')}`);
    }
  }

  /**
   * Check configuration conflicts
   * @nist ac-3 "Access enforcement"
   */
  private static checkConfigurationConflicts(
    config: CompatibilityConfig,
    issues: string[],
    warnings: string[],
  ): void {
    if (config.enableOptimization && config.useLegacyBehavior) {
      issues.push('Cannot enable optimization and use legacy behavior simultaneously');
    }

    if (config.migrationMode && !config.fallbackToLegacy) {
      warnings.push('Migration mode without fallback may cause issues');
    }
  }

  /**
   * Check optimization configuration compatibility
   * @nist ac-3 "Access enforcement"
   */
  private static checkOptimizationCompatibility(
    config: CompatibilityConfig,
    issues: string[],
    warnings: string[],
    recommendations: string[],
  ): void {
    if (config.enableOptimization && config.optimization) {
      const optimizationIssues = CompatibilityChecker.checkOptimizationConfig(config.optimization);
      issues.push(...optimizationIssues.issues);
      warnings.push(...optimizationIssues.warnings);
      recommendations.push(...optimizationIssues.recommendations);
    }
  }

  /**
   * Generate general recommendations
   * @nist ac-3 "Access enforcement"
   */
  private static generateGeneralRecommendations(
    config: CompatibilityConfig,
    recommendations: string[],
  ): void {
    if (config.enableOptimization && !config.optimization?.performanceMonitoring?.enabled) {
      recommendations.push('Enable performance monitoring for optimized pools');
    }

    if (config.migrationMode && config.logWarnings) {
      recommendations.push('Consider detailed logging during migration');
    }
  }

  /**
   * Check optimization configuration compatibility
   * @nist ac-3 "Access enforcement"
   */
  private static checkOptimizationConfig(
    config: Partial<OptimizationConfig>,
  ): CompatibilityCheckResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check scaling configuration
    CompatibilityChecker.checkScalingConfig(config, issues, warnings);

    // Check recycling configuration
    CompatibilityChecker.checkRecyclingConfig(config, warnings, recommendations);

    // Check circuit breaker configuration
    CompatibilityChecker.checkCircuitBreakerConfig(config, recommendations);

    // Check resource monitoring configuration
    CompatibilityChecker.checkResourceMonitoringConfig(config, recommendations);

    return {
      isCompatible: issues.length === 0,
      issues,
      warnings,
      recommendations,
    };
  }

  /**
   * Check scaling configuration
   * @nist ac-3 "Access enforcement"
   */
  private static checkScalingConfig(
    config: Partial<OptimizationConfig>,
    issues: string[],
    warnings: string[],
  ): void {
    if (!config.scaling?.enabled) {
      return;
    }

    const scaling = config.scaling;

    CompatibilityChecker.validateScalingSizes(scaling, issues);
    CompatibilityChecker.validateScalingUtilization(scaling, issues);
    CompatibilityChecker.validatePredictiveScaling(scaling, config, warnings);
  }

  /**
   * Validate scaling sizes
   * @nist ac-3 "Access enforcement"
   */
  private static validateScalingSizes(
    scaling: NonNullable<OptimizationConfig['scaling']>,
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
    scaling: NonNullable<OptimizationConfig['scaling']>,
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
   * Validate predictive scaling
   * @nist ac-3 "Access enforcement"
   */
  private static validatePredictiveScaling(
    scaling: NonNullable<OptimizationConfig['scaling']>,
    config: Partial<OptimizationConfig>,
    warnings: string[],
  ): void {
    if (scaling.enablePredictiveScaling && !config.performanceMonitoring?.enabled) {
      warnings.push('Predictive scaling works best with performance monitoring');
    }
  }

  /**
   * Check recycling configuration
   * @nist ac-3 "Access enforcement"
   */
  private static checkRecyclingConfig(
    config: Partial<OptimizationConfig>,
    warnings: string[],
    recommendations: string[],
  ): void {
    if (config.recycling?.enabled) {
      const recycling = config.recycling;

      if (recycling.maxLifetimeMs && recycling.maxLifetimeMs < 60000) {
        warnings.push('Very short browser lifetime may impact performance');
      }

      if (recycling.maxIdleTimeMs && recycling.maxIdleTimeMs < 30000) {
        warnings.push('Very short idle time may cause excessive recycling');
      }

      if (
        recycling.strategy === RecyclingStrategy.AGGRESSIVE &&
        !config.resourceMonitoring?.enabled
      ) {
        recommendations.push('Enable resource monitoring for aggressive recycling');
      }
    }
  }

  /**
   * Check circuit breaker configuration
   * @nist ac-3 "Access enforcement"
   */
  private static checkCircuitBreakerConfig(
    config: Partial<OptimizationConfig>,
    recommendations: string[],
  ): void {
    if (config.circuitBreaker?.enabled && !config.performanceMonitoring?.enabled) {
      recommendations.push('Enable performance monitoring for circuit breaker');
    }
  }

  /**
   * Check resource monitoring configuration
   * @nist ac-3 "Access enforcement"
   */
  private static checkResourceMonitoringConfig(
    config: Partial<OptimizationConfig>,
    recommendations: string[],
  ): void {
    if (config.resourceMonitoring?.enabled && !config.performanceMonitoring?.enabled) {
      recommendations.push('Enable performance monitoring with resource monitoring');
    }
  }

  /**
   * Analyze compatibility requirements
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static analyzeCompatibility(currentUsage: UsageStatistics): CompatibilityAnalysis {
    return CompatibilityValidator.analyzeCompatibility(currentUsage);
  }

  /**
   * Validate migration readiness
   * @nist ac-3 "Access enforcement"
   */
  static validateMigrationReadiness(
    currentConfig: CompatibilityConfig,
    targetConfig: Partial<OptimizationConfig>,
  ): CompatibilityCheckResult {
    return CompatibilityValidator.validateMigrationReadiness(currentConfig, targetConfig);
  }
}
