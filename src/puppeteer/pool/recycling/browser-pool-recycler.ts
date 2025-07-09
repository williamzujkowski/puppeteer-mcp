/**
 * Main browser pool recycler coordination
 * @module puppeteer/pool/recycling/browser-pool-recycler
 * @nist ac-12 "Session termination"
 * @nist si-4 "Information system monitoring"
 * @nist sc-2 "Application partitioning"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../utils/logger.js';
import type { InternalBrowserInstance } from '../browser-pool-maintenance.js';
import type { BrowserResourceUsage } from '../browser-pool-resource-manager.js';
import { BrowserHealthChecker } from './health-checker.js';
import { ResourceAnalyzer } from './resource-analyzer.js';
import { RecyclingScheduler } from './recycling-scheduler.js';
import { BrowserLifecycleManager } from './lifecycle-manager.js';
import { CleanupManager } from './cleanup-manager.js';
import { RecyclingMetricsCollector } from './recycling-metrics.js';
import { StrategyManager } from './strategy-manager.js';
import { RecyclingConfigManager } from './config-manager.js';
import { EvaluationEngine } from './evaluation-engine.js';
import type {
  RecyclingConfig,
  RecyclingCandidate,
  RecyclingEvent,
  RecyclingStats,
} from './types.js';
import type { HealthCheckResult } from './health-checker.js';

const logger = createLogger('browser-pool-recycler');

/**
 * Intelligent browser recycler
 * @nist ac-12 "Session termination"
 * @nist si-4 "Information system monitoring"
 */
export class BrowserPoolRecycler extends EventEmitter {
  private configManager: RecyclingConfigManager;
  private healthChecker: BrowserHealthChecker;
  private resourceAnalyzer: ResourceAnalyzer;
  private scheduler: RecyclingScheduler;
  private lifecycleManager: BrowserLifecycleManager;
  private cleanupManager: CleanupManager;
  private metricsCollector: RecyclingMetricsCollector;
  
  private strategyManager: StrategyManager;
  private evaluationEngine: EvaluationEngine;

  constructor(config: Partial<RecyclingConfig> = {}) {
    super();
    
    // Initialize components
    this.configManager = new RecyclingConfigManager(config);
    this.healthChecker = new BrowserHealthChecker();
    this.resourceAnalyzer = new ResourceAnalyzer();
    this.scheduler = new RecyclingScheduler(this.configManager.getConfig());
    this.lifecycleManager = new BrowserLifecycleManager();
    this.cleanupManager = new CleanupManager();
    this.metricsCollector = new RecyclingMetricsCollector();
    this.strategyManager = new StrategyManager();
    
    // Initialize evaluation engine
    this.evaluationEngine = new EvaluationEngine({
      healthChecker: this.healthChecker,
      resourceAnalyzer: this.resourceAnalyzer,
      strategyManager: this.strategyManager,
      lifecycleManager: this.lifecycleManager,
      getConfig: () => this.configManager.getConfig()
    });
    
    // Wire up events
    this.wireUpEvents();
  }

  /**
   * Wire up component events
   * @private
   */
  private wireUpEvents(): void {
    // Scheduler events
    this.scheduler.on('scheduled-maintenance-trigger', () => {
      this.emit('scheduled-maintenance-trigger');
    });
    
    this.scheduler.on('cooldown-expired', () => {
      this.emit('cooldown-expired');
    });
  }

  /**
   * Start the recycler
   * @nist si-4 "Information system monitoring"
   */
  start(): void {
    this.scheduler.start();
    this.emit('recycler-started');
  }

  /**
   * Stop the recycler
   */
  stop(): void {
    this.scheduler.stop();
    this.emit('recycler-stopped');
  }

  /**
   * Evaluate browsers for recycling
   * @nist ac-12 "Session termination"
   */
  evaluateBrowsers(
    browsers: Map<string, InternalBrowserInstance>,
    resourceUsage: Map<string, BrowserResourceUsage>
  ): RecyclingCandidate[] {
    return this.evaluationEngine.evaluateBrowsers(
      browsers,
      resourceUsage,
      this.configManager.getValue('recyclingThreshold')
    );
  }

  /**
   * Evaluate a single browser for recycling
   * @nist ac-12 "Session termination"
   */
  evaluateBrowser(
    instance: InternalBrowserInstance,
    resourceUsage?: BrowserResourceUsage
  ): RecyclingCandidate {
    return this.evaluationEngine.evaluateBrowser(
      instance,
      resourceUsage,
      this.configManager.getValue('recyclingThreshold')
    );
  }

  /**
   * Update health metrics for a browser
   * @nist si-4 "Information system monitoring"
   */
  updateHealthMetrics(browserId: string, healthResult: HealthCheckResult): void {
    this.healthChecker.updateHealthMetrics(browserId, healthResult);
  }

  /**
   * Execute recycling for candidates
   * @nist ac-12 "Session termination"
   */
  async executeRecycling(
    candidates: RecyclingCandidate[],
    recycleCallback: (browserId: string) => Promise<void>
  ): Promise<RecyclingEvent[]> {
    // Validate operation
    const validation = this.cleanupManager.validateCleanupOperation(
      candidates,
      this.scheduler.isInCooldown(),
      this.configManager.isEnabled()
    );
    
    if (!validation.valid) {
      logger.debug(validation.reason, 'Recycling operation skipped');
      return [];
    }
    
    // Prepare batch
    const toRecycle = this.cleanupManager.prepareCleanupBatch(
      candidates,
      this.configManager.getValue('batchRecyclingEnabled'),
      this.configManager.getValue('maxBatchSize')
    );
    
    // Mark browsers as recycling
    for (const candidate of toRecycle) {
      this.lifecycleManager.markAsRecycling(candidate.browserId);
    }
    
    // Execute cleanup
    const events = await this.cleanupManager.executeCleanup(
      toRecycle,
      recycleCallback,
      this.configManager.getValue('maxBatchSize')
    );
    
    // Update metrics and lifecycle
    for (const event of events) {
      this.metricsCollector.addRecyclingEvent(event);
      if (event.success) {
        this.lifecycleManager.markAsDisposed(event.browserId);
        this.healthChecker.clearHealthMetrics(event.browserId);
      }
    }
    
    if (events.length > 0) {
      this.scheduler.updateLastRecyclingTime();
      this.emit('browsers-recycled', events);
    }
    
    return events;
  }

  /**
   * Get recycling statistics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getRecyclingStats(): RecyclingStats {
    return this.metricsCollector.getRecyclingStats();
  }

  /**
   * Update recycling configuration
   * @nist cm-7 "Least functionality"
   */
  updateConfig(newConfig: Partial<RecyclingConfig>): void {
    // Validate config
    const errors = this.configManager.validateConfig(newConfig);
    if (errors.length > 0) {
      logger.error({ errors }, 'Invalid recycling configuration');
      return;
    }
    
    // Update config manager
    this.configManager.updateConfig(newConfig);
    
    // Update scheduler config
    this.scheduler.updateConfig(this.configManager.getConfig());
    
    // Forward config update event
    this.configManager.once('config-updated', (event) => {
      this.emit('config-updated', event);
    });
  }

  /**
   * Get lifecycle statistics
   */
  getLifecycleStats(): ReturnType<BrowserLifecycleManager['getLifecycleStats']> {
    return this.lifecycleManager.getLifecycleStats();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): ReturnType<RecyclingMetricsCollector['getPerformanceMetrics']> {
    return this.metricsCollector.getPerformanceMetrics();
  }

}