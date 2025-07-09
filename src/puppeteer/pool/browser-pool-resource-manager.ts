/**
 * Advanced resource management for browser pool optimization
 * @module puppeteer/pool/browser-pool-resource-manager
 * @nist si-4 "Information system monitoring"
 * @nist sc-2 "Application partitioning"
 * @nist sc-3 "Security function isolation"
 */

import { EventEmitter } from 'events';
import type { Browser } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';

// Import types
import type {
  SystemResources,
  BrowserResourceUsage,
  ResourceThresholds,
  ResourceMonitoringConfig,
  ResourceAlert,
  MemoryOptimizationOptions,
  CpuOptimizationOptions,
} from './resource-management/resource-types.js';

// Import factory and components
import { ResourceManagerFactory } from './resource-management/resource-manager-factory.js';
import type { ResourceManagerComponents } from './resource-management/resource-manager-factory.js';
import { ResourceEventType } from './resource-management/resource-events.js';
import { triggerGarbageCollection } from './resource-management/garbage-collection-utils.js';
import { createResourceConfig, createMemoryConfig, createCpuConfig } from './resource-management/config-utils.js';
import { MonitoringOrchestrator } from './resource-management/monitoring-orchestrator.js';

// Re-export types for backward compatibility
export type {
  SystemResources,
  BrowserResourceUsage,
  ResourceThresholds,
  ResourceMonitoringConfig,
  ResourceAlert,
  MemoryOptimizationOptions,
  CpuOptimizationOptions,
};

export { DEFAULT_RESOURCE_CONFIG } from './resource-management/resource-types.js';

const logger = createLogger('browser-pool-resource-manager');

/**
 * Advanced resource manager for browser pool
 * @nist si-4 "Information system monitoring"
 * @nist sc-2 "Application partitioning"
 */
export class BrowserPoolResourceManager extends EventEmitter {
  private config: ResourceMonitoringConfig;
  private memoryOptimization: MemoryOptimizationOptions;
  private cpuOptimization: CpuOptimizationOptions;
  private components: ResourceManagerComponents;
  private orchestrator: MonitoringOrchestrator;

  constructor(
    config: Partial<ResourceMonitoringConfig> = {},
    memoryOptimization: Partial<MemoryOptimizationOptions> = {},
    cpuOptimization: Partial<CpuOptimizationOptions> = {}
  ) {
    super();

    // Initialize configurations
    this.config = createResourceConfig(config);
    this.memoryOptimization = createMemoryConfig(memoryOptimization);
    this.cpuOptimization = createCpuConfig(cpuOptimization);

    // Create components using factory
    this.components = ResourceManagerFactory.createComponents(
      this.config,
      this.memoryOptimization,
      this.cpuOptimization
    );

    // Create monitoring orchestrator
    this.orchestrator = new MonitoringOrchestrator(this.components, this.config);

    // Forward events
    this.components.alertManager.on('resource-alert', (alert: ResourceAlert) => {
      this.emit('resource-alert', alert);
    });
    
    this.orchestrator.on(ResourceEventType.MONITORING_STARTED, () => {
      this.emit(ResourceEventType.MONITORING_STARTED);
    });
    
    this.orchestrator.on(ResourceEventType.MONITORING_STOPPED, () => {
      this.emit(ResourceEventType.MONITORING_STOPPED);
    });
    
    this.orchestrator.on(ResourceEventType.RESOURCES_MONITORED, (data) => {
      this.emit(ResourceEventType.RESOURCES_MONITORED, data);
    });
  }

  /**
   * Start resource monitoring
   * @nist si-4 "Information system monitoring"
   */
  async start(): Promise<void> {
    logger.info(
      {
        config: this.config,
        memoryOptimization: this.memoryOptimization,
        cpuOptimization: this.cpuOptimization,
      },
      'Starting resource monitoring'
    );

    await this.orchestrator.start();
  }

  /**
   * Stop resource monitoring
   */
  stop(): void {
    this.orchestrator.stop();
  }

  /**
   * Get current system resources
   */
  getSystemResources(): SystemResources | null {
    return this.components.systemMonitor.getResources();
  }

  /**
   * Get browser resource usage
   */
  getBrowserResources(browserId?: string): Map<string, BrowserResourceUsage> | BrowserResourceUsage | undefined {
    if (browserId) {
      return this.components.browserMonitor.getBrowserUsage(browserId);
    }
    return this.components.browserMonitor.getResources();
  }

  /**
   * Get resource history for a browser
   */
  getResourceHistory(browserId: string): BrowserResourceUsage[] {
    return this.components.historyManager.getHistory(browserId);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Map<string, ResourceAlert> {
    return this.components.alertManager.getActiveAlerts();
  }

  /**
   * Optimize browser for resource usage
   * @nist sc-3 "Security function isolation"
   */
  async optimizeBrowser(browser: Browser, instance: BrowserInstance): Promise<void> {
    if (!this.config.enableMemoryOptimization && !this.config.enableCpuOptimization) {
      return;
    }

    logger.debug({ browserId: instance.id }, 'Optimizing browser for resource usage');

    try {
      // Apply optimization strategies
      for (const strategy of this.components.optimizationStrategies) {
        if (strategy.isEnabled()) {
          const result = await strategy.optimizeBrowser(browser);
          if (!result.success) {
            logger.warn(
              { 
                browserId: instance.id, 
                strategy: strategy.getName(), 
                errors: result.errors 
              },
              'Optimization strategy partially failed'
            );
          }
        }
      }

      // Trigger garbage collection if enabled
      if (this.config.enableGarbageCollection) {
        await triggerGarbageCollection(browser);
      }

      this.emit(ResourceEventType.BROWSER_OPTIMIZED, { browserId: instance.id });
    } catch (error) {
      logger.error(
        { browserId: instance.id, error },
        'Error optimizing browser'
      );
      throw error;
    }
  }

  /**
   * Check if browser should be recycled based on resource usage
   * @nist sc-2 "Application partitioning"
   */
  shouldRecycleBrowser(browserId: string): {
    shouldRecycle: boolean;
    reason: string;
    priority: 'low' | 'medium' | 'high';
  } {
    const usage = this.components.browserMonitor.getBrowserUsage(browserId);
    return this.components.recyclingService.shouldRecycleBrowser(browserId, usage);
  }

  /**
   * Update configuration
   * @nist cm-7 "Least functionality"
   */
  updateConfig(
    config: Partial<ResourceMonitoringConfig>,
    memoryOptimization?: Partial<MemoryOptimizationOptions>,
    cpuOptimization?: Partial<CpuOptimizationOptions>
  ): void {
    this.config = { ...this.config, ...config };
    
    if (memoryOptimization) {
      this.memoryOptimization = { ...this.memoryOptimization, ...memoryOptimization };
      // Update strategy config
      for (const strategy of this.components.optimizationStrategies) {
        if (strategy.getName() === 'memory-optimization') {
          strategy.updateConfig(this.memoryOptimization);
        }
      }
    }
    
    if (cpuOptimization) {
      this.cpuOptimization = { ...this.cpuOptimization, ...cpuOptimization };
      // Update strategy config
      for (const strategy of this.components.optimizationStrategies) {
        if (strategy.getName() === 'cpu-optimization') {
          strategy.updateConfig(this.cpuOptimization);
        }
      }
    }

    // Update alert manager thresholds
    if (config.thresholds) {
      this.components.alertManager.updateThresholds(config.thresholds);
      this.components.recyclingService.updateThresholds(config.thresholds);
    }
    
    // Update orchestrator config
    this.orchestrator.updateConfig(this.config);

    logger.info('Resource manager configuration updated');
    this.emit(ResourceEventType.CONFIG_UPDATED, { config: this.config });
  }

  /**
   * Monitor browser resources
   */
  async monitorBrowserResources(browsers: Map<string, InternalBrowserInstance>): Promise<void> {
    await this.orchestrator.monitorBrowserResources(browsers);
  }

}