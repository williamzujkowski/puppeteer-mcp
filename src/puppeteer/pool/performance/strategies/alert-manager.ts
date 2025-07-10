/**
 * Alert management strategy for performance monitoring
 * @module puppeteer/pool/performance/strategies/alert-manager
 * @nist si-4 "Information system monitoring"
 * @nist au-5 "Response to audit processing failures"
 */

import type { EventEmitter } from 'events';
import { createLogger } from '../../../../utils/logger.js';
import type {
  PerformanceMetricType,
  PerformanceAlert,
  PerformanceMonitoringConfig,
} from '../types/performance-monitor.types.js';
import { AlertLevel } from '../types/performance-monitor.types.js';
import type { IAlertManager } from '../types/strategy.interfaces.js';

const logger = createLogger('alert-manager');

/**
 * Alert management strategy implementation
 */
export class AlertManager implements IAlertManager {
  readonly monitor: EventEmitter;
  readonly config: PerformanceMonitoringConfig;
  
  private alerts: Map<string, PerformanceAlert> = new Map();

  constructor(monitor: EventEmitter, config: PerformanceMonitoringConfig) {
    this.monitor = monitor;
    this.config = config;
  }

  /**
   * Check for real-time alerts based on metric values
   * @nist si-4 "Information system monitoring"
   */
  checkRealTimeAlert(type: PerformanceMetricType, value: number): void {
    if (!this.config.enableRealTimeAlerts || !this.config.alertingEnabled) {
      return;
    }

    const thresholds = this.config.alertThresholds[type];
    let level: AlertLevel | null = null;

    if (value >= thresholds.emergency) {
      level = AlertLevel.EMERGENCY;
    } else if (value >= thresholds.critical) {
      level = AlertLevel.CRITICAL;
    } else if (value >= thresholds.warning) {
      level = AlertLevel.WARNING;
    }

    if (level) {
      this.createAlert(type, level, value, thresholds[level]);
    }
  }

  /**
   * Get all active (unresolved) alerts
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts (active and resolved)
   */
  getAllAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Acknowledge an alert
   * @nist au-5 "Response to audit processing failures"
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      this.monitor.emit('alert-acknowledged', alert);
      
      logger.info(
        { alertId, alert },
        'Alert acknowledged'
      );
      
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   * @nist au-5 "Response to audit processing failures"
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      alert.duration = alert.resolvedAt.getTime() - alert.timestamp.getTime();
      this.monitor.emit('alert-resolved', alert);
      
      logger.info(
        { alertId, alert, duration: alert.duration },
        'Alert resolved'
      );
      
      return true;
    }
    return false;
  }

  /**
   * Clean up resolved alerts older than retention period
   */
  cleanupResolvedAlerts(retentionPeriod: number): void {
    const cutoff = new Date(Date.now() - retentionPeriod);

    for (const [id, alert] of this.alerts) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(id);
      }
    }
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(): {
    total: number;
    active: number;
    resolved: number;
    acknowledged: number;
    byLevel: Record<AlertLevel, number>;
  } {
    const alerts = Array.from(this.alerts.values());
    
    const byLevel = {
      [AlertLevel.INFO]: 0,
      [AlertLevel.WARNING]: 0,
      [AlertLevel.CRITICAL]: 0,
      [AlertLevel.EMERGENCY]: 0,
    };

    for (const alert of alerts) {
      byLevel[alert.level]++;
    }

    return {
      total: alerts.length,
      active: alerts.filter(a => !a.resolved).length,
      resolved: alerts.filter(a => a.resolved).length,
      acknowledged: alerts.filter(a => a.acknowledged).length,
      byLevel,
    };
  }

  /**
   * Get alerts for a specific metric type
   */
  getAlertsForMetric(type: PerformanceMetricType): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.type === type);
  }

  /**
   * Check if there are any critical or emergency alerts
   */
  hasCriticalAlerts(): boolean {
    return Array.from(this.alerts.values()).some(
      alert => !alert.resolved && (alert.level === AlertLevel.CRITICAL || alert.level === AlertLevel.EMERGENCY)
    );
  }

  /**
   * Bulk acknowledge alerts
   */
  acknowledgeAlerts(alertIds: string[]): number {
    let acknowledged = 0;
    for (const alertId of alertIds) {
      if (this.acknowledgeAlert(alertId)) {
        acknowledged++;
      }
    }
    return acknowledged;
  }

  /**
   * Bulk resolve alerts
   */
  resolveAlerts(alertIds: string[]): number {
    let resolved = 0;
    for (const alertId of alertIds) {
      if (this.resolveAlert(alertId)) {
        resolved++;
      }
    }
    return resolved;
  }

  /**
   * Create a new alert
   * @private
   */
  private createAlert(
    type: PerformanceMetricType,
    level: AlertLevel,
    value: number,
    threshold: number
  ): void {
    const alertId = `${type}-${level}-${Date.now()}`;
    const alert: PerformanceAlert = {
      id: alertId,
      level,
      type,
      message: `${type} ${level}: ${value} exceeds threshold ${threshold}`,
      value,
      threshold,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
    };

    this.alerts.set(alertId, alert);
    this.monitor.emit('alert-created', alert);

    logger.warn(
      { alert },
      'Performance alert created'
    );
  }

  /**
   * Auto-resolve alerts that are no longer relevant
   */
  autoResolveOutdatedAlerts(type: PerformanceMetricType, currentValue: number): void {
    const thresholds = this.config.alertThresholds[type];
    const activeAlerts = this.getActiveAlerts().filter(alert => alert.type === type);

    for (const alert of activeAlerts) {
      let shouldResolve = false;

      switch (alert.level) {
        case AlertLevel.WARNING:
          shouldResolve = currentValue < thresholds.warning;
          break;
        case AlertLevel.CRITICAL:
          shouldResolve = currentValue < thresholds.critical;
          break;
        case AlertLevel.EMERGENCY:
          shouldResolve = currentValue < thresholds.emergency;
          break;
      }

      if (shouldResolve) {
        this.resolveAlert(alert.id);
      }
    }
  }
}