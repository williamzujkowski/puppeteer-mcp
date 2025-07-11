/**
 * Base health check strategy
 * @module ws/websocket/health/strategies/base
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 */

import type { HealthMetrics, HealthCheckContext, HealthCheckOptions } from '../types.js';

/**
 * Health check issue
 */
export interface HealthCheckIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendation?: string;
}

/**
 * Health check strategy result
 */
export interface HealthCheckStrategyResult {
  passed: boolean;
  issues: HealthCheckIssue[];
  metrics?: Partial<HealthMetrics>;
}

/**
 * Abstract base class for health check strategies
 * @nist au-3 "Content of audit records"
 */
export abstract class HealthCheckStrategy {
  protected options: HealthCheckOptions;

  constructor(options: HealthCheckOptions) {
    this.options = options;
  }

  /**
   * Get strategy name
   */
  getName(): string {
    return this.options.name;
  }

  /**
   * Get strategy priority
   */
  getPriority(): number {
    return this.options.priority;
  }

  /**
   * Check if strategy is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Execute health check
   */
  abstract check(
    context: HealthCheckContext,
    metrics: HealthMetrics,
  ): Promise<HealthCheckStrategyResult>;

  /**
   * Get threshold value
   */
  protected getThreshold(key: string, defaultValue: number): number {
    return this.options.thresholds?.[key] ?? defaultValue;
  }
}
