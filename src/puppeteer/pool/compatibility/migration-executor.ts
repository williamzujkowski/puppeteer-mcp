/**
 * Migration execution functionality
 * @module puppeteer/pool/compatibility/migration-executor
 * @nist ac-3 "Access enforcement"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { createLogger } from '../../../utils/logger.js';
import { BrowserPool } from '../browser-pool.js';
import { OptimizedBrowserPool } from '../browser-pool-optimized.js';
import type { CompatibilityConfig, MigrationMetrics, ExtendedMigrationMetrics } from './types.js';

const logger = createLogger('migration-executor');

/**
 * Migration executor for gradual adoption
 * @nist ac-3 "Access enforcement"
 */
export class MigrationExecutor {
  private compatibilityConfig: CompatibilityConfig;
  private optimizedPool: OptimizedBrowserPool;
  private legacyPool: BrowserPool;
  private migrationMetrics: MigrationMetrics;

  constructor(optimizedPool: OptimizedBrowserPool, compatibilityConfig: CompatibilityConfig) {
    this.compatibilityConfig = compatibilityConfig;
    this.optimizedPool = optimizedPool;
    this.legacyPool = new BrowserPool();
    this.migrationMetrics = {
      optimizedCalls: 0,
      legacyFallbacks: 0,
      errors: 0,
    };
  }

  /**
   * Execute with fallback support
   * @nist ac-3 "Access enforcement"
   */
  async executeWithFallback<T>(
    optimizedOperation: () => Promise<T>,
    legacyOperation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    try {
      const result = await optimizedOperation();
      this.migrationMetrics.optimizedCalls++;

      if (this.compatibilityConfig.logWarnings) {
        logger.debug({ operationName }, 'Optimized operation executed successfully');
      }

      return result;
    } catch (error) {
      this.migrationMetrics.errors++;

      if (this.compatibilityConfig.fallbackToLegacy) {
        logger.warn({ error, operationName }, 'Optimized operation failed, falling back to legacy');

        try {
          const result = await legacyOperation();
          this.migrationMetrics.legacyFallbacks++;
          return result;
        } catch (fallbackError) {
          logger.error({ error: fallbackError, operationName }, 'Legacy fallback also failed');
          throw fallbackError;
        }
      } else {
        logger.error(
          { error, operationName },
          'Optimized operation failed, no fallback configured',
        );
        throw error;
      }
    }
  }

  /**
   * Initialize pools with fallback
   * @nist ac-3 "Access enforcement"
   */
  async initialize(): Promise<void> {
    await this.executeWithFallback(
      () => this.optimizedPool.initialize(),
      () => this.legacyPool.initialize(),
      'initialize',
    );
  }

  /**
   * Enhanced browser acquisition with fallback
   * @nist ac-3 "Access enforcement"
   */
  async acquireBrowser(sessionId: string): Promise<unknown> {
    return this.executeWithFallback(
      () => this.optimizedPool.acquireBrowser(sessionId),
      () => this.legacyPool.acquireBrowser(sessionId),
      'acquireBrowser',
    );
  }

  /**
   * Enhanced browser release with fallback
   * @nist ac-12 "Session termination"
   */
  async releaseBrowser(browserId: string, sessionId: string): Promise<void> {
    return this.executeWithFallback(
      () => this.optimizedPool.releaseBrowser(browserId, sessionId),
      () => this.legacyPool.releaseBrowser(browserId, sessionId),
      'releaseBrowser',
    );
  }

  /**
   * Enhanced page creation with fallback
   * @nist ac-4 "Information flow enforcement"
   */
  async createPage(browserId: string, sessionId: string): Promise<unknown> {
    return this.executeWithFallback(
      () => this.optimizedPool.createPage(browserId, sessionId),
      () => this.legacyPool.createPage(browserId, sessionId),
      'createPage',
    );
  }

  /**
   * Enhanced page closure with fallback
   * @nist ac-12 "Session termination"
   */
  async closePage(browserId: string, sessionId: string): Promise<void> {
    return this.executeWithFallback(
      () => this.optimizedPool.closePage(browserId, sessionId),
      () => this.legacyPool.closePage(browserId, sessionId),
      'closePage',
    );
  }

  /**
   * Enhanced health check with fallback
   * @nist si-4 "Information system monitoring"
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    return this.executeWithFallback(
      () => this.optimizedPool.healthCheck(),
      () => this.legacyPool.healthCheck(),
      'healthCheck',
    );
  }

  /**
   * Enhanced shutdown with fallback
   * @nist ac-12 "Session termination"
   */
  async shutdown(): Promise<void> {
    try {
      await this.executeWithFallback(
        () => this.optimizedPool.shutdown(),
        () => this.legacyPool.shutdown(),
        'shutdown',
      );
    } finally {
      // Log final migration metrics
      if (this.compatibilityConfig.logWarnings) {
        const metrics = this.getMigrationMetrics();
        logger.info({ metrics }, 'Browser pool migration metrics');
      }
    }
  }

  /**
   * Get migration metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMigrationMetrics(): ExtendedMigrationMetrics {
    const totalCalls = this.migrationMetrics.optimizedCalls + this.migrationMetrics.legacyFallbacks;

    return {
      ...this.migrationMetrics,
      optimizedSuccessRate:
        totalCalls > 0 ? (this.migrationMetrics.optimizedCalls / totalCalls) * 100 : 0,
      fallbackRate: totalCalls > 0 ? (this.migrationMetrics.legacyFallbacks / totalCalls) * 100 : 0,
    };
  }

  /**
   * Reset migration metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  resetMigrationMetrics(): void {
    this.migrationMetrics = {
      optimizedCalls: 0,
      legacyFallbacks: 0,
      errors: 0,
    };

    logger.info('Migration metrics reset');
  }

  /**
   * Update compatibility configuration
   * @nist cm-7 "Least functionality"
   */
  updateCompatibilityConfig(config: Partial<CompatibilityConfig>): void {
    this.compatibilityConfig = {
      ...this.compatibilityConfig,
      ...config,
    };

    logger.info({ config: this.compatibilityConfig }, 'Compatibility configuration updated');
  }

  /**
   * Check if migration is healthy
   * @nist si-4 "Information system monitoring"
   */
  isMigrationHealthy(): boolean {
    const metrics = this.getMigrationMetrics();
    const totalCalls = this.migrationMetrics.optimizedCalls + this.migrationMetrics.legacyFallbacks;

    // Consider migration healthy if:
    // - Less than 10% fallback rate
    // - Less than 5% error rate
    // - At least some successful operations

    if (totalCalls === 0) return true; // No operations yet

    const errorRate = (this.migrationMetrics.errors / totalCalls) * 100;
    const fallbackRate = metrics.fallbackRate;

    return errorRate < 5 && fallbackRate < 10;
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
    const metrics = this.getMigrationMetrics();
    const isHealthy = this.isMigrationHealthy();
    const recommendations: string[] = [];

    if (metrics.fallbackRate > 20) {
      recommendations.push('High fallback rate detected - review optimization configuration');
    }

    if (metrics.fallbackRate > 10) {
      recommendations.push('Moderate fallback rate - consider gradual feature rollout');
    }

    const totalCalls = this.migrationMetrics.optimizedCalls + this.migrationMetrics.legacyFallbacks;
    const errorRate = totalCalls > 0 ? (this.migrationMetrics.errors / totalCalls) * 100 : 0;

    if (errorRate > 10) {
      recommendations.push('High error rate detected - review system stability');
    }

    if (errorRate > 5) {
      recommendations.push('Moderate error rate - monitor system health closely');
    }

    if (totalCalls > 0 && metrics.optimizedSuccessRate > 90) {
      recommendations.push(
        'High optimization success rate - consider reducing fallback dependency',
      );
    }

    return {
      isHealthy,
      metrics,
      recommendations,
    };
  }
}
