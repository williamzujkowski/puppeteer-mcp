/**
 * Performance Monitoring System for Puppeteer-MCP
 * @module tests/performance/monitoring/performance-monitor
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { performance } from 'perf_hooks';

export interface MetricValue {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export interface TimeSeriesMetric {
  name: string;
  values: MetricValue[];
  type: 'gauge' | 'counter' | 'histogram';
}

export interface PerformanceAlert {
  id: string;
  metric: string;
  severity: 'warning' | 'critical';
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
  message: string;
}

export interface SystemResources {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  timestamp: Date;
}

export interface PerformanceThresholds {
  latency: {
    warning: number;
    critical: number;
  };
  errorRate: {
    warning: number;
    critical: number;
  };
  cpu: {
    warning: number;
    critical: number;
  };
  memory: {
    warning: number;
    critical: number;
  };
}

/**
 * Time series metric collector
 */
export class TimeSeriesMetricCollector {
  private values: MetricValue[] = [];
  private maxAge: number = 3600000; // 1 hour default

  constructor(
    public name: string,
    public type: 'gauge' | 'counter' | 'histogram' = 'gauge',
    maxAge?: number,
  ) {
    if (maxAge) this.maxAge = maxAge;
  }

  record(value: number, labels?: Record<string, string>): void {
    this.values.push({
      timestamp: new Date(),
      value,
      labels,
    });
    this.cleanup();
  }

  getValues(since?: Date): MetricValue[] {
    if (!since) return [...this.values];
    return this.values.filter((v) => v.timestamp >= since);
  }

  getLatest(): MetricValue | null {
    return this.values.length > 0 ? this.values[this.values.length - 1] : null;
  }

  getStats(windowMs: number = 300000): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const since = new Date(Date.now() - windowMs);
    const recentValues = this.getValues(since)
      .map((v) => v.value)
      .sort((a, b) => a - b);

    if (recentValues.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    return {
      count: recentValues.length,
      min: recentValues[0],
      max: recentValues[recentValues.length - 1],
      avg: recentValues.reduce((a, b) => a + b, 0) / recentValues.length,
      p50: this.percentile(recentValues, 0.5),
      p95: this.percentile(recentValues, 0.95),
      p99: this.percentile(recentValues, 0.99),
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private cleanup(): void {
    const cutoff = new Date(Date.now() - this.maxAge);
    this.values = this.values.filter((v) => v.timestamp >= cutoff);
  }
}

/**
 * Performance monitoring system
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics = new Map<string, TimeSeriesMetricCollector>();
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private anomalyDetector: AnomalyDetector;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    super();
    this.thresholds = {
      latency: { warning: 1000, critical: 3000 },
      errorRate: { warning: 0.05, critical: 0.1 },
      cpu: { warning: 0.8, critical: 0.95 },
      memory: { warning: 0.85, critical: 0.95 },
      ...thresholds,
    };
    this.anomalyDetector = new AnomalyDetector();
  }

  /**
   * Start monitoring system resources
   */
  start(intervalMs: number = 1000): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.checkThresholds();
      this.detectAnomalies();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, new TimeSeriesMetricCollector(name));
    }
    this.metrics.get(name)!.record(value, labels);
    this.emit('metric-recorded', { name, value, labels });
  }

  /**
   * Get metric collector
   */
  getMetric(name: string): TimeSeriesMetricCollector | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, TimeSeriesMetricCollector> {
    return new Map(this.metrics);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter((a) => !a.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      this.emit('alert-resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get system resources
   */
  getSystemResources(): SystemResources {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = process.memoryUsage();

    // Calculate CPU usage
    const cpuUsage =
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + (1 - idle / total);
      }, 0) / cpus.length;

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        loadAverage: os.loadavg(),
      },
      memory: {
        total: totalMemory,
        used: totalMemory - freeMemory,
        free: freeMemory,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(windowMs: number = 300000): {
    period: { start: Date; end: Date };
    metrics: Record<string, any>;
    healthScore: number;
    performanceGrade: string;
    alerts: number;
    recommendations: string[];
  } {
    const now = new Date();
    const start = new Date(now.getTime() - windowMs);
    const metrics: Record<string, any> = {};

    // Collect stats for all metrics
    for (const [name, collector] of this.metrics) {
      metrics[name] = collector.getStats(windowMs);
    }

    // Calculate health score
    const healthScore = this.calculateHealthScore(metrics);
    const performanceGrade = this.getPerformanceGrade(healthScore);
    const activeAlerts = this.getActiveAlerts().length;

    return {
      period: { start, end: now },
      metrics,
      healthScore,
      performanceGrade,
      alerts: activeAlerts,
      recommendations: this.generateRecommendations(metrics, healthScore),
    };
  }

  /**
   * Detect anomalies in metrics
   */
  getAnomalies(): Array<{
    metric: string;
    timestamp: Date;
    value: number;
    expectedRange: [number, number];
    severity: 'low' | 'medium' | 'high';
  }> {
    const anomalies: any[] = [];

    for (const [name, collector] of this.metrics) {
      const detected = this.anomalyDetector.detect(collector);
      anomalies.push(...detected.map((a) => ({ metric: name, ...a })));
    }

    return anomalies;
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const resources = this.getSystemResources();

    this.recordMetric('system.cpu.usage', resources.cpu.usage * 100);
    this.recordMetric(
      'system.memory.usage',
      (resources.memory.used / resources.memory.total) * 100,
    );
    this.recordMetric(
      'system.memory.heap',
      (resources.memory.heapUsed / resources.memory.heapTotal) * 100,
    );

    for (let i = 0; i < resources.cpu.loadAverage.length; i++) {
      this.recordMetric(`system.load.${i + 1}m`, resources.cpu.loadAverage[i]);
    }
  }

  /**
   * Check thresholds and create alerts
   */
  private checkThresholds(): void {
    // Check latency
    const latencyMetric = this.metrics.get('api.latency');
    if (latencyMetric) {
      const stats = latencyMetric.getStats();
      if (stats.p95 > this.thresholds.latency.critical) {
        this.createAlert(
          'api.latency',
          'critical',
          stats.p95,
          this.thresholds.latency.critical,
          'API latency P95 exceeds critical threshold',
        );
      } else if (stats.p95 > this.thresholds.latency.warning) {
        this.createAlert(
          'api.latency',
          'warning',
          stats.p95,
          this.thresholds.latency.warning,
          'API latency P95 exceeds warning threshold',
        );
      }
    }

    // Check error rate
    const errorRateMetric = this.metrics.get('error.rate');
    if (errorRateMetric) {
      const latest = errorRateMetric.getLatest();
      if (latest && latest.value > this.thresholds.errorRate.critical) {
        this.createAlert(
          'error.rate',
          'critical',
          latest.value,
          this.thresholds.errorRate.critical,
          'Error rate exceeds critical threshold',
        );
      } else if (latest && latest.value > this.thresholds.errorRate.warning) {
        this.createAlert(
          'error.rate',
          'warning',
          latest.value,
          this.thresholds.errorRate.warning,
          'Error rate exceeds warning threshold',
        );
      }
    }

    // Check CPU usage
    const cpuMetric = this.metrics.get('system.cpu.usage');
    if (cpuMetric) {
      const latest = cpuMetric.getLatest();
      if (latest && latest.value > this.thresholds.cpu.critical * 100) {
        this.createAlert(
          'system.cpu.usage',
          'critical',
          latest.value,
          this.thresholds.cpu.critical * 100,
          'CPU usage exceeds critical threshold',
        );
      } else if (latest && latest.value > this.thresholds.cpu.warning * 100) {
        this.createAlert(
          'system.cpu.usage',
          'warning',
          latest.value,
          this.thresholds.cpu.warning * 100,
          'CPU usage exceeds warning threshold',
        );
      }
    }

    // Check memory usage
    const memoryMetric = this.metrics.get('system.memory.usage');
    if (memoryMetric) {
      const latest = memoryMetric.getLatest();
      if (latest && latest.value > this.thresholds.memory.critical * 100) {
        this.createAlert(
          'system.memory.usage',
          'critical',
          latest.value,
          this.thresholds.memory.critical * 100,
          'Memory usage exceeds critical threshold',
        );
      } else if (latest && latest.value > this.thresholds.memory.warning * 100) {
        this.createAlert(
          'system.memory.usage',
          'warning',
          latest.value,
          this.thresholds.memory.warning * 100,
          'Memory usage exceeds warning threshold',
        );
      }
    }
  }

  /**
   * Create an alert
   */
  private createAlert(
    metric: string,
    severity: 'warning' | 'critical',
    value: number,
    threshold: number,
    message: string,
  ): void {
    // Check if similar alert already exists
    const existing = this.alerts.find(
      (a) =>
        a.metric === metric &&
        a.severity === severity &&
        !a.resolved &&
        Date.now() - a.timestamp.getTime() < 60000, // Within last minute
    );

    if (existing) return;

    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      metric,
      severity,
      value,
      threshold,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      message,
    };

    this.alerts.push(alert);
    this.emit('alert-created', alert);
  }

  /**
   * Detect anomalies
   */
  private detectAnomalies(): void {
    const anomalies = this.getAnomalies();
    for (const anomaly of anomalies) {
      this.emit('anomaly-detected', anomaly);
    }
  }

  /**
   * Calculate health score
   */
  private calculateHealthScore(metrics: Record<string, any>): number {
    let score = 100;
    const activeAlerts = this.getActiveAlerts();

    // Deduct points for alerts
    for (const alert of activeAlerts) {
      if (alert.severity === 'critical') {
        score -= 20;
      } else if (alert.severity === 'warning') {
        score -= 10;
      }
    }

    // Deduct points for high error rates
    if (metrics['error.rate']?.avg > 0.1) score -= 20;
    else if (metrics['error.rate']?.avg > 0.05) score -= 10;
    else if (metrics['error.rate']?.avg > 0.01) score -= 5;

    // Deduct points for high latency
    if (metrics['api.latency']?.p95 > 3000) score -= 15;
    else if (metrics['api.latency']?.p95 > 1000) score -= 10;
    else if (metrics['api.latency']?.p95 > 500) score -= 5;

    return Math.max(0, score);
  }

  /**
   * Get performance grade based on health score
   */
  private getPerformanceGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: Record<string, any>, healthScore: number): string[] {
    const recommendations: string[] = [];

    if (healthScore < 80) {
      recommendations.push('Overall system health is below optimal levels');
    }

    if (metrics['error.rate']?.avg > 0.05) {
      recommendations.push('High error rate detected - investigate error logs');
    }

    if (metrics['api.latency']?.p95 > 1000) {
      recommendations.push('API latency is high - consider optimizing slow endpoints');
    }

    if (metrics['system.cpu.usage']?.avg > 80) {
      recommendations.push('High CPU usage - consider scaling horizontally');
    }

    if (metrics['system.memory.usage']?.avg > 85) {
      recommendations.push('High memory usage - check for memory leaks');
    }

    if (metrics['pool.utilization']?.avg > 80) {
      recommendations.push('Browser pool utilization is high - increase pool size');
    }

    return recommendations;
  }
}

/**
 * Anomaly detector for identifying unusual patterns
 */
class AnomalyDetector {
  private readonly windowSize = 100;
  private readonly sensitivity = 2.5; // Standard deviations

  detect(collector: TimeSeriesMetricCollector): Array<{
    timestamp: Date;
    value: number;
    expectedRange: [number, number];
    severity: 'low' | 'medium' | 'high';
  }> {
    const values = collector.getValues();
    if (values.length < this.windowSize) return [];

    const anomalies: any[] = [];

    for (let i = this.windowSize; i < values.length; i++) {
      const window = values.slice(i - this.windowSize, i);
      const windowValues = window.map((v) => v.value);
      const current = values[i];

      const mean = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
      const stdDev = Math.sqrt(
        windowValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / windowValues.length,
      );

      const lowerBound = mean - this.sensitivity * stdDev;
      const upperBound = mean + this.sensitivity * stdDev;

      if (current.value < lowerBound || current.value > upperBound) {
        const deviation = Math.abs(current.value - mean) / stdDev;
        anomalies.push({
          timestamp: current.timestamp,
          value: current.value,
          expectedRange: [lowerBound, upperBound],
          severity: deviation > 4 ? 'high' : deviation > 3 ? 'medium' : 'low',
        });
      }
    }

    return anomalies;
  }
}

/**
 * SLA Monitor for tracking service level agreements
 */
export class SLAMonitor {
  private monitor: PerformanceMonitor;
  private slaTargets: Map<
    string,
    {
      target: number;
      window: number;
      calculation: 'average' | 'percentile' | 'max';
      percentile?: number;
    }
  > = new Map();

  constructor(monitor: PerformanceMonitor) {
    this.monitor = monitor;
  }

  /**
   * Add SLA target
   */
  addSLATarget(
    name: string,
    metric: string,
    target: number,
    window: string,
    calculation: 'average' | 'percentile' | 'max',
    percentile?: number,
  ): void {
    this.slaTargets.set(name, {
      target,
      window: this.parseWindow(window),
      calculation,
      percentile,
    });
  }

  /**
   * Check SLA compliance
   */
  checkCompliance(): Map<
    string,
    {
      compliant: boolean;
      actual: number;
      target: number;
      percentage: number;
    }
  > {
    const results = new Map();

    for (const [name, sla] of this.slaTargets) {
      const [metricName] = name.split('.');
      const metric = this.monitor.getMetric(metricName);

      if (!metric) continue;

      const stats = metric.getStats(sla.window);
      let actual: number;

      switch (sla.calculation) {
        case 'average':
          actual = stats.avg;
          break;
        case 'percentile':
          actual =
            sla.percentile === 95 ? stats.p95 : sla.percentile === 99 ? stats.p99 : stats.p50;
          break;
        case 'max':
          actual = stats.max;
          break;
      }

      const compliant = actual <= sla.target;
      const percentage = (actual / sla.target) * 100;

      results.set(name, {
        compliant,
        actual,
        target: sla.target,
        percentage,
      });
    }

    return results;
  }

  private parseWindow(window: string): number {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid window format: ${window}`);

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Invalid window unit: ${unit}`);
    }
  }
}
