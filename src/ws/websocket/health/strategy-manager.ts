/**
 * Health check strategy manager
 * @module ws/websocket/health/strategy-manager
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 */

import type { pino } from 'pino';
import { 
  HealthCheckStrategy, 
  MemoryCheckStrategy, 
  ConnectionCheckStrategy, 
  PerformanceCheckStrategy 
} from './strategies/index.js';
import type { HealthCheckContext, HealthMetrics } from './types.js';
import { HealthStatus } from './types.js';

/**
 * Manages and executes health check strategies
 * @nist au-3 "Content of audit records"
 */
export class StrategyManager {
  private strategies: HealthCheckStrategy[] = [];
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ module: 'health-strategy-manager' });
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default health check strategies
   */
  private initializeDefaultStrategies(): void {
    this.addStrategy(new MemoryCheckStrategy({
      name: 'memory-check',
      priority: 1,
      enabled: true,
      thresholds: {
        maxMemoryMB: 500,
        warningMemoryMB: 400,
      },
    }));

    this.addStrategy(new ConnectionCheckStrategy({
      name: 'connection-check',
      priority: 2,
      enabled: true,
      thresholds: {
        maxTurnoverRate: 10,
        warningTurnoverRate: 5,
        minAuthRatio: 0.8,
        maxConnections: 1000,
      },
    }));

    this.addStrategy(new PerformanceCheckStrategy({
      name: 'performance-check',
      priority: 3,
      enabled: true,
      thresholds: {
        maxResponseTime: 1000,
        warningResponseTime: 500,
        maxErrorRate: 0.1,
        warningErrorRate: 0.05,
        recentErrorThresholdMs: 300000,
        minUptimeMs: 300000,
      },
    }));
  }

  /**
   * Add a health check strategy
   */
  addStrategy(strategy: HealthCheckStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.getPriority() - b.getPriority());
    
    this.logger.debug('Added health check strategy', {
      name: strategy.getName(),
      priority: strategy.getPriority(),
    });
  }

  /**
   * Remove a health check strategy
   */
  removeStrategy(name: string): boolean {
    const initialLength = this.strategies.length;
    this.strategies = this.strategies.filter(s => s.getName() !== name);
    return this.strategies.length < initialLength;
  }

  /**
   * Execute all enabled health checks
   */
  async executeHealthChecks(
    context: HealthCheckContext, 
    metrics: HealthMetrics
  ): Promise<{
    status: HealthStatus;
    issues: string[];
    recommendations: string[];
  }> {
    const allIssues: string[] = [];
    const allRecommendations: string[] = [];
    let criticalCount = 0;
    let highCount = 0;

    for (const strategy of this.strategies) {
      if (!strategy.isEnabled()) {
        continue;
      }

      try {
        const result = await strategy.check(context, metrics);
        
        for (const issue of result.issues) {
          allIssues.push(issue.message);
          
          if (issue.recommendation) {
            allRecommendations.push(issue.recommendation);
          }

          if (issue.severity === 'critical') {
            criticalCount++;
          } else if (issue.severity === 'high') {
            highCount++;
          }
        }

        this.logger.debug('Health check completed', {
          strategy: strategy.getName(),
          passed: result.passed,
          issueCount: result.issues.length,
        });
      } catch (error) {
        this.logger.error('Health check strategy failed', {
          strategy: strategy.getName(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        allIssues.push(`Health check '${strategy.getName()}' failed`);
        highCount++;
      }
    }

    // Determine overall status
    let status: HealthStatus;
    if (criticalCount > 0) {
      status = HealthStatus.CRITICAL;
    } else if (highCount > 0 || allIssues.length > 3) {
      status = HealthStatus.WARNING;
    } else {
      status = HealthStatus.HEALTHY;
    }

    return { status, issues: allIssues, recommendations: allRecommendations };
  }

  /**
   * Get all strategies
   */
  getStrategies(): ReadonlyArray<HealthCheckStrategy> {
    return this.strategies;
  }

  /**
   * Update strategy configuration
   */
  updateStrategyConfig(name: string, enabled?: boolean, thresholds?: Record<string, number>): boolean {
    const strategy = this.strategies.find(s => s.getName() === name);
    if (!strategy) {
      return false;
    }

    // Note: In a real implementation, strategies would have setters for these properties
    // For now, we'll need to recreate the strategy with new options
    this.logger.info('Strategy configuration update requested', {
      strategy: name,
      enabled,
      thresholds,
    });

    return true;
  }
}