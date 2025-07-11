/**
 * Resource manager factory - Factory pattern
 * @module puppeteer/pool/resource-management/resource-manager-factory
 * @nist sc-2 "Application partitioning"
 */

import { createLogger } from '../../../utils/logger.js';
import type {
  ResourceMonitoringConfig,
  MemoryOptimizationOptions,
  CpuOptimizationOptions,
  ResourceThresholds,
} from './resource-types.js';
import { SystemResourceMonitor } from './system-resource-monitor.js';
import { BrowserResourceMonitor } from './browser-resource-monitor.js';
import { ResourceAlertManager } from './resource-alert-manager.js';
import { MemoryOptimizationStrategy } from './memory-optimization-strategy.js';
import { CpuOptimizationStrategy } from './cpu-optimization-strategy.js';
import { ResourceHistoryManager } from './resource-history-manager.js';
import { RecyclingDecisionService } from './recycling-decision-service.js';
import type {
  ISystemResourceMonitor,
  IBrowserResourceMonitor,
} from './resource-monitor.interface.js';
import type { IResourceOptimizationStrategy } from './resource-optimization-strategy.js';

const logger = createLogger('resource-manager-factory');

/**
 * Resource manager components
 */
export interface ResourceManagerComponents {
  systemMonitor: ISystemResourceMonitor;
  browserMonitor: IBrowserResourceMonitor;
  alertManager: ResourceAlertManager;
  historyManager: ResourceHistoryManager;
  recyclingService: RecyclingDecisionService;
  optimizationStrategies: IResourceOptimizationStrategy[];
}

/**
 * Factory for creating resource management components
 * @nist sc-2 "Application partitioning"
 */
export class ResourceManagerFactory {
  /**
   * Create all resource management components
   */
  static createComponents(
    config: ResourceMonitoringConfig,
    memoryOptimization: MemoryOptimizationOptions,
    cpuOptimization: CpuOptimizationOptions,
  ): ResourceManagerComponents {
    logger.info('Creating resource management components');

    // Create monitors
    const systemMonitor = this.createSystemMonitor(config);
    const browserMonitor = this.createBrowserMonitor();

    // Create alert manager
    const alertManager = this.createAlertManager(config.thresholds);

    // Create history manager
    const historyManager = this.createHistoryManager();

    // Create recycling decision service
    const recyclingService = this.createRecyclingService(config.thresholds, historyManager);

    // Create optimization strategies
    const optimizationStrategies = this.createOptimizationStrategies(
      config,
      memoryOptimization,
      cpuOptimization,
    );

    return {
      systemMonitor,
      browserMonitor,
      alertManager,
      historyManager,
      recyclingService,
      optimizationStrategies,
    };
  }

  /**
   * Create system resource monitor
   */
  static createSystemMonitor(config: ResourceMonitoringConfig): ISystemResourceMonitor {
    logger.debug('Creating system resource monitor');
    return new SystemResourceMonitor(config.intervalMs);
  }

  /**
   * Create browser resource monitor
   */
  static createBrowserMonitor(): IBrowserResourceMonitor {
    logger.debug('Creating browser resource monitor');
    return new BrowserResourceMonitor();
  }

  /**
   * Create alert manager
   */
  static createAlertManager(thresholds: ResourceThresholds): ResourceAlertManager {
    logger.debug('Creating resource alert manager');
    return new ResourceAlertManager(thresholds);
  }

  /**
   * Create history manager
   */
  static createHistoryManager(maxHistorySize = 100): ResourceHistoryManager {
    logger.debug({ maxHistorySize }, 'Creating resource history manager');
    return new ResourceHistoryManager(maxHistorySize);
  }

  /**
   * Create optimization strategies
   */
  static createOptimizationStrategies(
    config: ResourceMonitoringConfig,
    memoryOptimization: MemoryOptimizationOptions,
    cpuOptimization: CpuOptimizationOptions,
  ): IResourceOptimizationStrategy[] {
    const strategies: IResourceOptimizationStrategy[] = [];

    // Add memory optimization strategy if enabled
    if (config.enableMemoryOptimization) {
      logger.debug('Creating memory optimization strategy');
      strategies.push(new MemoryOptimizationStrategy(memoryOptimization));
    }

    // Add CPU optimization strategy if enabled
    if (config.enableCpuOptimization) {
      logger.debug('Creating CPU optimization strategy');
      strategies.push(new CpuOptimizationStrategy(cpuOptimization));
    }

    logger.info({ count: strategies.length }, 'Created optimization strategies');
    return strategies;
  }

  /**
   * Create recycling decision service
   */
  static createRecyclingService(
    thresholds: ResourceThresholds,
    historyManager: ResourceHistoryManager,
  ): RecyclingDecisionService {
    logger.debug('Creating recycling decision service');
    return new RecyclingDecisionService(thresholds, historyManager);
  }

  /**
   * Create custom optimization strategy
   */
  static createCustomStrategy(
    name: string,
    implementation: IResourceOptimizationStrategy,
  ): IResourceOptimizationStrategy {
    logger.info({ name }, 'Creating custom optimization strategy');
    return implementation;
  }
}
