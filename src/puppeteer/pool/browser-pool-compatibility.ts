/**
 * Backward compatibility layer for browser pool optimization
 * @module puppeteer/pool/browser-pool-compatibility
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */

import { createLogger } from '../../utils/logger.js';
import { BrowserPool } from './browser-pool.js';
import { OptimizedBrowserPool, type OptimizationConfig } from './browser-pool-optimized.js';
import type { BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import { RecyclingStrategy } from './browser-pool-recycler.js';

const logger = createLogger('browser-pool-compatibility');

/**
 * Compatibility configuration
 */
export interface CompatibilityConfig {
  /** Enable optimization features */
  enableOptimization: boolean;
  /** Use legacy behavior for specific operations */
  useLegacyBehavior: boolean;
  /** Migration mode for gradual adoption */
  migrationMode: boolean;
  /** Fallback to legacy on optimization errors */
  fallbackToLegacy: boolean;
  /** Log compatibility warnings */
  logWarnings: boolean;
  /** Optimization configuration (when enabled) */
  optimization?: Partial<OptimizationConfig>;
}

/**
 * Factory for creating browser pool instances with backward compatibility
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */
export class BrowserPoolFactory {
  private static defaultCompatibilityConfig: CompatibilityConfig = {
    enableOptimization: false,
    useLegacyBehavior: false,
    migrationMode: false,
    fallbackToLegacy: true,
    logWarnings: true,
    optimization: {
      enabled: true,
      autoOptimization: false,
      optimizationInterval: 60000,
      scaling: { enabled: false },
      resourceMonitoring: { enabled: false },
      recycling: { enabled: false },
      circuitBreaker: { enabled: false },
      performanceMonitoring: { enabled: false },
    },
  };

  /**
   * Create a browser pool instance with compatibility considerations
   * @nist ac-3 "Access enforcement"
   */
  static create(
    options: Partial<BrowserPoolOptions> = {},
    compatibilityConfig: Partial<CompatibilityConfig> = {}
  ): BrowserPool | OptimizedBrowserPool {
    const config = {
      ...BrowserPoolFactory.defaultCompatibilityConfig,
      ...compatibilityConfig,
    };

    if (config.logWarnings) {
      logger.info(
        {
          enableOptimization: config.enableOptimization,
          migrationMode: config.migrationMode,
          fallbackToLegacy: config.fallbackToLegacy,
        },
        'Creating browser pool with compatibility configuration'
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
    try {
      const optimizedPool = new OptimizedBrowserPool(options, config.optimization);
      
      if (config.migrationMode) {
        return new CompatibilityWrapper(optimizedPool, config);
      }
      
      return optimizedPool;
    } catch (error) {
      if (config.fallbackToLegacy) {
        logger.error(
          { error },
          'Failed to create optimized browser pool, falling back to legacy'
        );
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
    return new BrowserPool(options);
  }

  /**
   * Create an optimized browser pool instance
   * @nist ac-3 "Access enforcement"
   */
  static createOptimized(
    options: Partial<BrowserPoolOptions> = {},
    optimizationConfig: Partial<OptimizationConfig> = {}
  ): OptimizedBrowserPool {
    return new OptimizedBrowserPool(options, optimizationConfig);
  }

  /**
   * Update default compatibility configuration
   * @nist cm-7 "Least functionality"
   */
  static updateDefaultCompatibilityConfig(config: Partial<CompatibilityConfig>): void {
    BrowserPoolFactory.defaultCompatibilityConfig = {
      ...BrowserPoolFactory.defaultCompatibilityConfig,
      ...config,
    };
    
    logger.info(
      {
        config: BrowserPoolFactory.defaultCompatibilityConfig,
      },
      'Default compatibility configuration updated'
    );
  }
}

/**
 * Compatibility wrapper for gradual migration
 * @nist ac-3 "Access enforcement"
 */
class CompatibilityWrapper extends OptimizedBrowserPool {
  private compatibilityConfig: CompatibilityConfig;
  private legacyPool: BrowserPool;
  private migrationMetrics: {
    optimizedCalls: number;
    legacyFallbacks: number;
    errors: number;
  };

  constructor(
    _optimizedPool: OptimizedBrowserPool,
    compatibilityConfig: CompatibilityConfig
  ) {
    // This is a simplified approach - in a real implementation,
    // we'd need to properly extend or wrap the optimized pool
    super();
    this.compatibilityConfig = compatibilityConfig;
    this.legacyPool = new BrowserPool();
    this.migrationMetrics = {
      optimizedCalls: 0,
      legacyFallbacks: 0,
      errors: 0,
    };
  }

  /**
   * Initialize with compatibility handling
   * @nist ac-3 "Access enforcement"
   */
  async initialize(): Promise<void> {
    try {
      await super.initialize();
      this.migrationMetrics.optimizedCalls++;
      
      if (this.compatibilityConfig.logWarnings) {
        logger.info('Optimized browser pool initialized successfully');
      }
    } catch (error) {
      this.migrationMetrics.errors++;
      
      if (this.compatibilityConfig.fallbackToLegacy) {
        logger.warn(
          { error },
          'Optimized initialization failed, falling back to legacy'
        );
        
        await this.legacyPool.initialize();
        this.migrationMetrics.legacyFallbacks++;
      } else {
        throw error;
      }
    }
  }

  /**
   * Enhanced browser acquisition with fallback
   * @nist ac-3 "Access enforcement"
   */
  async acquireBrowser(sessionId: string): Promise<any> {
    try {
      const browser = await super.acquireBrowser(sessionId);
      this.migrationMetrics.optimizedCalls++;
      return browser;
    } catch (error) {
      this.migrationMetrics.errors++;
      
      if (this.compatibilityConfig.fallbackToLegacy) {
        logger.warn(
          { error, sessionId },
          'Optimized browser acquisition failed, falling back to legacy'
        );
        
        const browser = await this.legacyPool.acquireBrowser(sessionId);
        this.migrationMetrics.legacyFallbacks++;
        return browser;
      }
      
      throw error;
    }
  }

  /**
   * Enhanced browser release with fallback
   * @nist ac-12 "Session termination"
   */
  async releaseBrowser(browserId: string, sessionId: string): Promise<void> {
    try {
      await super.releaseBrowser(browserId, sessionId);
      this.migrationMetrics.optimizedCalls++;
    } catch (error) {
      this.migrationMetrics.errors++;
      
      if (this.compatibilityConfig.fallbackToLegacy) {
        logger.warn(
          { error, browserId, sessionId },
          'Optimized browser release failed, falling back to legacy'
        );
        
        await this.legacyPool.releaseBrowser(browserId, sessionId);
        this.migrationMetrics.legacyFallbacks++;
      } else {
        throw error;
      }
    }
  }

  /**
   * Enhanced page creation with fallback
   * @nist ac-4 "Information flow enforcement"
   */
  override async createPage(browserId: string, sessionId: string): Promise<any> {
    try {
      const page = await super.createPage(browserId, sessionId);
      this.migrationMetrics.optimizedCalls++;
      return page;
    } catch (error) {
      this.migrationMetrics.errors++;
      
      if (this.compatibilityConfig.fallbackToLegacy) {
        logger.warn(
          { error, browserId, sessionId },
          'Optimized page creation failed, falling back to legacy'
        );
        
        const page = await this.legacyPool.createPage(browserId, sessionId);
        this.migrationMetrics.legacyFallbacks++;
        return page;
      }
      
      throw error;
    }
  }

  /**
   * Enhanced page closure with fallback
   */
  override async closePage(browserId: string, sessionId: string): Promise<void> {
    try {
      await super.closePage(browserId, sessionId);
      this.migrationMetrics.optimizedCalls++;
    } catch (error) {
      this.migrationMetrics.errors++;
      
      if (this.compatibilityConfig.fallbackToLegacy) {
        logger.warn(
          { error, browserId, sessionId },
          'Optimized page closure failed, falling back to legacy'
        );
        
        await this.legacyPool.closePage(browserId, sessionId);
        this.migrationMetrics.legacyFallbacks++;
      } else {
        throw error;
      }
    }
  }

  /**
   * Enhanced health check with fallback
   * @nist si-4 "Information system monitoring"
   */
  override async healthCheck(): Promise<Map<string, boolean>> {
    try {
      const results = await super.healthCheck();
      this.migrationMetrics.optimizedCalls++;
      return results;
    } catch (error) {
      this.migrationMetrics.errors++;
      
      if (this.compatibilityConfig.fallbackToLegacy) {
        logger.warn(
          { error },
          'Optimized health check failed, falling back to legacy'
        );
        
        const results = await this.legacyPool.healthCheck();
        this.migrationMetrics.legacyFallbacks++;
        return results;
      }
      
      throw error;
    }
  }

  /**
   * Get migration metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getMigrationMetrics(): {
    optimizedCalls: number;
    legacyFallbacks: number;
    errors: number;
    optimizedSuccessRate: number;
    fallbackRate: number;
  } {
    const totalCalls = this.migrationMetrics.optimizedCalls + this.migrationMetrics.legacyFallbacks;
    
    return {
      ...this.migrationMetrics,
      optimizedSuccessRate: totalCalls > 0 
        ? (this.migrationMetrics.optimizedCalls / totalCalls) * 100 
        : 0,
      fallbackRate: totalCalls > 0 
        ? (this.migrationMetrics.legacyFallbacks / totalCalls) * 100 
        : 0,
    };
  }

  /**
   * Enhanced shutdown with fallback
   * @nist ac-12 "Session termination"
   */
  override async shutdown(): Promise<void> {
    try {
      await super.shutdown();
      this.migrationMetrics.optimizedCalls++;
    } catch (error) {
      this.migrationMetrics.errors++;
      
      if (this.compatibilityConfig.fallbackToLegacy) {
        logger.warn(
          { error },
          'Optimized shutdown failed, falling back to legacy'
        );
        
        await this.legacyPool.shutdown();
        this.migrationMetrics.legacyFallbacks++;
      } else {
        throw error;
      }
    }

    // Log final migration metrics
    if (this.compatibilityConfig.logWarnings) {
      const metrics = this.getMigrationMetrics();
      logger.info(
        {
          metrics,
        },
        'Browser pool migration metrics'
      );
    }
  }
}

/**
 * Migration utilities for gradual adoption
 */
export class MigrationUtils {
  /**
   * Analyze compatibility requirements
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static analyzeCompatibility(
    currentUsage: {
      averagePoolSize: number;
      peakPoolSize: number;
      errorRate: number;
      resourceUsage: number;
    }
  ): {
    recommendOptimization: boolean;
    suggestedConfig: Partial<OptimizationConfig>;
    migrationRisk: 'low' | 'medium' | 'high';
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let recommendOptimization = false;
    let migrationRisk: 'low' | 'medium' | 'high' = 'low';

    // Analyze pool size patterns
    if (currentUsage.peakPoolSize > 10) {
      recommendOptimization = true;
      recommendations.push('Enable adaptive scaling for large pool sizes');
    }

    // Analyze error patterns
    if (currentUsage.errorRate > 5) {
      recommendOptimization = true;
      recommendations.push('Enable circuit breaker patterns for high error rates');
      migrationRisk = 'medium';
    }

    // Analyze resource usage
    if (currentUsage.resourceUsage > 80) {
      recommendOptimization = true;
      recommendations.push('Enable resource monitoring for high resource usage');
      migrationRisk = 'high';
    }

    const suggestedConfig: Partial<OptimizationConfig> = {
      enabled: recommendOptimization,
      autoOptimization: false, // Start with manual optimization
      scaling: {
        enabled: currentUsage.peakPoolSize > 10,
        minSize: Math.max(1, Math.floor(currentUsage.averagePoolSize * 0.5)),
        maxSize: Math.max(10, currentUsage.peakPoolSize * 1.5),
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
      },
      recycling: {
        enabled: true,
        strategy: RecyclingStrategy.HYBRID,
        maxLifetimeMs: 3600000,
        maxIdleTimeMs: 600000,
        maxUseCount: 1000,
        maxPageCount: 100,
        healthCheckInterval: 30000,
        healthThreshold: 0.7,
        consecutiveFailuresLimit: 3,
        maxMemoryUsageMB: 500,
        maxCpuUsagePercent: 80,
        maxConnectionCount: 50,
        maxHandleCount: 1000,
        weightTimeBasedScore: 0.25,
        weightUsageBasedScore: 0.25,
        weightHealthBasedScore: 0.25,
        weightResourceBasedScore: 0.25,
        recyclingThreshold: 0.8,
        batchRecyclingEnabled: true,
        maxBatchSize: 5,
        recyclingCooldownMs: 5000,
        scheduledMaintenanceEnabled: false,
        maintenanceInterval: 86400000,
        maintenanceWindowStart: 2,
        maintenanceWindowEnd: 6,
        gracefulShutdownEnabled: true,
        gracefulShutdownTimeoutMs: 30000,
        preRecyclingWarmupEnabled: true,
        warmupPoolSize: 2,
      },
      circuitBreaker: {
        enabled: currentUsage.errorRate > 2,
      },
      performanceMonitoring: {
        enabled: true,
        alertingEnabled: migrationRisk !== 'low',
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
   * Generate migration plan
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  static generateMigrationPlan(
    currentUsage: any,
    targetConfig: Partial<OptimizationConfig>
  ): {
    phases: Array<{
      phase: number;
      name: string;
      duration: string;
      config: Partial<OptimizationConfig>;
      rollbackPlan: string;
      successCriteria: string[];
    }>;
    totalDuration: string;
    riskMitigation: string[];
  } {
    const phases = [
      {
        phase: 1,
        name: 'Performance Monitoring',
        duration: '1-2 weeks',
        config: {
          enabled: true,
          autoOptimization: false,
          performanceMonitoring: { enabled: true, alertingEnabled: true },
        },
        rollbackPlan: 'Disable performance monitoring',
        successCriteria: [
          'Performance metrics collected successfully',
          'No performance degradation observed',
          'Alerts configured and functioning',
        ],
      },
      {
        phase: 2,
        name: 'Resource Monitoring',
        duration: '1-2 weeks',
        config: {
          enabled: true,
          autoOptimization: false,
          performanceMonitoring: { enabled: true, alertingEnabled: true },
          resourceMonitoring: { enabled: true, enableSystemMonitoring: true },
        },
        rollbackPlan: 'Disable resource monitoring',
        successCriteria: [
          'Resource metrics collected successfully',
          'Memory and CPU usage monitored',
          'Resource alerts functioning',
        ],
      },
      {
        phase: 3,
        name: 'Browser Recycling',
        duration: '2-3 weeks',
        config: {
          enabled: true,
          autoOptimization: false,
          performanceMonitoring: { enabled: true, alertingEnabled: true },
          resourceMonitoring: { enabled: true, enableSystemMonitoring: true },
          recycling: { enabled: true, strategy: RecyclingStrategy.HYBRID },
        },
        rollbackPlan: 'Disable browser recycling',
        successCriteria: [
          'Browser recycling working correctly',
          'No impact on browser availability',
          'Improved resource utilization',
        ],
      },
      {
        phase: 4,
        name: 'Circuit Breaker',
        duration: '1-2 weeks',
        config: {
          enabled: true,
          autoOptimization: false,
          performanceMonitoring: { enabled: true, alertingEnabled: true },
          resourceMonitoring: { enabled: true, enableSystemMonitoring: true },
          recycling: { enabled: true, strategy: RecyclingStrategy.HYBRID },
          circuitBreaker: { enabled: true },
        },
        rollbackPlan: 'Disable circuit breaker',
        successCriteria: [
          'Circuit breaker preventing cascading failures',
          'Fallback mechanisms working',
          'Improved error handling',
        ],
      },
      {
        phase: 5,
        name: 'Adaptive Scaling',
        duration: '2-4 weeks',
        config: {
          enabled: true,
          autoOptimization: false,
          performanceMonitoring: { enabled: true, alertingEnabled: true },
          resourceMonitoring: { enabled: true, enableSystemMonitoring: true },
          recycling: { enabled: true, strategy: RecyclingStrategy.HYBRID },
          circuitBreaker: { enabled: true },
          scaling: { enabled: true, strategy: 'hybrid' },
        },
        rollbackPlan: 'Disable adaptive scaling',
        successCriteria: [
          'Scaling decisions are accurate',
          'Pool size optimized for load',
          'No scaling oscillation',
        ],
      },
      {
        phase: 6,
        name: 'Auto-Optimization',
        duration: '2-3 weeks',
        config: {
          ...targetConfig,
          autoOptimization: true,
        },
        rollbackPlan: 'Disable auto-optimization',
        successCriteria: [
          'Auto-optimization improving performance',
          'Recommendations being applied correctly',
          'System stability maintained',
        ],
      },
    ];

    const riskMitigation = [
      'Implement comprehensive monitoring before enabling features',
      'Use gradual rollout with fallback mechanisms',
      'Monitor key metrics during each phase',
      'Implement automated rollback triggers',
      'Maintain legacy fallback options',
      'Conduct thorough testing in staging environment',
    ];

    return {
      phases,
      totalDuration: '8-16 weeks',
      riskMitigation,
    };
  }
}

/**
 * Export factory as default for backward compatibility
 */
export default BrowserPoolFactory;

/**
 * Legacy export for backward compatibility
 */
export { BrowserPool as LegacyBrowserPool };
export { OptimizedBrowserPool as EnhancedBrowserPool };