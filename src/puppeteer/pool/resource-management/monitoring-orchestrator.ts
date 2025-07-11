/**
 * Resource monitoring orchestrator
 * @module puppeteer/pool/resource-management/monitoring-orchestrator
 * @nist si-4 "Information system monitoring"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../utils/logger.js';
import type { InternalBrowserInstance } from '../browser-pool-maintenance.js';
import type { ResourceManagerComponents } from './resource-manager-factory.js';
import type { ResourceMonitoringConfig } from './resource-types.js';
import { ResourceEventType } from './resource-events.js';

const logger = createLogger('monitoring-orchestrator');

/**
 * Orchestrates resource monitoring activities
 * @nist si-4 "Information system monitoring"
 */
export class MonitoringOrchestrator extends EventEmitter {
  private components: ResourceManagerComponents;
  private config: ResourceMonitoringConfig;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(components: ResourceManagerComponents, config: ResourceMonitoringConfig) {
    super();
    this.components = components;
    this.config = config;
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Resource monitoring disabled');
      return;
    }

    logger.info('Starting resource monitoring orchestration');

    // Start system monitoring
    if (this.config.enableSystemMonitoring) {
      await this.components.systemMonitor.start();
    }

    // Start browser monitoring
    if (this.config.enableBrowserMonitoring) {
      await this.components.browserMonitor.start();
    }

    // Start monitoring interval
    this.monitoringInterval = setInterval(() => {
      void (async () => {
        try {
          await this.monitorResources();
        } catch (error) {
          logger.error({ error }, 'Error during resource monitoring');
        }
      })();
    }, this.config.intervalMs);

    this.emit(ResourceEventType.MONITORING_STARTED);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.components.systemMonitor.stop();
    this.components.browserMonitor.stop();

    logger.info('Resource monitoring stopped');
    this.emit(ResourceEventType.MONITORING_STOPPED);
  }

  /**
   * Monitor browser resources
   */
  async monitorBrowserResources(browsers: Map<string, InternalBrowserInstance>): Promise<void> {
    if (!this.config.enableBrowserMonitoring) {
      return;
    }

    const promises = Array.from(browsers.values()).map(async (instance) => {
      try {
        const usage = await this.components.browserMonitor.monitorBrowser(
          instance.id,
          instance.browser,
        );

        // Add to history
        this.components.historyManager.addUsage(instance.id, usage);

        // Check alerts
        await this.components.alertManager.checkBrowserAlerts(instance.id, usage);
      } catch (error) {
        logger.error({ browserId: instance.id, error }, 'Error monitoring browser resources');
      }
    });

    await Promise.all(promises);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ResourceMonitoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Monitor resources
   * @private
   */
  private async monitorResources(): Promise<void> {
    // Update system resources
    if (this.config.enableSystemMonitoring) {
      await this.components.systemMonitor.update();
      const systemResources = this.components.systemMonitor.getResources();
      if (systemResources) {
        await this.components.alertManager.checkSystemAlerts(systemResources);
      }
    }

    this.emit(ResourceEventType.RESOURCES_MONITORED, {
      systemResources: this.components.systemMonitor.getResources(),
      browserCount: this.components.browserMonitor.getResources()?.size ?? 0,
      alertCount: this.components.alertManager.getActiveAlerts().size,
    });
  }
}
