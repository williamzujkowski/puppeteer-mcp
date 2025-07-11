/**
 * Resource alert manager - Observer pattern
 * @module puppeteer/pool/resource-management/resource-alert-manager
 * @nist si-4 "Information system monitoring"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../utils/logger.js';
import type { 
  ResourceAlert, 
  ResourceThresholds, 
  SystemResources, 
  BrowserResourceUsage 
} from './resource-types.js';

const logger = createLogger('resource-alert-manager');

/**
 * Alert listener type
 */
export type AlertListener = (alert: ResourceAlert) => void;

/**
 * Resource alert manager
 * @nist si-4 "Information system monitoring"
 */
export class ResourceAlertManager extends EventEmitter {
  private activeAlerts: Map<string, ResourceAlert> = new Map();
  private thresholds: ResourceThresholds;
  private alertListeners: Set<AlertListener> = new Set();

  constructor(thresholds: ResourceThresholds) {
    super();
    this.thresholds = thresholds;
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Alert thresholds updated');
  }

  /**
   * Subscribe to alerts
   */
  subscribe(listener: AlertListener): void {
    this.alertListeners.add(listener);
  }

  /**
   * Unsubscribe from alerts
   */
  unsubscribe(listener: AlertListener): void {
    this.alertListeners.delete(listener);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Map<string, ResourceAlert> {
    return new Map(this.activeAlerts);
  }

  /**
   * Clear alert
   */
  clearAlert(alertKey: string): void {
    if (this.activeAlerts.delete(alertKey)) {
      logger.info({ alertKey }, 'Alert cleared');
      this.emit('alert-cleared', alertKey);
    }
  }

  /**
   * Clear all alerts
   */
  clearAllAlerts(): void {
    const count = this.activeAlerts.size;
    this.activeAlerts.clear();
    logger.info({ count }, 'All alerts cleared');
    this.emit('all-alerts-cleared');
  }

  /**
   * Check system alerts
   */
  async checkSystemAlerts(systemResources: SystemResources): Promise<void> {
    const { memoryUsagePercent, cpuUsagePercent } = systemResources;

    // Check memory alerts
    if (memoryUsagePercent > 90) {
      await this.createAlert({
        type: 'memory',
        level: 'critical',
        message: `Critical system memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        currentValue: memoryUsagePercent,
        threshold: 90,
        timestamp: new Date(),
        impact: 'high',
        suggestedAction: 'Scale down browser pool or restart high-memory browsers',
      });
    } else if (memoryUsagePercent > 80) {
      await this.createAlert({
        type: 'memory',
        level: 'warning',
        message: `High system memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        currentValue: memoryUsagePercent,
        threshold: 80,
        timestamp: new Date(),
        impact: 'medium',
        suggestedAction: 'Monitor closely and consider scaling down',
      });
    } else {
      this.clearAlert('memory-system');
    }

    // Check CPU alerts
    if (cpuUsagePercent > 90) {
      await this.createAlert({
        type: 'cpu',
        level: 'critical',
        message: `Critical system CPU usage: ${cpuUsagePercent.toFixed(1)}%`,
        currentValue: cpuUsagePercent,
        threshold: 90,
        timestamp: new Date(),
        impact: 'high',
        suggestedAction: 'Scale down browser pool or optimize browser processes',
      });
    } else if (cpuUsagePercent > 80) {
      await this.createAlert({
        type: 'cpu',
        level: 'warning',
        message: `High system CPU usage: ${cpuUsagePercent.toFixed(1)}%`,
        currentValue: cpuUsagePercent,
        threshold: 80,
        timestamp: new Date(),
        impact: 'medium',
        suggestedAction: 'Monitor CPU usage and optimize if needed',
      });
    } else {
      this.clearAlert('cpu-system');
    }
  }

  /**
   * Check browser alerts
   */
  async checkBrowserAlerts(browserId: string, usage: BrowserResourceUsage): Promise<void> {
    const { memoryUsage, cpuUsage, openHandles, connectionCount } = usage;

    // Memory alerts
    if (memoryUsage.rss > this.thresholds.memoryCritical) {
      await this.createAlert({
        type: 'memory',
        level: 'critical',
        message: `Critical browser memory usage: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        browserId,
        currentValue: memoryUsage.rss,
        threshold: this.thresholds.memoryCritical,
        timestamp: new Date(),
        impact: 'high',
        suggestedAction: 'Recycle browser immediately',
      });
    } else if (memoryUsage.rss > this.thresholds.memoryWarning) {
      await this.createAlert({
        type: 'memory',
        level: 'warning',
        message: `High browser memory usage: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        browserId,
        currentValue: memoryUsage.rss,
        threshold: this.thresholds.memoryWarning,
        timestamp: new Date(),
        impact: 'medium',
        suggestedAction: 'Monitor browser memory usage',
      });
    }

    // CPU alerts
    if (cpuUsage.percent > this.thresholds.cpuCritical) {
      await this.createAlert({
        type: 'cpu',
        level: 'critical',
        message: `Critical browser CPU usage: ${cpuUsage.percent}%`,
        browserId,
        currentValue: cpuUsage.percent,
        threshold: this.thresholds.cpuCritical,
        timestamp: new Date(),
        impact: 'high',
        suggestedAction: 'Recycle browser and optimize page operations',
      });
    }

    // Handle alerts
    if (openHandles > this.thresholds.handleCritical) {
      await this.createAlert({
        type: 'handle',
        level: 'critical',
        message: `Critical browser handle count: ${openHandles}`,
        browserId,
        currentValue: openHandles,
        threshold: this.thresholds.handleCritical,
        timestamp: new Date(),
        impact: 'medium',
        suggestedAction: 'Recycle browser to free handles',
      });
    }

    // Connection alerts
    if (connectionCount > this.thresholds.connectionCritical) {
      await this.createAlert({
        type: 'connection',
        level: 'critical',
        message: `Critical browser connection count: ${connectionCount}`,
        browserId,
        currentValue: connectionCount,
        threshold: this.thresholds.connectionCritical,
        timestamp: new Date(),
        impact: 'medium',
        suggestedAction: 'Close unused pages or recycle browser',
      });
    }
  }

  /**
   * Create or update alert
   * @private
   */
  private async createAlert(alert: ResourceAlert): Promise<void> {
    const alertKey = `${alert.type}-${alert.browserId || 'system'}`;
    const existing = this.activeAlerts.get(alertKey);

    if (!existing || existing.level !== alert.level) {
      this.activeAlerts.set(alertKey, alert);
      
      logger.warn(
        {
          alert,
          isNew: !existing,
        },
        'Resource alert created'
      );

      // Notify listeners
      this.alertListeners.forEach(listener => {
        try {
          listener(alert);
        } catch (error) {
          logger.error({ error }, 'Error in alert listener');
        }
      });

      this.emit('resource-alert', alert);
    }
  }
}