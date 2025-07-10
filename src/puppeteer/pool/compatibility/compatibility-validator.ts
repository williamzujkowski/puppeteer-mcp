/**
 * Compatibility validation utilities
 * @module puppeteer/pool/compatibility/compatibility-validator
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */

import type { 
  CompatibilityConfig, 
  CompatibilityCheckResult, 
  UsageStatistics, 
  CompatibilityAnalysis,
  MigrationRisk 
} from './types.js';
import type { OptimizationConfig } from '../browser-pool-optimized.js';
import { RecyclingStrategy } from '../browser-pool-recycler.js';

/**
 * Compatibility validation utilities
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */
export class CompatibilityValidator {
  /**
   * Check migration prerequisites
   * @nist ac-3 "Access enforcement"
   */
  static checkMigrationPrerequisites(
    currentConfig: CompatibilityConfig,
    issues: string[],
    warnings: string[]
  ): void {
    if (!currentConfig.fallbackToLegacy) {
      issues.push('Fallback to legacy should be enabled during migration');
    }

    if (!currentConfig.logWarnings) {
      warnings.push('Enable logging during migration for better visibility');
    }
  }

  /**
   * Check target configuration
   * @nist ac-3 "Access enforcement"
   */
  static checkTargetConfiguration(
    targetConfig: Partial<OptimizationConfig>,
    issues: string[]
  ): void {
    if (targetConfig.autoOptimization && !targetConfig.performanceMonitoring?.enabled) {
      issues.push('Performance monitoring required for auto-optimization');
    }

    if (targetConfig.scaling?.enablePredictiveScaling && 
        !targetConfig.performanceMonitoring?.enabled) {
      issues.push('Performance monitoring required for predictive scaling');
    }
  }

  /**
   * Check gradual migration requirements
   * @nist ac-3 "Access enforcement"
   */
  static checkGradualMigrationRequirements(
    currentConfig: CompatibilityConfig,
    targetConfig: Partial<OptimizationConfig>,
    recommendations: string[]
  ): void {
    if (targetConfig.scaling?.enabled && !currentConfig.migrationMode) {
      recommendations.push('Consider enabling migration mode for scaling features');
    }

    if (targetConfig.recycling?.strategy === RecyclingStrategy.AGGRESSIVE) {
      recommendations.push('Test aggressive recycling thoroughly before full deployment');
    }
  }

  /**
   * Analyze compatibility requirements
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static analyzeCompatibility(currentUsage: UsageStatistics): CompatibilityAnalysis {
    const recommendations: string[] = [];
    let recommendOptimization = false;
    let migrationRisk: MigrationRisk = 'low';

    // Analyze pool size patterns
    if (currentUsage.peakPoolSize > 10) {
      recommendOptimization = true;
      recommendations.push('Enable adaptive scaling for large pool sizes');
    }

    if (currentUsage.averagePoolSize > 5) {
      recommendOptimization = true;
      recommendations.push('Consider resource monitoring for average pool sizes');
    }

    // Analyze error patterns
    if (currentUsage.errorRate > 10) {
      recommendOptimization = true;
      recommendations.push('Enable circuit breaker patterns for high error rates');
      migrationRisk = 'high';
    } else if (currentUsage.errorRate > 5) {
      recommendOptimization = true;
      recommendations.push('Consider circuit breaker patterns for moderate error rates');
      migrationRisk = 'medium';
    }

    // Analyze resource usage
    if (currentUsage.resourceUsage > 90) {
      recommendOptimization = true;
      recommendations.push('Enable aggressive resource monitoring for very high usage');
      migrationRisk = 'high';
    } else if (currentUsage.resourceUsage > 80) {
      recommendOptimization = true;
      recommendations.push('Enable resource monitoring for high resource usage');
      migrationRisk = migrationRisk === 'high' ? 'high' : 'medium';
    }

    // Generate suggested configuration
    const suggestedConfig: Partial<OptimizationConfig> = {
      enabled: recommendOptimization,
      autoOptimization: false, // Start with manual optimization
      scaling: {
        enabled: currentUsage.peakPoolSize > 10,
        minSize: Math.max(1, Math.floor(currentUsage.averagePoolSize * 0.5)),
        maxSize: Math.max(10, Math.ceil(currentUsage.peakPoolSize * 1.5)),
        targetUtilization: 75,
        scaleUpThreshold: 80,
        scaleDownThreshold: 20,
        cooldownPeriod: 5000,
        enablePredictiveScaling: false,
        predictionWindow: 300000,
        aggressiveScaling: false,
      },
      resourceMonitoring: {
        enabled: currentUsage.resourceUsage > 60,
        enableSystemMonitoring: currentUsage.resourceUsage > 80,
      },
      recycling: {
        enabled: true,
        strategy: currentUsage.resourceUsage > 80 ? RecyclingStrategy.AGGRESSIVE : RecyclingStrategy.HYBRID,
      },
      circuitBreaker: {
        enabled: currentUsage.errorRate > 2,
        failureThreshold: Math.max(5, Math.ceil(currentUsage.errorRate * 1.5)),
        timeout: 30000,
      },
      performanceMonitoring: {
        enabled: true,
        alertingEnabled: migrationRisk !== 'low',
        detailedLogging: migrationRisk === 'high',
      },
    };

    return {
      recommendOptimization,
      suggestedConfig,
      migrationRisk,
      recommendations,
    };
  }

  /**
   * Validate migration readiness
   * @nist ac-3 "Access enforcement"
   */
  static validateMigrationReadiness(
    currentConfig: CompatibilityConfig,
    targetConfig: Partial<OptimizationConfig>
  ): CompatibilityCheckResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check prerequisites
    CompatibilityValidator.checkMigrationPrerequisites(currentConfig, issues, warnings);

    // Check target configuration
    CompatibilityValidator.checkTargetConfiguration(targetConfig, issues);

    // Check gradual migration requirements
    CompatibilityValidator.checkGradualMigrationRequirements(
      currentConfig,
      targetConfig,
      recommendations
    );

    return {
      isCompatible: issues.length === 0,
      issues,
      warnings,
      recommendations,
    };
  }
}