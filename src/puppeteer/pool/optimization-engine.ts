/**
 * Core optimization engine with scaling, recycling, and component management
 * @module puppeteer/pool/optimization-engine
 * @nist si-4 "Information system monitoring"
 * @nist cm-7 "Least functionality"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import type { BrowserPoolScaler } from './browser-pool-scaling.js';
import type { BrowserPoolResourceManager } from './browser-pool-resource-manager.js';
import type { BrowserPoolRecycler } from './browser-pool-recycler.js';
import type { CircuitBreakerRegistry } from './browser-pool-circuit-breaker.js';
import type { BrowserPoolPerformanceMonitor } from './browser-pool-performance-monitor.js';
import type { ExtendedPoolMetrics } from './browser-pool-metrics.js';
import type { OptimizationConfig } from './optimization-config.js';
import { OptimizationChecks } from './optimization-checks.js';
import { OptimizationEvents } from './optimization-events.js';

const logger = createLogger('optimization-engine');

/**
 * Core optimization engine with scaling, recycling, and component management
 */
export class OptimizationEngine extends EventEmitter {
  private optimizationTimer?: NodeJS.Timeout;
  private checks: OptimizationChecks;
  private events: OptimizationEvents;

  constructor(
    private optimizationConfig: OptimizationConfig,
    private scaler: BrowserPoolScaler,
    private resourceManager: BrowserPoolResourceManager,
    private recycler: BrowserPoolRecycler,
    private circuitBreakers: CircuitBreakerRegistry,
    private performanceMonitor: BrowserPoolPerformanceMonitor,
    private optimizationEnabled: boolean,
    private lastOptimizationCheck: Date,
    private optimizationActions: { value: number }
  ) {
    super();
    
    this.checks = new OptimizationChecks(
      optimizationConfig, scaler, resourceManager, recycler, 
      performanceMonitor, optimizationEnabled, lastOptimizationCheck, optimizationActions
    );
    
    this.events = new OptimizationEvents(scaler, resourceManager, recycler, performanceMonitor);
    this.setupEventForwarding();
  }

  /**
   * Update component configurations
   */
  async updateComponentConfigurations(newConfig: Partial<OptimizationConfig>): Promise<void> {
    if (newConfig.scaling) {
      this.scaler.updateStrategy(newConfig.scaling);
    }
    if (newConfig.resourceMonitoring) {
      this.resourceManager.updateConfig(newConfig.resourceMonitoring);
    }
    if (newConfig.recycling) {
      this.recycler.updateConfig(newConfig.recycling);
    }
    if (newConfig.circuitBreaker) {
      this.circuitBreakers.updateGlobalConfig(newConfig.circuitBreaker);
    }
    if (newConfig.performanceMonitoring) {
      this.performanceMonitor.updateConfig(newConfig.performanceMonitoring);
    }
  }

  /**
   * Start optimization components
   */
  async startOptimizationComponents(): Promise<void> {
    // Start scaler
    if (this.optimizationConfig.scaling.enabled) {
      this.scaler.start();
    }

    // Start resource manager
    if (this.optimizationConfig.resourceMonitoring.enabled) {
      await this.resourceManager.start();
    }

    // Start recycler
    if (this.optimizationConfig.recycling.enabled) {
      this.recycler.start();
    }

    // Start performance monitor
    if (this.optimizationConfig.performanceMonitoring.enabled) {
      this.performanceMonitor.start();
    }

    logger.info('Optimization components started');
  }

  /**
   * Stop optimization components
   */
  async stopOptimizationComponents(): Promise<void> {
    this.scaler.stop();
    this.resourceManager.stop();
    this.recycler.stop();
    this.performanceMonitor.stop();
    this.circuitBreakers.destroy();

    logger.info('Optimization components stopped');
  }

  /**
   * Start optimization monitoring
   */
  startOptimizationMonitoring(
    performOptimizationCheck: () => Promise<void>
  ): void {
    this.optimizationTimer = setInterval(
      () => performOptimizationCheck(),
      this.optimizationConfig.optimizationInterval
    );

    logger.info(
      {
        interval: this.optimizationConfig.optimizationInterval,
      },
      'Optimization monitoring started'
    );
  }

  /**
   * Stop optimization monitoring
   */
  stopOptimizationMonitoring(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = undefined;
    }

    logger.info('Optimization monitoring stopped');
  }

  /**
   * Perform optimization check
   */
  async performOptimizationCheck(
    getBrowsersInternal: () => Map<string, InternalBrowserInstance>,
    getExtendedMetrics: () => ExtendedPoolMetrics,
    recycleBrowser: (browserId: string) => Promise<void>
  ): Promise<void> {
    await this.checks.performOptimizationCheck(getBrowsersInternal, getExtendedMetrics, recycleBrowser);
  }

  /**
   * Setup event forwarding
   */
  private setupEventForwarding(): void {
    // Forward all events from the events module
    this.events.on('optimization-scaling-action', (event) => this.emit('optimization-scaling-action', event));
    this.events.on('optimization-resource-alert', (alert) => this.emit('optimization-resource-alert', alert));
    this.events.on('optimization-browsers-recycled', (events) => this.emit('optimization-browsers-recycled', events));
    this.events.on('optimization-performance-alert', (alert) => this.emit('optimization-performance-alert', alert));
    this.events.on('optimization-recommendation', (recommendation) => this.emit('optimization-recommendation', recommendation));
    this.events.on('metrics-collection-requested', () => this.emit('metrics-collection-requested'));
  }
}