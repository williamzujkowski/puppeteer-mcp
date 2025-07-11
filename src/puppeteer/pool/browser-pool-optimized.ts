/**
 * Enhanced browser pool with optimization features
 * @module puppeteer/pool/browser-pool-optimized
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist ac-12 "Session termination"
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import type { Page } from 'puppeteer';
import { createLogger, logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type {
  BrowserPool as IBrowserPool,
  BrowserInstance,
  BrowserPoolOptions,
} from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { BrowserPool } from './browser-pool.js';

// Import optimization components
import { BrowserPoolScaling } from './browser-pool-scaling.js';
import { BrowserPoolResourceManager } from './browser-pool-resource-manager.js';
import { BrowserPoolRecycler } from './browser-pool-recycler.js';
import { CircuitBreakerRegistry } from './browser-pool-circuit-breaker.js';
import { BrowserPoolPerformanceMonitor } from './browser-pool-performance-monitor.js';
import type { ExtendedPoolMetrics } from './browser-pool-metrics.js';

// Import optimization modules
import { mergeOptimizationConfig, updateOptimizationConfig } from './optimization-config.js';
import type { OptimizationConfig, OptimizationStatus } from './optimization-config.js';
import { OptimizationOperations } from './optimization-operations.js';
import { OptimizationMonitoring } from './optimization-monitoring.js';
import { OptimizationEngine } from './optimization-engine.js';

const logger = createLogger('browser-pool-optimized');

/**
 * Enhanced browser pool with optimization features
 * @nist ac-3 "Access enforcement"
 * @nist si-4 "Information system monitoring"
 */
export class OptimizedBrowserPool extends BrowserPool implements IBrowserPool {
  private optimizationConfig: OptimizationConfig;
  private scaler!: BrowserPoolScaling;
  private resourceManager!: BrowserPoolResourceManager;
  private recycler!: BrowserPoolRecycler;
  private circuitBreakers!: CircuitBreakerRegistry;
  private performanceMonitor!: BrowserPoolPerformanceMonitor;
  private operations!: OptimizationOperations;
  private monitoring!: OptimizationMonitoring;
  private engine!: OptimizationEngine;
  private lastOptimizationCheck = new Date(0);
  private optimizationActions = { value: 0 };
  private readonly optimizationEnabled: boolean;

  constructor(
    options: Partial<BrowserPoolOptions> = {},
    optimizationConfig: Partial<OptimizationConfig> = {},
  ) {
    super(options);

    this.optimizationConfig = mergeOptimizationConfig(optimizationConfig);
    this.optimizationEnabled = this.optimizationConfig.enabled;

    this.initializeComponents();
    this.setupEventForwarding();
  }

  /**
   * Initialize all optimization components and modules
   */
  private initializeComponents(): void {
    // Initialize optimization components
    this.scaler = new BrowserPoolScaling('balanced');
    this.resourceManager = new BrowserPoolResourceManager(
      this.optimizationConfig.resourceMonitoring,
    );
    this.recycler = new BrowserPoolRecycler(this.optimizationConfig.recycling);
    this.circuitBreakers = new CircuitBreakerRegistry({
      globalConfig: this.optimizationConfig.circuitBreaker,
    });
    this.performanceMonitor = new BrowserPoolPerformanceMonitor(
      this.optimizationConfig.performanceMonitoring,
    );

    // Initialize optimization modules
    this.operations = new OptimizationOperations(
      this.circuitBreakers,
      this.performanceMonitor,
      this.resourceManager,
      this.optimizationEnabled,
    );

    this.monitoring = new OptimizationMonitoring(
      this.optimizationConfig,
      this.scaler,
      this.resourceManager,
      this.recycler,
      this.circuitBreakers,
      this.performanceMonitor,
      this.optimizationEnabled,
      this.lastOptimizationCheck,
      this.optimizationActions.value,
    );

    this.engine = new OptimizationEngine(
      this.optimizationConfig,
      this.scaler,
      this.resourceManager,
      this.recycler,
      this.circuitBreakers,
      this.performanceMonitor,
      this.optimizationEnabled,
      this.lastOptimizationCheck,
      this.optimizationActions,
    );
  }

  /**
   * Initialize the optimized pool
   */
  override async initialize(): Promise<void> {
    await super.initialize();

    if (!this.optimizationEnabled) {
      logger.info('Optimization features disabled');
      return;
    }

    try {
      await this.engine.startOptimizationComponents();

      if (this.optimizationConfig.autoOptimization) {
        this.engine.startOptimizationMonitoring(() => this.performOptimizationCheck());
      }

      logger.info(
        { optimizationConfig: this.optimizationConfig },
        'Optimization features initialized',
      );
      await this.logInitialization();
    } catch (error) {
      logger.error({ error }, 'Failed to initialize optimization features');
      throw error;
    }
  }

  override async acquireBrowser(sessionId: string): Promise<BrowserInstance> {
    return this.operations.acquireBrowser(
      sessionId,
      (sessionId) => super.acquireBrowser(sessionId),
      () => this.getExtendedMetrics(),
    );
  }

  override async releaseBrowser(browserId: string, sessionId: string): Promise<void> {
    return this.operations.releaseBrowser(browserId, sessionId, (browserId, sessionId) =>
      super.releaseBrowser(browserId, sessionId),
    );
  }

  override async createPage(browserId: string, sessionId: string): Promise<Page> {
    return this.operations.createPage(
      browserId,
      sessionId,
      (browserId, sessionId) => super.createPage(browserId, sessionId),
      (browserId) => this.getBrowser(browserId),
    );
  }

  override async healthCheck(): Promise<Map<string, boolean>> {
    return this.monitoring.healthCheck(() => super.healthCheck());
  }

  override getExtendedMetrics(): ExtendedPoolMetrics {
    return this.monitoring.getExtendedMetrics(super.getExtendedMetrics());
  }

  getOptimizationStatus(): OptimizationStatus {
    return this.monitoring.getOptimizationStatus();
  }

  async updateOptimizationConfig(newConfig: Partial<OptimizationConfig>): Promise<void> {
    const oldConfig = { ...this.optimizationConfig };
    this.optimizationConfig = updateOptimizationConfig(this.optimizationConfig, newConfig);

    await this.engine.updateComponentConfigurations(newConfig);
    logger.info(
      { newConfig: this.optimizationConfig, changes: Object.keys(newConfig) },
      'Configuration updated',
    );

    await logSecurityEvent(SecurityEventType.CONFIG_CHANGE, {
      resource: 'browser_pool_optimization',
      action: 'update_config',
      result: 'success',
      metadata: { changes: Object.keys(newConfig), newConfig: this.optimizationConfig },
    });

    this.emit('optimization-config-updated', { oldConfig, newConfig: this.optimizationConfig });
  }

  async forceOptimizationCheck(): Promise<void> {
    if (!this.optimizationEnabled) return;
    logger.info('Forcing optimization check');
    await this.performOptimizationCheck();
  }

  override async shutdown(): Promise<void> {
    if (this.optimizationEnabled) {
      this.engine.stopOptimizationMonitoring();
      await this.engine.stopOptimizationComponents();
    }
    await super.shutdown();
  }

  private async performOptimizationCheck(): Promise<void> {
    await this.engine.performOptimizationCheck(
      () => this.getBrowsersInternal(),
      () => this.getExtendedMetrics(),
      (browserId) => this.recycleBrowser(browserId),
    );
  }

  private async logInitialization(): Promise<void> {
    await logSecurityEvent(SecurityEventType.SERVICE_START, {
      resource: 'browser_pool_optimization',
      action: 'initialize',
      result: 'success',
      metadata: {
        scalingEnabled: true,
        resourceMonitoringEnabled: this.optimizationConfig.resourceMonitoring.enabled,
        recyclingEnabled: this.optimizationConfig.recycling.enabled,
        circuitBreakerEnabled: this.optimizationConfig.circuitBreaker.enabled,
        performanceMonitoringEnabled: this.optimizationConfig.performanceMonitoring.enabled,
        autoOptimization: this.optimizationConfig.autoOptimization,
      },
    });
  }

  private setupEventForwarding(): void {
    const events = [
      'scaling-recommendation',
      'browsers-recycled',
      'optimization-scaling-action',
      'optimization-resource-alert',
      'optimization-browsers-recycled',
      'optimization-performance-alert',
      'optimization-recommendation',
    ];

    events.forEach((event) => {
      this.engine.on(event, (data) => this.emit(event, data));
    });

    this.engine.on('metrics-collection-requested', () => {
      this.monitoring.handleMetricsCollectionRequest(() => this.getExtendedMetrics());
    });
  }

  private getBrowsersInternal(): Map<string, InternalBrowserInstance> {
    // This would need to be implemented to access the internal browsers map
    return new Map();
  }
}

export { DEFAULT_OPTIMIZATION_CONFIG } from './optimization-config.js';
export type { OptimizationConfig, OptimizationStatus };
