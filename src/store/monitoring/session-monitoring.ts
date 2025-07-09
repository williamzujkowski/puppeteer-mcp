/**
 * Main monitoring coordination class
 * @module store/monitoring/session-monitoring
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import type { SessionStore } from '../session-store.interface.js';
import type {
  MonitoringConfig,
  HealthCheckResult,
  SessionMetrics,
  OperationRecord,
  MonitoringStatus,
  ExportedMetrics,
  UptimeStats,
  MetricsHistoryEntry,
  AlertHistoryEntry
} from './types.js';
import { SessionHealthChecker } from './session-health-checker.js';
import { MetricsCollector } from './metrics-collector.js';
import { AlertManager } from './alert-manager.js';
import { AnalyticsEngine } from './analytics-engine.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { ResourceTracker } from './resource-tracker.js';
import { MonitoringScheduler } from './monitoring-scheduler.js';
import { mergeConfig } from './config.js';
import { EventEmitter } from 'events';
import { pino } from 'pino';

/**
 * Session store monitoring system
 */
export class SessionStoreMonitor extends EventEmitter {
  private logger: pino.Logger;
  private config: MonitoringConfig;
  
  // Sub-components
  private healthChecker: SessionHealthChecker;
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private analyticsEngine: AnalyticsEngine;
  private performanceMonitor: PerformanceMonitor;
  private resourceTracker: ResourceTracker;
  private scheduler: MonitoringScheduler;

  constructor(
    private sessionStore: SessionStore,
    config: Partial<MonitoringConfig> = {},
    logger?: pino.Logger
  ) {
    super();
    this.logger = logger ?? pino({ level: 'info' });
    
    this.config = mergeConfig(config);

    // Initialize sub-components
    this.healthChecker = new SessionHealthChecker(sessionStore, this.logger);
    this.metricsCollector = new MetricsCollector(sessionStore.constructor.name, this.logger);
    this.alertManager = new AlertManager(
      this.config.alertThresholds,
      this.config.enableAlerting,
      this.logger
    );
    this.analyticsEngine = new AnalyticsEngine(this.logger);
    this.performanceMonitor = new PerformanceMonitor(this.logger);
    this.resourceTracker = new ResourceTracker(sessionStore, this.logger);
    this.scheduler = new MonitoringScheduler(this.logger);

    this.setupEventHandlers();
    this.setupScheduledTasks();
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    this.metricsCollector.on('operation:recorded', this.handleOperationRecorded.bind(this));
    this.alertManager.on('alert', (alert) => this.emit('alert', alert));
    this.scheduler.on('task:completed', (task) => this.emit('scheduler:task:completed', task));
    this.scheduler.on('task:error', (task) => this.emit('scheduler:task:error', task));
  }

  /**
   * Handle operation recorded event
   */
  private handleOperationRecorded(record: OperationRecord): void {
    this.emit('operation:recorded', record);
    this.performanceMonitor.recordLatency(record.latency);
    
    if (this.config.enableAlerting) {
      this.alertManager.checkOperationAlerts(record, this.metricsCollector.getMetrics());
    }
  }

  /**
   * Set up scheduled tasks
   */
  private setupScheduledTasks(): void {
    this.scheduler.registerTask({
      name: 'health-check',
      interval: this.config.healthCheckInterval,
      immediate: true,
      enabled: true,
      handler: () => this.performHealthCheck()
    });

    this.scheduler.registerTask({
      name: 'metrics-cleanup',
      interval: 3600000, // 1 hour
      immediate: false,
      enabled: true,
      handler: () => Promise.resolve(this.cleanupOldData())
    });

    this.scheduler.registerTask({
      name: 'resource-monitoring',
      interval: 60000, // 1 minute
      immediate: false,
      enabled: this.config.enableDetailedMetrics,
      handler: () => this.updateResourceMetrics()
    });
  }

  /**
   * Start monitoring
   */
  start(): void {
    this.scheduler.start();
    this.logger.info('Session store monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.scheduler.stop();
    this.logger.info('Session store monitoring stopped');
  }

  /**
   * Record operation metrics
   */
  recordOperation(
    operation: keyof SessionMetrics['operations'],
    latency: number,
    success: boolean,
    cacheMiss?: boolean
  ): void {
    if (!this.config.enableDetailedMetrics) {
      return;
    }

    const record: OperationRecord = {
      operation,
      latency,
      success,
      cacheMiss
    };

    this.metricsCollector.recordOperation(record);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const result = await this.healthChecker.performHealthCheck(
      this.config.alertThresholds
    );
    
    // Add current metrics
    result.metrics = this.metricsCollector.getMetrics();
    
    // Update Redis metrics
    const redisMetrics = await this.resourceTracker.updateRedisMetrics();
    if (redisMetrics) {
      this.metricsCollector.updateRedisMetrics(redisMetrics);
    }
    
    // Update store metrics
    const storeMetrics = await this.resourceTracker.updateStoreMetrics();
    this.metricsCollector.updateStoreMetrics(storeMetrics);
    
    // Add metrics snapshot to history
    this.analyticsEngine.addMetricsSnapshot(result.metrics);
    
    this.emit('health:check', result);
    
    return result;
  }

  /**
   * Update resource metrics
   */
  private async updateResourceMetrics(): Promise<void> {
    const redisMetrics = await this.resourceTracker.updateRedisMetrics();
    if (redisMetrics) {
      this.metricsCollector.updateRedisMetrics(redisMetrics);
    }
    
    const storeMetrics = await this.resourceTracker.updateStoreMetrics();
    this.metricsCollector.updateStoreMetrics(storeMetrics);
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    this.analyticsEngine.clearOldMetrics(this.config.metricsRetentionPeriod);
    this.alertManager.clearOldAlerts(this.config.metricsRetentionPeriod);
  }

  /**
   * Get current metrics
   */
  getMetrics(): SessionMetrics {
    return this.metricsCollector.getMetrics();
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(since?: Date): MetricsHistoryEntry[] {
    return this.analyticsEngine.getMetricsHistory(since);
  }

  /**
   * Get alert history
   */
  getAlertHistory(since?: Date): AlertHistoryEntry[] {
    return this.alertManager.getAlertHistory(since);
  }

  /**
   * Get uptime statistics
   */
  getUptimeStats(): UptimeStats {
    return this.analyticsEngine.getUptimeStats();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metricsCollector.resetMetrics();
    this.analyticsEngine.reset();
    this.performanceMonitor.reset();
    this.alertManager.clearAlerts();
    this.emit('metrics:reset');
  }

  /**
   * Get monitoring status
   */
  getStatus(): MonitoringStatus {
    const uptime = this.analyticsEngine.getUptimeStats();
    return {
      isRunning: this.scheduler.getAllTaskStatuses().some(t => t.running),
      config: this.config,
      uptime: uptime.uptime,
      metricsCount: this.getMetricsHistory().length,
      alertCount: this.getAlertHistory().length
    };
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): ExportedMetrics {
    return this.performanceMonitor.exportMetrics(this.getMetrics());
  }

  /**
   * Analyze trends
   */
  analyzeTrends(periodMinutes: number = 60): ReturnType<typeof this.analyticsEngine.analyzeTrends> {
    return this.analyticsEngine.analyzeTrends(periodMinutes);
  }

  /**
   * Get resource usage
   */
  async getResourceUsage(): ReturnType<typeof this.resourceTracker.getResourceUsage> {
    return this.resourceTracker.getResourceUsage();
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.stop();
    this.scheduler.destroy();
    this.removeAllListeners();
    this.logger.info('Session store monitor destroyed');
  }

}