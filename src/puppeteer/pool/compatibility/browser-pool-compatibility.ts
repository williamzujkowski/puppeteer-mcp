/**
 * Main browser pool compatibility orchestrator
 * @module puppeteer/pool/compatibility/browser-pool-compatibility
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */

import { createLogger } from '../../../utils/logger.js';
import { BrowserPool } from '../browser-pool.js';
import { OptimizedBrowserPool } from '../browser-pool-optimized.js';
import type { BrowserPoolOptions, BrowserInstance } from '../../interfaces/browser-pool.interface.js';
import type { OptimizationConfig } from '../browser-pool-optimized.js';
import type { Page } from 'puppeteer';
import { MigrationExecutor } from './migration-executor.js';
import { CompatibilityChecker } from './compatibility-checker.js';
import { MigrationPlanner } from './migration-planner.js';
import { VersionDetector } from './version-detector.js';
import { CompatibilityUtils } from './compatibility-utils.js';
import type { 
  CompatibilityConfig, 
  UsageStatistics, 
  ExtendedMigrationMetrics,
  CompatibilityAnalysis,
  MigrationPlan,
  CompatibilityCheckResult 
} from './types.js';
import { DEFAULT_COMPATIBILITY_CONFIG } from './types.js';

const logger = createLogger('browser-pool-compatibility');

/**
 * Factory for creating browser pool instances with backward compatibility
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */
export class BrowserPoolFactory {
  private static defaultCompatibilityConfig: CompatibilityConfig = DEFAULT_COMPATIBILITY_CONFIG;

  /**
   * Create a browser pool instance with compatibility considerations
   * @nist ac-3 "Access enforcement"
   */
  static create(
    options: Partial<BrowserPoolOptions> = {},
    compatibilityConfig: Partial<CompatibilityConfig> = {},
  ): BrowserPool | OptimizedBrowserPool {
    const config = CompatibilityUtils.mergeConfigs(
      BrowserPoolFactory.defaultCompatibilityConfig,
      compatibilityConfig,
    );

    // Validate configuration
    const validationIssues = CompatibilityUtils.validateConfigConsistency(config);
    if (validationIssues.length > 0) {
      logger.warn({ issues: validationIssues }, 'Configuration validation issues detected');
    }

    if (config.logWarnings) {
      logger.info(
        {
          enableOptimization: config.enableOptimization,
          migrationMode: config.migrationMode,
          fallbackToLegacy: config.fallbackToLegacy,
          version: VersionDetector.detectVersion(),
        },
        'Creating browser pool with compatibility configuration',
      );
    }

    // Create legacy pool if optimization is disabled
    if (!config.enableOptimization) {
      if (config.logWarnings) {
        logger.warn('Using legacy browser pool - optimization features disabled');
      }
      return new BrowserPool(options);
    }

    // Create optimized pool with compatibility wrapper
    return BrowserPoolFactory.createOptimizedWithCompatibility(options, config);
  }

  /**
   * Create optimized pool with compatibility wrapper
   * @nist ac-3 "Access enforcement"
   */
  private static createOptimizedWithCompatibility(
    options: Partial<BrowserPoolOptions>,
    config: CompatibilityConfig,
  ): BrowserPool | OptimizedBrowserPool {
    try {
      const optimizedPool = new OptimizedBrowserPool(options, config.optimization);

      if (config.migrationMode) {
        return new CompatibilityWrapper(optimizedPool, config);
      }

      return optimizedPool;
    } catch (error) {
      if (config.fallbackToLegacy) {
        logger.error({ error }, 'Failed to create optimized browser pool, falling back to legacy');
        return new BrowserPool(options);
      }
      throw error;
    }
  }

  /**
   * Create a legacy browser pool instance
   * @nist ac-3 "Access enforcement"
   */
  static createLegacy(options: Partial<BrowserPoolOptions> = {}): BrowserPool {
    logger.info('Creating legacy browser pool');
    return new BrowserPool(options);
  }

  /**
   * Create an optimized browser pool instance
   * @nist ac-3 "Access enforcement"
   */
  static createOptimized(
    options: Partial<BrowserPoolOptions> = {},
    optimizationConfig: Partial<OptimizationConfig> = {},
  ): OptimizedBrowserPool {
    logger.info('Creating optimized browser pool');
    return new OptimizedBrowserPool(options, optimizationConfig);
  }

  /**
   * Update default compatibility configuration
   * @nist cm-7 "Least functionality"
   */
  static updateDefaultCompatibilityConfig(config: Partial<CompatibilityConfig>): void {
    BrowserPoolFactory.defaultCompatibilityConfig = CompatibilityUtils.mergeConfigs(
      BrowserPoolFactory.defaultCompatibilityConfig,
      config,
    );

    logger.info(
      { config: BrowserPoolFactory.defaultCompatibilityConfig },
      'Default compatibility configuration updated',
    );
  }

  /**
   * Get current default compatibility configuration
   * @nist ac-3 "Access enforcement"
   */
  static getDefaultCompatibilityConfig(): CompatibilityConfig {
    return { ...BrowserPoolFactory.defaultCompatibilityConfig };
  }

  /**
   * Analyze compatibility for given usage patterns
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static analyzeCompatibility(currentUsage: UsageStatistics): CompatibilityAnalysis {
    return CompatibilityChecker.analyzeCompatibility(currentUsage);
  }

  /**
   * Generate migration plan
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static generateMigrationPlan(
    currentUsage: UsageStatistics,
    targetConfig: Partial<OptimizationConfig>,
  ): MigrationPlan {
    return MigrationPlanner.generateMigrationPlan(currentUsage, targetConfig);
  }

  /**
   * Check configuration compatibility
   * @nist ac-3 "Access enforcement"
   */
  static checkCompatibility(config: CompatibilityConfig): CompatibilityCheckResult {
    return CompatibilityChecker.checkCompatibility(config);
  }
}

/**
 * Compatibility wrapper for gradual migration
 * @nist ac-3 "Access enforcement"
 */
class CompatibilityWrapper extends OptimizedBrowserPool {
  private migrationExecutor: MigrationExecutor;

  constructor(optimizedPool: OptimizedBrowserPool, compatibilityConfig: CompatibilityConfig) {
    // This is a simplified approach - in a real implementation,
    // we'd need to properly extend or wrap the optimized pool
    super();
    this.migrationExecutor = new MigrationExecutor(optimizedPool, compatibilityConfig);
  }

  /**
   * Initialize with compatibility handling
   * @nist ac-3 "Access enforcement"
   */
  override async initialize(): Promise<void> {
    await this.migrationExecutor.initialize();
  }

  /**
   * Enhanced browser acquisition with fallback
   * @nist ac-3 "Access enforcement"
   */
  override async acquireBrowser(sessionId: string): Promise<BrowserInstance> {
    return this.migrationExecutor.acquireBrowser(sessionId) as Promise<BrowserInstance>;
  }

  /**
   * Enhanced browser release with fallback
   * @nist ac-12 "Session termination"
   */
  override async releaseBrowser(browserId: string, sessionId: string): Promise<void> {
    return this.migrationExecutor.releaseBrowser(browserId, sessionId);
  }

  /**
   * Enhanced page creation with fallback
   * @nist ac-4 "Information flow enforcement"
   */
  override async createPage(browserId: string, sessionId: string): Promise<Page> {
    return this.migrationExecutor.createPage(browserId, sessionId) as Promise<Page>;
  }

  /**
   * Enhanced page closure with fallback
   * @nist ac-12 "Session termination"
   */
  override async closePage(browserId: string, sessionId: string): Promise<void> {
    return this.migrationExecutor.closePage(browserId, sessionId);
  }

  /**
   * Enhanced health check with fallback
   * @nist si-4 "Information system monitoring"
   */
  override async healthCheck(): Promise<Map<string, boolean>> {
    return this.migrationExecutor.healthCheck();
  }

  /**
   * Get migration metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMigrationMetrics(): ExtendedMigrationMetrics {
    return this.migrationExecutor.getMigrationMetrics();
  }

  /**
   * Get migration health status
   * @nist si-4 "Information system monitoring"
   */
  getMigrationHealth(): {
    isHealthy: boolean;
    metrics: ExtendedMigrationMetrics;
    recommendations: string[];
  } {
    return this.migrationExecutor.getMigrationHealth();
  }

  /**
   * Enhanced shutdown with fallback
   * @nist ac-12 "Session termination"
   */
  override async shutdown(): Promise<void> {
    await this.migrationExecutor.shutdown();
  }
}

/**
 * Migration utilities for gradual adoption
 * @nist au-6 "Audit review, analysis, and reporting"
 */
export class MigrationUtils {
  /**
   * Analyze compatibility requirements
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static analyzeCompatibility(currentUsage: UsageStatistics): CompatibilityAnalysis {
    return CompatibilityChecker.analyzeCompatibility(currentUsage);
  }

  /**
   * Generate migration plan
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static generateMigrationPlan(
    currentUsage: UsageStatistics,
    targetConfig: Partial<OptimizationConfig>,
  ): MigrationPlan {
    return MigrationPlanner.generateMigrationPlan(currentUsage, targetConfig);
  }

  /**
   * Check migration readiness
   * @nist ac-3 "Access enforcement"
   */
  static checkMigrationReadiness(
    currentConfig: CompatibilityConfig,
    targetConfig: Partial<OptimizationConfig>,
  ): CompatibilityCheckResult {
    return CompatibilityChecker.validateMigrationReadiness(currentConfig, targetConfig);
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
    return CompatibilityUtils.generateCompatibilityReport(config, usage, metrics);
  }
}

/**
 * Export factory as default for backward compatibility
 */
export default BrowserPoolFactory;

/**
 * Legacy exports for backward compatibility
 */
export { BrowserPool as LegacyBrowserPool };
export { OptimizedBrowserPool as EnhancedBrowserPool };
