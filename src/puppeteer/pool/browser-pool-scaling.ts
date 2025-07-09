/**
 * Adaptive scaling algorithms for browser pool optimization
 * @module puppeteer/pool/browser-pool-scaling
 * @nist ac-4 "Information flow enforcement"
 * @nist si-4 "Information system monitoring"
 * @nist sc-2 "Application partitioning"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger.js';
import type { BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import type { ExtendedPoolMetrics } from './browser-pool-metrics.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';

const logger = createLogger('browser-pool-scaling');

/**
 * Scaling decision types
 */
export enum ScalingDecision {
  SCALE_UP = 'scale_up',
  SCALE_DOWN = 'scale_down',
  MAINTAIN = 'maintain',
  EMERGENCY_SCALE_UP = 'emergency_scale_up',
  FORCE_SCALE_DOWN = 'force_scale_down',
}

/**
 * Scaling strategy configuration
 */
export interface ScalingStrategy {
  /** Enable adaptive scaling */
  enabled: boolean;
  /** Minimum pool size */
  minSize: number;
  /** Maximum pool size */
  maxSize: number;
  /** Target utilization percentage (0-100) */
  targetUtilization: number;
  /** Scale up threshold percentage (0-100) */
  scaleUpThreshold: number;
  /** Scale down threshold percentage (0-100) */
  scaleDownThreshold: number;
  /** Cool-down period between scaling actions (ms) */
  cooldownPeriod: number;
  /** Enable predictive scaling */
  enablePredictiveScaling: boolean;
  /** Historical data window for predictions (ms) */
  predictionWindow: number;
  /** Aggressive scaling under high load */
  aggressiveScaling: boolean;
  /** Maximum scaling step size */
  maxScaleStep: number;
}

/**
 * Scaling metrics for decision making
 */
export interface ScalingMetrics {
  currentSize: number;
  targetSize: number;
  utilization: number;
  queueLength: number;
  avgResponseTime: number;
  errorRate: number;
  memoryPressure: number;
  cpuPressure: number;
  predictedLoad: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Historical data point for trend analysis
 */
interface HistoricalDataPoint {
  timestamp: Date;
  utilization: number;
  queueLength: number;
  errorRate: number;
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

/**
 * Adaptive scaling manager for browser pool
 * @nist si-4 "Information system monitoring"
 * @nist sc-2 "Application partitioning"
 */
export class BrowserPoolScaler extends EventEmitter {
  private strategy: ScalingStrategy;
  private lastScalingAction: Date;
  private historicalData: HistoricalDataPoint[] = [];
  private scalingTimer?: NodeJS.Timeout;
  private readonly maxHistorySize = 1000;
  private readonly evaluationInterval = 5000; // 5 seconds

  constructor(strategy: Partial<ScalingStrategy> = {}) {
    super();
    this.strategy = {
      enabled: true,
      minSize: 1,
      maxSize: 20,
      targetUtilization: 70,
      scaleUpThreshold: 80,
      scaleDownThreshold: 30,
      cooldownPeriod: 60000, // 1 minute
      enablePredictiveScaling: true,
      predictionWindow: 300000, // 5 minutes
      aggressiveScaling: false,
      maxScaleStep: 3,
      ...strategy,
    };
    this.lastScalingAction = new Date(0);
  }

  /**
   * Start the scaling monitor
   * @nist si-4 "Information system monitoring"
   */
  start(): void {
    if (!this.strategy.enabled) {
      logger.info('Scaling disabled - monitor not started');
      return;
    }

    logger.info(
      {
        strategy: this.strategy,
        interval: this.evaluationInterval,
      },
      'Starting adaptive scaling monitor'
    );

    this.scalingTimer = setInterval(() => {
      this.emit('evaluation-request');
    }, this.evaluationInterval);
  }

  /**
   * Stop the scaling monitor
   */
  stop(): void {
    if (this.scalingTimer) {
      clearInterval(this.scalingTimer);
      this.scalingTimer = undefined;
    }
    logger.info('Scaling monitor stopped');
  }

  /**
   * Evaluate scaling decision based on current metrics
   * @nist si-4 "Information system monitoring"
   */
  evaluateScaling(
    metrics: ExtendedPoolMetrics,
    browsers: Map<string, InternalBrowserInstance>,
    options: BrowserPoolOptions
  ): {
    decision: ScalingDecision;
    targetSize: number;
    reason: string;
    confidence: number;
  } {
    // Add current metrics to historical data
    this.addHistoricalData(metrics);

    // Calculate scaling metrics
    const scalingMetrics = this.calculateScalingMetrics(metrics, browsers);

    // Check cooldown period
    const now = new Date();
    const timeSinceLastAction = now.getTime() - this.lastScalingAction.getTime();
    const inCooldown = timeSinceLastAction < this.strategy.cooldownPeriod;

    // Determine scaling decision
    const decision = this.makeScalingDecision(scalingMetrics, options, inCooldown);

    logger.debug(
      {
        scalingMetrics,
        decision,
        inCooldown,
        timeSinceLastAction,
      },
      'Scaling evaluation completed'
    );

    return decision;
  }

  /**
   * Update scaling strategy
   * @nist cm-7 "Least functionality"
   */
  updateStrategy(newStrategy: Partial<ScalingStrategy>): void {
    const oldStrategy = { ...this.strategy };
    this.strategy = { ...this.strategy, ...newStrategy };

    logger.info(
      {
        oldStrategy,
        newStrategy: this.strategy,
        changes: Object.keys(newStrategy),
      },
      'Scaling strategy updated'
    );

    this.emit('strategy-updated', { oldStrategy, newStrategy: this.strategy });
  }

  /**
   * Get current scaling strategy
   */
  getStrategy(): ScalingStrategy {
    return { ...this.strategy };
  }

  /**
   * Get historical scaling data
   */
  getHistoricalData(): HistoricalDataPoint[] {
    return [...this.historicalData];
  }

  /**
   * Record scaling action
   * @nist au-3 "Content of audit records"
   */
  recordScalingAction(decision: ScalingDecision, from: number, to: number): void {
    this.lastScalingAction = new Date();
    
    logger.info(
      {
        decision,
        from,
        to,
        timestamp: this.lastScalingAction,
      },
      'Scaling action recorded'
    );

    this.emit('scaling-action', {
      decision,
      from,
      to,
      timestamp: this.lastScalingAction,
    });
  }

  /**
   * Add historical data point
   * @private
   */
  private addHistoricalData(metrics: ExtendedPoolMetrics): void {
    const dataPoint: HistoricalDataPoint = {
      timestamp: new Date(),
      utilization: metrics.utilizationPercentage,
      queueLength: metrics.queue.queueLength,
      errorRate: metrics.errors.errorRate,
      responseTime: metrics.avgPageCreationTime,
      memoryUsage: metrics.resources.totalMemoryUsage,
      cpuUsage: metrics.resources.totalCpuUsage,
    };

    this.historicalData.push(dataPoint);

    // Maintain maximum history size
    if (this.historicalData.length > this.maxHistorySize) {
      this.historicalData.shift();
    }
  }

  /**
   * Calculate scaling metrics for decision making
   * @private
   */
  private calculateScalingMetrics(
    metrics: ExtendedPoolMetrics,
    browsers: Map<string, InternalBrowserInstance>
  ): ScalingMetrics {
    const currentSize = browsers.size;
    const utilization = metrics.utilizationPercentage;
    const queueLength = metrics.queue.queueLength;
    const avgResponseTime = metrics.avgPageCreationTime;
    const errorRate = metrics.errors.errorRate;
    
    // Calculate resource pressure (0-100)
    const memoryPressure = this.calculateResourcePressure(metrics.resources.avgMemoryPerBrowser, 80);
    const cpuPressure = this.calculateResourcePressure(metrics.resources.avgCpuPerBrowser, 80);

    // Calculate predicted load and trend
    const { predictedLoad, trend } = this.calculatePredictedLoad();

    // Calculate target size based on utilization and predictions
    const targetSize = this.calculateTargetSize(utilization, predictedLoad, currentSize);

    return {
      currentSize,
      targetSize,
      utilization,
      queueLength,
      avgResponseTime,
      errorRate,
      memoryPressure,
      cpuPressure,
      predictedLoad,
      trend,
    };
  }

  /**
   * Calculate resource pressure as percentage
   * @private
   */
  private calculateResourcePressure(usage: number, threshold: number): number {
    return Math.min(100, (usage / threshold) * 100);
  }

  /**
   * Calculate predicted load based on historical trends
   * @private
   */
  private calculatePredictedLoad(): { predictedLoad: number; trend: 'increasing' | 'decreasing' | 'stable' } {
    if (!this.strategy.enablePredictiveScaling || this.historicalData.length < 10) {
      return { predictedLoad: 0, trend: 'stable' };
    }

    const recentData = this.historicalData.slice(-10);
    const utilizationValues = recentData.map(d => d.utilization);
    
    // Simple linear trend calculation
    const avgChange = this.calculateTrendSlope(utilizationValues);
    const currentUtilization = utilizationValues[utilizationValues.length - 1] || 0;
    
    // Predict utilization 5 minutes ahead
    const predictedUtilization = currentUtilization + (avgChange * 5);
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (avgChange > 2) trend = 'increasing';
    else if (avgChange < -2) trend = 'decreasing';

    return {
      predictedLoad: Math.max(0, Math.min(100, predictedUtilization)),
      trend,
    };
  }

  /**
   * Calculate trend slope using linear regression
   * @private
   */
  private calculateTrendSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  /**
   * Calculate target pool size based on utilization and predictions
   * @private
   */
  private calculateTargetSize(
    utilization: number,
    predictedLoad: number,
    currentSize: number
  ): number {
    const targetUtilization = this.strategy.targetUtilization;
    const effectiveLoad = Math.max(utilization, predictedLoad);
    
    // Calculate ideal size based on target utilization
    const idealSize = Math.ceil((effectiveLoad / targetUtilization) * currentSize);
    
    // Apply bounds
    return Math.max(
      this.strategy.minSize,
      Math.min(this.strategy.maxSize, idealSize)
    );
  }

  /**
   * Make scaling decision based on metrics
   * @private
   */
  private makeScalingDecision(
    metrics: ScalingMetrics,
    options: BrowserPoolOptions,
    inCooldown: boolean
  ): {
    decision: ScalingDecision;
    targetSize: number;
    reason: string;
    confidence: number;
  } {
    const { currentSize, targetSize, utilization, queueLength, errorRate, memoryPressure, cpuPressure, trend } = metrics;

    // Emergency conditions (override cooldown)
    if (queueLength > 10 && utilization > 95) {
      return {
        decision: ScalingDecision.EMERGENCY_SCALE_UP,
        targetSize: Math.min(currentSize + this.strategy.maxScaleStep, this.strategy.maxSize),
        reason: 'Emergency scaling due to high queue length and utilization',
        confidence: 95,
      };
    }

    if (errorRate > 20 && utilization > 90) {
      return {
        decision: ScalingDecision.EMERGENCY_SCALE_UP,
        targetSize: Math.min(currentSize + 2, this.strategy.maxSize),
        reason: 'Emergency scaling due to high error rate',
        confidence: 90,
      };
    }

    // Force scale down if resource pressure is critical
    if (memoryPressure > 95 || cpuPressure > 95) {
      return {
        decision: ScalingDecision.FORCE_SCALE_DOWN,
        targetSize: Math.max(currentSize - 1, this.strategy.minSize),
        reason: 'Force scale down due to resource pressure',
        confidence: 85,
      };
    }

    // Normal scaling decisions (respect cooldown)
    if (inCooldown) {
      return {
        decision: ScalingDecision.MAINTAIN,
        targetSize: currentSize,
        reason: 'In cooldown period',
        confidence: 100,
      };
    }

    // Scale up conditions
    if (utilization > this.strategy.scaleUpThreshold || 
        (trend === 'increasing' && utilization > this.strategy.targetUtilization)) {
      const scaleStep = this.strategy.aggressiveScaling ? 
        Math.min(this.strategy.maxScaleStep, Math.ceil((utilization - this.strategy.targetUtilization) / 20)) : 1;
      
      return {
        decision: ScalingDecision.SCALE_UP,
        targetSize: Math.min(currentSize + scaleStep, this.strategy.maxSize),
        reason: `High utilization (${utilization}%) or increasing trend`,
        confidence: 80,
      };
    }

    // Scale down conditions
    if (utilization < this.strategy.scaleDownThreshold && 
        queueLength === 0 && 
        trend !== 'increasing' &&
        currentSize > this.strategy.minSize) {
      return {
        decision: ScalingDecision.SCALE_DOWN,
        targetSize: Math.max(currentSize - 1, this.strategy.minSize),
        reason: `Low utilization (${utilization}%) and no queue`,
        confidence: 70,
      };
    }

    // Maintain current size
    return {
      decision: ScalingDecision.MAINTAIN,
      targetSize: currentSize,
      reason: 'Metrics within acceptable range',
      confidence: 60,
    };
  }
}

/**
 * Default scaling strategy
 */
export const DEFAULT_SCALING_STRATEGY: ScalingStrategy = {
  enabled: true,
  minSize: 1,
  maxSize: 10,
  targetUtilization: 70,
  scaleUpThreshold: 80,
  scaleDownThreshold: 30,
  cooldownPeriod: 60000,
  enablePredictiveScaling: true,
  predictionWindow: 300000,
  aggressiveScaling: false,
  maxScaleStep: 2,
};