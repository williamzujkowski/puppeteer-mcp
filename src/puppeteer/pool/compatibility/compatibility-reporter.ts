/**
 * Compatibility reporting utilities
 * @module puppeteer/pool/compatibility/compatibility-reporter
 * @nist ac-3 "Access enforcement"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type {
  CompatibilityConfig,
  UsageStatistics,
  ExtendedMigrationMetrics,
} from './types.js';
import { CompatibilityUtils } from './compatibility-utils.js';

/**
 * Compatibility reporting utilities
 * @nist ac-3 "Access enforcement"
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class CompatibilityReporter {
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
   * Create configuration snapshot
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static createConfigSnapshot(config: CompatibilityConfig): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      enableOptimization: config.enableOptimization,
      useLegacyBehavior: config.useLegacyBehavior,
      migrationMode: config.migrationMode,
      fallbackToLegacy: config.fallbackToLegacy,
      logWarnings: config.logWarnings,
      optimizationFeatures: config.optimization
        ? {
            enabled: config.optimization.enabled,
            autoOptimization: config.optimization.autoOptimization,
            scaling: config.optimization.scaling?.enabled,
            resourceMonitoring: config.optimization.resourceMonitoring?.enabled,
            recycling: config.optimization.recycling?.enabled,
            circuitBreaker: config.optimization.circuitBreaker?.enabled,
            performanceMonitoring: config.optimization.performanceMonitoring?.enabled,
          }
        : null,
    };
  }

  /**
   * Compare two configurations
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static compareConfigs(
    configA: CompatibilityConfig,
    configB: CompatibilityConfig,
  ): {
    differences: string[];
    isSignificantChange: boolean;
  } {
    const differences: string[] = [];
    let isSignificantChange = false;

    // Compare basic settings
    if (configA.enableOptimization !== configB.enableOptimization) {
      differences.push(
        `enableOptimization: ${configA.enableOptimization} -> ${configB.enableOptimization}`,
      );
      isSignificantChange = true;
    }

    if (configA.useLegacyBehavior !== configB.useLegacyBehavior) {
      differences.push(
        `useLegacyBehavior: ${configA.useLegacyBehavior} -> ${configB.useLegacyBehavior}`,
      );
      isSignificantChange = true;
    }

    if (configA.migrationMode !== configB.migrationMode) {
      differences.push(`migrationMode: ${configA.migrationMode} -> ${configB.migrationMode}`);
    }

    if (configA.fallbackToLegacy !== configB.fallbackToLegacy) {
      differences.push(
        `fallbackToLegacy: ${configA.fallbackToLegacy} -> ${configB.fallbackToLegacy}`,
      );
      isSignificantChange = true;
    }

    // Compare optimization settings
    if (configA.optimization?.enabled !== configB.optimization?.enabled) {
      differences.push(
        `optimization.enabled: ${configA.optimization?.enabled} -> ${configB.optimization?.enabled}`,
      );
      isSignificantChange = true;
    }

    return {
      differences,
      isSignificantChange,
    };
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
    const usageSummary = CompatibilityUtils.generateUsageSummary(usage);
    const configSnapshot = CompatibilityReporter.createConfigSnapshot(config);

    const summary = [
      `Usage Classification: ${usageSummary.classification}`,
      `Risk Level: ${usageSummary.riskLevel}`,
      `Optimization Enabled: ${config.enableOptimization}`,
      `Migration Mode: ${config.migrationMode}`,
    ].join(', ');

    const details = {
      configuration: configSnapshot,
      usage,
      usageSummary,
      migrationMetrics: metrics,
    };

    const recommendations = [
      ...usageSummary.recommendations,
      ...(metrics?.fallbackRate && metrics.fallbackRate > 20
        ? ['Consider reviewing optimization configuration due to high fallback rate']
        : []),
    ];

    return {
      summary,
      details,
      recommendations,
    };
  }
}