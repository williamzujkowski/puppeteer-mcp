/**
 * Intelligent browser recycling with health-based eviction
 * @module puppeteer/pool/browser-pool-recycler
 * @nist ac-12 "Session termination"
 * @nist si-4 "Information system monitoring"
 * @nist sc-2 "Application partitioning"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import type { BrowserResourceUsage } from './browser-pool-resource-manager.js';

const logger = createLogger('browser-pool-recycler');

/**
 * Recycling strategy
 */
export enum RecyclingStrategy {
  TIME_BASED = 'time_based',
  USAGE_BASED = 'usage_based',
  HEALTH_BASED = 'health_based',
  RESOURCE_BASED = 'resource_based',
  HYBRID = 'hybrid',
}

/**
 * Recycling reason
 */
export enum RecyclingReason {
  MAX_LIFETIME = 'max_lifetime',
  MAX_USAGE = 'max_usage',
  HEALTH_DEGRADATION = 'health_degradation',
  MEMORY_PRESSURE = 'memory_pressure',
  CPU_PRESSURE = 'cpu_pressure',
  CONNECTION_OVERLOAD = 'connection_overload',
  ERROR_THRESHOLD = 'error_threshold',
  MANUAL_TRIGGER = 'manual_trigger',
  SCHEDULED_MAINTENANCE = 'scheduled_maintenance',
}

/**
 * Recycling configuration
 */
export interface RecyclingConfig {
  enabled: boolean;
  strategy: RecyclingStrategy;
  
  // Time-based settings
  maxLifetimeMs: number;
  maxIdleTimeMs: number;
  
  // Usage-based settings
  maxUseCount: number;
  maxPageCount: number;
  
  // Health-based settings
  healthCheckInterval: number;
  healthThreshold: number;
  consecutiveFailuresLimit: number;
  
  // Resource-based settings
  maxMemoryUsageMB: number;
  maxCpuUsagePercent: number;
  maxConnectionCount: number;
  maxHandleCount: number;
  
  // Hybrid settings
  weightTimeBasedScore: number;
  weightUsageBasedScore: number;
  weightHealthBasedScore: number;
  weightResourceBasedScore: number;
  
  // Recycling behavior
  recyclingThreshold: number;
  batchRecyclingEnabled: boolean;
  maxBatchSize: number;
  recyclingCooldownMs: number;
  
  // Maintenance settings
  scheduledMaintenanceEnabled: boolean;
  maintenanceInterval: number;
  maintenanceWindowStart: number; // Hour of day (0-23)
  maintenanceWindowEnd: number; // Hour of day (0-23)
}

/**
 * Browser health metrics
 */
export interface BrowserHealthMetrics {
  browserId: string;
  overallHealth: number; // 0-100
  responsiveness: number; // 0-100
  stability: number; // 0-100
  performance: number; // 0-100
  lastHealthCheck: Date;
  consecutiveFailures: number;
  totalHealthChecks: number;
  failureRate: number;
  avgResponseTime: number;
  errorCount: number;
  warningCount: number;
}

/**
 * Recycling candidate
 */
export interface RecyclingCandidate {
  browserId: string;
  instance: InternalBrowserInstance;
  score: number;
  reasons: RecyclingReason[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: 'minimal' | 'moderate' | 'significant' | 'severe';
  recommendedAction: 'recycle' | 'monitor' | 'optimize';
  metrics: {
    ageMs: number;
    useCount: number;
    pageCount: number;
    memoryUsageMB: number;
    cpuUsagePercent: number;
    healthScore: number;
    errorRate: number;
  };
}

/**
 * Recycling event
 */
export interface RecyclingEvent {
  browserId: string;
  reason: RecyclingReason;
  strategy: RecyclingStrategy;
  score: number;
  timestamp: Date;
  success: boolean;
  executionTimeMs: number;
  replacementBrowserId?: string;
}

/**
 * Intelligent browser recycler
 * @nist ac-12 "Session termination"
 * @nist si-4 "Information system monitoring"
 */
export class BrowserPoolRecycler extends EventEmitter {
  private config: RecyclingConfig;
  private healthMetrics: Map<string, BrowserHealthMetrics> = new Map();
  private lastRecyclingAction: Date;
  private recyclingHistory: RecyclingEvent[] = new Map();
  private maintenanceTimer?: NodeJS.Timeout;
  private readonly maxHistorySize = 500;

  constructor(config: Partial<RecyclingConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      strategy: RecyclingStrategy.HYBRID,
      
      // Time-based defaults
      maxLifetimeMs: 2 * 60 * 60 * 1000, // 2 hours
      maxIdleTimeMs: 30 * 60 * 1000, // 30 minutes
      
      // Usage-based defaults
      maxUseCount: 100,
      maxPageCount: 50,
      
      // Health-based defaults
      healthCheckInterval: 60000, // 1 minute
      healthThreshold: 70,
      consecutiveFailuresLimit: 3,
      
      // Resource-based defaults
      maxMemoryUsageMB: 500,
      maxCpuUsagePercent: 80,
      maxConnectionCount: 100,
      maxHandleCount: 1000,
      
      // Hybrid defaults
      weightTimeBasedScore: 0.25,
      weightUsageBasedScore: 0.25,
      weightHealthBasedScore: 0.30,
      weightResourceBasedScore: 0.20,
      
      // Recycling behavior defaults
      recyclingThreshold: 80,
      batchRecyclingEnabled: true,
      maxBatchSize: 3,
      recyclingCooldownMs: 300000, // 5 minutes
      
      // Maintenance defaults
      scheduledMaintenanceEnabled: true,
      maintenanceInterval: 6 * 60 * 60 * 1000, // 6 hours
      maintenanceWindowStart: 2, // 2 AM
      maintenanceWindowEnd: 4, // 4 AM
      
      ...config,
    };

    this.lastRecyclingAction = new Date(0);
  }

  /**
   * Start the recycler
   * @nist si-4 "Information system monitoring"
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Browser recycling disabled');
      return;
    }

    logger.info(
      {
        config: this.config,
      },
      'Starting browser recycler'
    );

    // Start scheduled maintenance if enabled
    if (this.config.scheduledMaintenanceEnabled) {
      this.startScheduledMaintenance();
    }

    this.emit('recycler-started');
  }

  /**
   * Stop the recycler
   */
  stop(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = undefined;
    }

    logger.info('Browser recycler stopped');
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
    const candidates: RecyclingCandidate[] = [];

    for (const [browserId, instance] of browsers) {
      const candidate = this.evaluateBrowser(instance, resourceUsage.get(browserId));
      if (candidate.score >= this.config.recyclingThreshold) {
        candidates.push(candidate);
      }
    }

    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);

    logger.debug(
      {
        totalBrowsers: browsers.size,
        candidates: candidates.length,
        highPriority: candidates.filter(c => c.urgency === 'critical' || c.urgency === 'high').length,
      },
      'Browser recycling evaluation completed'
    );

    return candidates;
  }

  /**
   * Evaluate a single browser for recycling
   * @nist ac-12 "Session termination"
   */
  evaluateBrowser(
    instance: InternalBrowserInstance,
    resourceUsage?: BrowserResourceUsage
  ): RecyclingCandidate {
    const browserId = instance.id;
    const now = new Date();
    
    // Calculate basic metrics
    const ageMs = now.getTime() - instance.createdAt.getTime();
    const idleTimeMs = now.getTime() - instance.lastUsedAt.getTime();
    const useCount = instance.useCount;
    const pageCount = instance.pageCount;
    
    // Get resource metrics
    const memoryUsageMB = resourceUsage ? resourceUsage.memoryUsage.rss / 1024 / 1024 : 0;
    const cpuUsagePercent = resourceUsage ? resourceUsage.cpuUsage.percent : 0;
    
    // Get health metrics
    const healthMetrics = this.healthMetrics.get(browserId);
    const healthScore = healthMetrics ? healthMetrics.overallHealth : 100;
    const errorRate = healthMetrics ? healthMetrics.failureRate : 0;

    // Calculate scores based on strategy
    let score = 0;
    const reasons: RecyclingReason[] = [];

    switch (this.config.strategy) {
      case RecyclingStrategy.TIME_BASED:
        score = this.calculateTimeBasedScore(ageMs, idleTimeMs, reasons);
        break;
      case RecyclingStrategy.USAGE_BASED:
        score = this.calculateUsageBasedScore(useCount, pageCount, reasons);
        break;
      case RecyclingStrategy.HEALTH_BASED:
        score = this.calculateHealthBasedScore(healthScore, errorRate, reasons);
        break;
      case RecyclingStrategy.RESOURCE_BASED:
        score = this.calculateResourceBasedScore(memoryUsageMB, cpuUsagePercent, reasons);
        break;
      case RecyclingStrategy.HYBRID:
        score = this.calculateHybridScore(
          ageMs, idleTimeMs, useCount, pageCount, 
          healthScore, errorRate, memoryUsageMB, cpuUsagePercent, reasons
        );
        break;
    }

    // Determine urgency and impact
    const urgency = this.determineUrgency(score, reasons);
    const estimatedImpact = this.estimateImpact(score, reasons);
    const recommendedAction = this.getRecommendedAction(score, urgency);

    return {
      browserId,
      instance,
      score,
      reasons,
      urgency,
      estimatedImpact,
      recommendedAction,
      metrics: {
        ageMs,
        useCount,
        pageCount,
        memoryUsageMB,
        cpuUsagePercent,
        healthScore,
        errorRate,
      },
    };
  }

  /**
   * Update health metrics for a browser
   * @nist si-4 "Information system monitoring"
   */
  updateHealthMetrics(browserId: string, healthResult: any): void {
    const existing = this.healthMetrics.get(browserId);
    const now = new Date();

    const metrics: BrowserHealthMetrics = {
      browserId,
      overallHealth: healthResult.healthy ? 100 : 0,
      responsiveness: healthResult.responsive ? 100 : 0,
      stability: existing ? existing.stability : 100,
      performance: existing ? existing.performance : 100,
      lastHealthCheck: now,
      consecutiveFailures: healthResult.healthy ? 0 : (existing ? existing.consecutiveFailures + 1 : 1),
      totalHealthChecks: existing ? existing.totalHealthChecks + 1 : 1,
      failureRate: 0,
      avgResponseTime: existing ? existing.avgResponseTime : 0,
      errorCount: existing ? existing.errorCount : 0,
      warningCount: existing ? existing.warningCount : 0,
    };

    // Calculate failure rate
    if (metrics.totalHealthChecks > 0) {
      const failures = metrics.consecutiveFailures + (existing ? existing.errorCount : 0);
      metrics.failureRate = (failures / metrics.totalHealthChecks) * 100;
    }

    this.healthMetrics.set(browserId, metrics);
  }

  /**
   * Execute recycling for candidates
   * @nist ac-12 "Session termination"
   */
  async executeRecycling(
    candidates: RecyclingCandidate[],
    recycleCallback: (browserId: string) => Promise<void>
  ): Promise<RecyclingEvent[]> {
    if (!this.config.enabled) {
      return [];
    }

    // Check cooldown period
    const now = new Date();
    const timeSinceLastAction = now.getTime() - this.lastRecyclingAction.getTime();
    if (timeSinceLastAction < this.config.recyclingCooldownMs) {
      logger.debug(
        {
          timeSinceLastAction,
          cooldownPeriod: this.config.recyclingCooldownMs,
        },
        'Recycling in cooldown period'
      );
      return [];
    }

    // Filter candidates based on urgency and batch size
    const criticalCandidates = candidates.filter(c => c.urgency === 'critical');
    const highPriorityCandidates = candidates.filter(c => c.urgency === 'high');
    
    let toRecycle: RecyclingCandidate[] = [];
    
    // Always recycle critical candidates
    toRecycle = [...criticalCandidates];
    
    // Add high priority candidates if batch recycling is enabled
    if (this.config.batchRecyclingEnabled) {
      const remaining = this.config.maxBatchSize - toRecycle.length;
      if (remaining > 0) {
        toRecycle = [...toRecycle, ...highPriorityCandidates.slice(0, remaining)];
      }
    }

    // Execute recycling
    const events: RecyclingEvent[] = [];
    
    for (const candidate of toRecycle) {
      const startTime = Date.now();
      let success = false;
      
      try {
        await recycleCallback(candidate.browserId);
        success = true;
        
        logger.info(
          {
            browserId: candidate.browserId,
            reasons: candidate.reasons,
            score: candidate.score,
            strategy: this.config.strategy,
          },
          'Browser recycled successfully'
        );
      } catch (error) {
        logger.error(
          {
            browserId: candidate.browserId,
            error,
            reasons: candidate.reasons,
          },
          'Error recycling browser'
        );
      }

      const event: RecyclingEvent = {
        browserId: candidate.browserId,
        reason: candidate.reasons[0] || RecyclingReason.MANUAL_TRIGGER,
        strategy: this.config.strategy,
        score: candidate.score,
        timestamp: new Date(),
        success,
        executionTimeMs: Date.now() - startTime,
      };

      events.push(event);
      this.addToRecyclingHistory(event);
    }

    if (events.length > 0) {
      this.lastRecyclingAction = now;
      this.emit('browsers-recycled', events);
    }

    return events;
  }

  /**
   * Get recycling statistics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  getRecyclingStats(): {
    totalRecycled: number;
    successRate: number;
    avgExecutionTime: number;
    reasonBreakdown: Record<RecyclingReason, number>;
    recentEvents: RecyclingEvent[];
  } {
    const totalRecycled = this.recyclingHistory.length;
    const successfulRecycling = this.recyclingHistory.filter(e => e.success).length;
    const successRate = totalRecycled > 0 ? (successfulRecycling / totalRecycled) * 100 : 0;
    
    const avgExecutionTime = totalRecycled > 0 
      ? this.recyclingHistory.reduce((sum, e) => sum + e.executionTimeMs, 0) / totalRecycled
      : 0;

    const reasonBreakdown: Record<RecyclingReason, number> = {} as any;
    for (const event of this.recyclingHistory) {
      reasonBreakdown[event.reason] = (reasonBreakdown[event.reason] || 0) + 1;
    }

    const recentEvents = this.recyclingHistory.slice(-20);

    return {
      totalRecycled,
      successRate,
      avgExecutionTime,
      reasonBreakdown,
      recentEvents,
    };
  }

  /**
   * Update recycling configuration
   * @nist cm-7 "Least functionality"
   */
  updateConfig(newConfig: Partial<RecyclingConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    logger.info(
      {
        oldConfig,
        newConfig: this.config,
        changes: Object.keys(newConfig),
      },
      'Recycling configuration updated'
    );

    this.emit('config-updated', { oldConfig, newConfig: this.config });
  }

  /**
   * Calculate time-based score
   * @private
   */
  private calculateTimeBasedScore(ageMs: number, idleTimeMs: number, reasons: RecyclingReason[]): number {
    let score = 0;

    // Age-based scoring
    if (ageMs > this.config.maxLifetimeMs) {
      score += 100;
      reasons.push(RecyclingReason.MAX_LIFETIME);
    } else {
      score += (ageMs / this.config.maxLifetimeMs) * 60;
    }

    // Idle time scoring
    if (idleTimeMs > this.config.maxIdleTimeMs) {
      score += 40;
    } else {
      score += (idleTimeMs / this.config.maxIdleTimeMs) * 20;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate usage-based score
   * @private
   */
  private calculateUsageBasedScore(useCount: number, pageCount: number, reasons: RecyclingReason[]): number {
    let score = 0;

    // Use count scoring
    if (useCount > this.config.maxUseCount) {
      score += 100;
      reasons.push(RecyclingReason.MAX_USAGE);
    } else {
      score += (useCount / this.config.maxUseCount) * 60;
    }

    // Page count scoring
    if (pageCount > this.config.maxPageCount) {
      score += 40;
    } else {
      score += (pageCount / this.config.maxPageCount) * 20;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate health-based score
   * @private
   */
  private calculateHealthBasedScore(healthScore: number, errorRate: number, reasons: RecyclingReason[]): number {
    let score = 0;

    // Health score (inverted - lower health = higher recycling score)
    if (healthScore < this.config.healthThreshold) {
      score += 100;
      reasons.push(RecyclingReason.HEALTH_DEGRADATION);
    } else {
      score += (100 - healthScore) * 0.8;
    }

    // Error rate scoring
    if (errorRate > 10) {
      score += 40;
      reasons.push(RecyclingReason.ERROR_THRESHOLD);
    } else {
      score += errorRate * 2;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate resource-based score
   * @private
   */
  private calculateResourceBasedScore(memoryUsageMB: number, cpuUsagePercent: number, reasons: RecyclingReason[]): number {
    let score = 0;

    // Memory usage scoring
    if (memoryUsageMB > this.config.maxMemoryUsageMB) {
      score += 100;
      reasons.push(RecyclingReason.MEMORY_PRESSURE);
    } else {
      score += (memoryUsageMB / this.config.maxMemoryUsageMB) * 60;
    }

    // CPU usage scoring
    if (cpuUsagePercent > this.config.maxCpuUsagePercent) {
      score += 40;
      reasons.push(RecyclingReason.CPU_PRESSURE);
    } else {
      score += (cpuUsagePercent / this.config.maxCpuUsagePercent) * 20;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate hybrid score
   * @private
   */
  private calculateHybridScore(
    ageMs: number, idleTimeMs: number, useCount: number, pageCount: number,
    healthScore: number, errorRate: number, memoryUsageMB: number, cpuUsagePercent: number,
    reasons: RecyclingReason[]
  ): number {
    const timeScore = this.calculateTimeBasedScore(ageMs, idleTimeMs, reasons);
    const usageScore = this.calculateUsageBasedScore(useCount, pageCount, reasons);
    const healthScore_ = this.calculateHealthBasedScore(healthScore, errorRate, reasons);
    const resourceScore = this.calculateResourceBasedScore(memoryUsageMB, cpuUsagePercent, reasons);

    return (
      timeScore * this.config.weightTimeBasedScore +
      usageScore * this.config.weightUsageBasedScore +
      healthScore_ * this.config.weightHealthBasedScore +
      resourceScore * this.config.weightResourceBasedScore
    );
  }

  /**
   * Determine urgency based on score and reasons
   * @private
   */
  private determineUrgency(score: number, reasons: RecyclingReason[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalReasons = [
      RecyclingReason.MEMORY_PRESSURE,
      RecyclingReason.CPU_PRESSURE,
      RecyclingReason.CONNECTION_OVERLOAD,
    ];

    if (reasons.some(r => criticalReasons.includes(r)) || score >= 95) {
      return 'critical';
    }

    if (score >= 85) {
      return 'high';
    }

    if (score >= 75) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Estimate impact of recycling
   * @private
   */
  private estimateImpact(score: number, reasons: RecyclingReason[]): 'minimal' | 'moderate' | 'significant' | 'severe' {
    const severeReasons = [
      RecyclingReason.MEMORY_PRESSURE,
      RecyclingReason.CPU_PRESSURE,
    ];

    if (reasons.some(r => severeReasons.includes(r))) {
      return 'severe';
    }

    if (score >= 90) {
      return 'significant';
    }

    if (score >= 80) {
      return 'moderate';
    }

    return 'minimal';
  }

  /**
   * Get recommended action
   * @private
   */
  private getRecommendedAction(score: number, urgency: string): 'recycle' | 'monitor' | 'optimize' {
    if (urgency === 'critical' || score >= 90) {
      return 'recycle';
    }

    if (score >= 80) {
      return 'optimize';
    }

    return 'monitor';
  }

  /**
   * Add to recycling history
   * @private
   */
  private addToRecyclingHistory(event: RecyclingEvent): void {
    this.recyclingHistory.push(event);

    // Maintain maximum history size
    if (this.recyclingHistory.length > this.maxHistorySize) {
      this.recyclingHistory.shift();
    }
  }

  /**
   * Start scheduled maintenance
   * @private
   */
  private startScheduledMaintenance(): void {
    this.maintenanceTimer = setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();

      // Check if we're in the maintenance window
      if (currentHour >= this.config.maintenanceWindowStart && 
          currentHour <= this.config.maintenanceWindowEnd) {
        this.emit('scheduled-maintenance-trigger');
      }
    }, this.config.maintenanceInterval);
  }
}

/**
 * Default recycling configuration
 */
export const DEFAULT_RECYCLING_CONFIG: RecyclingConfig = {
  enabled: true,
  strategy: RecyclingStrategy.HYBRID,
  maxLifetimeMs: 2 * 60 * 60 * 1000, // 2 hours
  maxIdleTimeMs: 30 * 60 * 1000, // 30 minutes
  maxUseCount: 100,
  maxPageCount: 50,
  healthCheckInterval: 60000,
  healthThreshold: 70,
  consecutiveFailuresLimit: 3,
  maxMemoryUsageMB: 500,
  maxCpuUsagePercent: 80,
  maxConnectionCount: 100,
  maxHandleCount: 1000,
  weightTimeBasedScore: 0.25,
  weightUsageBasedScore: 0.25,
  weightHealthBasedScore: 0.30,
  weightResourceBasedScore: 0.20,
  recyclingThreshold: 80,
  batchRecyclingEnabled: true,
  maxBatchSize: 3,
  recyclingCooldownMs: 300000,
  scheduledMaintenanceEnabled: true,
  maintenanceInterval: 6 * 60 * 60 * 1000,
  maintenanceWindowStart: 2,
  maintenanceWindowEnd: 4,
};