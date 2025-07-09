/**
 * Alert generation and notification management
 * @module store/monitoring/alert-manager
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type {
  Alert,
  AlertThresholds,
  AlertHistoryEntry,
  OperationRecord,
  SessionMetrics
} from './types.js';
import { EventEmitter } from 'events';
import { pino } from 'pino';

/**
 * Alert manager for session monitoring
 */
export class AlertManager extends EventEmitter {
  private logger: pino.Logger;
  private alertHistory: AlertHistoryEntry[] = [];
  private alertThresholds: AlertThresholds;
  private enableAlerting: boolean;

  constructor(
    thresholds: AlertThresholds,
    enableAlerting: boolean,
    logger?: pino.Logger
  ) {
    super();
    this.logger = logger ?? pino({ level: 'info' });
    this.alertThresholds = thresholds;
    this.enableAlerting = enableAlerting;
  }

  /**
   * Check operation for alerts
   */
  checkOperationAlerts(
    record: OperationRecord,
    metrics: SessionMetrics
  ): void {
    if (!this.enableAlerting) return;

    const { operation, latency } = record;
    const opMetrics = metrics.operations[operation];
    
    // High latency alert
    if (latency > this.alertThresholds.maxLatency) {
      this.raiseAlert(
        'warning',
        `High latency detected for ${operation}: ${latency}ms`
      );
    }

    // High error rate alert
    if (opMetrics.count > 10) {
      const errorRate = opMetrics.errors / opMetrics.count;
      if (errorRate > this.alertThresholds.maxErrorRate) {
        this.raiseAlert(
          'critical',
          `High error rate for ${operation}: ${(errorRate * 100).toFixed(2)}%`
        );
      }
    }
  }

  /**
   * Check fallback usage alerts
   */
  checkFallbackAlerts(
    fallbackTime: number,
    activations: number
  ): void {
    if (!this.enableAlerting) {
      return;
    }

    if (fallbackTime > this.alertThresholds.maxFallbackTime) {
      this.raiseAlert(
        'critical',
        `Excessive fallback time: ${(fallbackTime / 1000).toFixed(1)}s`
      );
    }

    if (activations > 0) {
      this.raiseAlert(
        'warning',
        `Fallback store activated ${activations} times`
      );
    }
  }

  /**
   * Check availability alerts
   */
  checkAvailabilityAlerts(availability: number): void {
    if (!this.enableAlerting) {
      return;
    }

    if (availability < this.alertThresholds.minAvailability) {
      this.raiseAlert(
        'critical',
        `Low availability: ${(availability * 100).toFixed(2)}%`
      );
    }
  }

  /**
   * Raise an alert
   */
  raiseAlert(level: 'warning' | 'critical', message: string): void {
    const alert: Alert = {
      level,
      message,
      timestamp: new Date()
    };

    const historyEntry: AlertHistoryEntry = {
      timestamp: alert.timestamp,
      level,
      message
    };

    this.alertHistory.push(historyEntry);
    
    // Log the alert
    if (level === 'critical') {
      this.logger.error(alert, `Session store alert: ${message}`);
    } else {
      this.logger.warn(alert, `Session store alert: ${message}`);
    }
    
    this.emit('alert', alert);
  }

  /**
   * Get alert history
   */
  getAlertHistory(since?: Date): AlertHistoryEntry[] {
    if (since) {
      return this.alertHistory.filter(entry => entry.timestamp >= since);
    }
    return [...this.alertHistory];
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(minutes: number = 60): Alert[] {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return this.alertHistory
      .filter(entry => entry.timestamp >= since)
      .map(entry => ({
        level: entry.level as 'warning' | 'critical',
        message: entry.message,
        timestamp: entry.timestamp
      }));
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(retentionPeriod: number): void {
    const cutoffTime = Date.now() - retentionPeriod;
    this.alertHistory = this.alertHistory.filter(
      entry => entry.timestamp.getTime() > cutoffTime
    );
  }

  /**
   * Get alert count by level
   */
  getAlertCounts(): { warning: number; critical: number } {
    const counts = { warning: 0, critical: 0 };
    this.alertHistory.forEach(entry => {
      if (entry.level === 'warning' || entry.level === 'critical') {
        counts[entry.level]++;
      }
    });
    return counts;
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(thresholds: Partial<AlertThresholds>): void {
    Object.assign(this.alertThresholds, thresholds);
  }

  /**
   * Enable or disable alerting
   */
  setAlertingEnabled(enabled: boolean): void {
    this.enableAlerting = enabled;
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alertHistory = [];
    this.emit('alerts:cleared');
  }
}