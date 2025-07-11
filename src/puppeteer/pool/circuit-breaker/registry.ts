/**
 * Circuit breaker registry for managing multiple circuit breakers
 * @module puppeteer/pool/circuit-breaker/registry
 * @nist au-3 "Content of audit records"
 * @nist si-4 "Information system monitoring"
 */

import { CircuitBreaker } from './circuit-breaker-core.js';
import { CircuitBreakerConfig, CircuitBreakerState } from './types.js';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './config.js';
import { createLogger } from '../../../utils/logger.js';
import { evictCircuitBreaker, setupEventForwarding } from './registry-utils.js';

const logger = createLogger('circuit-breaker-registry');

/**
 * Registry status
 */
export interface RegistryStatus {
  totalCircuitBreakers: number;
  healthyCircuitBreakers: number;
  openCircuitBreakers: number;
  circuitBreakers: Array<{
    name: string;
    state: CircuitBreakerState;
    healthy: boolean;
  }>;
}

/**
 * Registry options
 */
export interface RegistryOptions {
  maxCircuitBreakers?: number;
  globalConfig?: Partial<CircuitBreakerConfig>;
  enableMetricsAggregation?: boolean;
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 * @nist au-3 "Content of audit records"
 */
export class CircuitBreakerRegistry {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private globalConfig: CircuitBreakerConfig;
  private readonly maxCircuitBreakers: number;
  private readonly enableMetricsAggregation: boolean;

  constructor(options: RegistryOptions = {}) {
    this.globalConfig = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...options.globalConfig,
    };
    this.maxCircuitBreakers = options.maxCircuitBreakers || 100;
    this.enableMetricsAggregation = options.enableMetricsAggregation ?? true;

    logger.info(
      {
        globalConfig: this.globalConfig,
        maxCircuitBreakers: this.maxCircuitBreakers,
        enableMetricsAggregation: this.enableMetricsAggregation,
      },
      'Circuit breaker registry initialized',
    );
  }

  /**
   * Get or create circuit breaker
   * @nist au-3 "Content of audit records"
   */
  getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let circuitBreaker = this.circuitBreakers.get(name);

    if (!circuitBreaker) {
      // Check capacity
      if (this.circuitBreakers.size >= this.maxCircuitBreakers) {
        evictCircuitBreaker(this.circuitBreakers, (name) => this.removeCircuitBreaker(name));
      }

      const mergedConfig = { ...this.globalConfig, ...config };
      circuitBreaker = new CircuitBreaker(name, mergedConfig);
      this.circuitBreakers.set(name, circuitBreaker);

      // Setup event forwarding
      if (this.enableMetricsAggregation) {
        setupEventForwarding(name, circuitBreaker);
      }

      logger.info(
        {
          name,
          config: mergedConfig,
          totalCircuitBreakers: this.circuitBreakers.size,
        },
        'Circuit breaker created',
      );
    }

    return circuitBreaker;
  }

  /**
   * Remove circuit breaker
   */
  removeCircuitBreaker(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (circuitBreaker) {
      circuitBreaker.destroy();
      this.circuitBreakers.delete(name);

      logger.info(
        {
          name,
          remainingCircuitBreakers: this.circuitBreakers.size,
        },
        'Circuit breaker removed',
      );

      return true;
    }
    return false;
  }

  /**
   * Check if circuit breaker exists
   */
  hasCircuitBreaker(name: string): boolean {
    return this.circuitBreakers.has(name);
  }

  /**
   * Get all circuit breakers
   */
  getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Get circuit breaker names
   */
  getCircuitBreakerNames(): string[] {
    return Array.from(this.circuitBreakers.keys());
  }

  /**
   * Get registry status
   * @nist si-4 "Information system monitoring"
   */
  getStatus(): RegistryStatus {
    const circuitBreakers = Array.from(this.circuitBreakers.entries()).map(([name, cb]) => {
      const status = cb.getStatus();
      return {
        name,
        state: status.state,
        healthy: status.healthy,
      };
    });

    return {
      totalCircuitBreakers: this.circuitBreakers.size,
      healthyCircuitBreakers: circuitBreakers.filter((cb) => cb.healthy).length,
      openCircuitBreakers: circuitBreakers.filter((cb) => cb.state === CircuitBreakerState.OPEN)
        .length,
      circuitBreakers,
    };
  }

  /**
   * Get aggregated metrics
   * @nist si-4 "Information system monitoring"
   */
  getAggregatedMetrics(): {
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    averageFailureRate: number;
    averageResponseTime: number;
    circuitBreakerMetrics: Map<string, any>;
  } {
    let totalRequests = 0;
    let totalFailures = 0;
    let totalSuccesses = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    const circuitBreakerMetrics = new Map<string, any>();

    for (const [name, cb] of this.circuitBreakers) {
      const metrics = cb.getMetrics();
      circuitBreakerMetrics.set(name, metrics);

      totalRequests += metrics.requestCount;
      totalFailures += metrics.failureCount;
      totalSuccesses += metrics.successCount;

      if (metrics.averageResponseTime > 0) {
        totalResponseTime += metrics.averageResponseTime;
        responseTimeCount++;
      }
    }

    const averageFailureRate = totalRequests > 0 ? (totalFailures / totalRequests) * 100 : 0;
    const averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    return {
      totalRequests,
      totalFailures,
      totalSuccesses,
      averageFailureRate,
      averageResponseTime,
      circuitBreakerMetrics,
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }

    logger.info(
      {
        resetCount: this.circuitBreakers.size,
      },
      'All circuit breakers reset',
    );
  }

  /**
   * Update global configuration
   */
  updateGlobalConfig(config: Partial<CircuitBreakerConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };

    logger.info(
      {
        config: this.globalConfig,
      },
      'Global circuit breaker configuration updated',
    );
  }

  /**
   * Apply configuration to all circuit breakers
   */
  applyConfigToAll(config: Partial<CircuitBreakerConfig>): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.updateConfig(config);
    }

    logger.info(
      {
        config,
        appliedTo: this.circuitBreakers.size,
      },
      'Configuration applied to all circuit breakers',
    );
  }

  /**
   * Find circuit breakers by state
   */
  findByState(state: CircuitBreakerState): Array<{ name: string; circuitBreaker: CircuitBreaker }> {
    const results: Array<{ name: string; circuitBreaker: CircuitBreaker }> = [];

    for (const [name, cb] of this.circuitBreakers) {
      if (cb.getStatus().state === state) {
        results.push({ name, circuitBreaker: cb });
      }
    }

    return results;
  }

  /**
   * Find unhealthy circuit breakers
   */
  findUnhealthy(): Array<{ name: string; circuitBreaker: CircuitBreaker; issues: string[] }> {
    const results: Array<{ name: string; circuitBreaker: CircuitBreaker; issues: string[] }> = [];

    for (const [name, cb] of this.circuitBreakers) {
      const status = cb.getStatus();
      if (!status.healthy) {
        const issues: string[] = [];

        if (status.state === CircuitBreakerState.OPEN) {
          issues.push('Circuit is open');
        }

        if (status.metrics.failureRate > 50) {
          issues.push(`High failure rate: ${status.metrics.failureRate.toFixed(2)}%`);
        }

        if (status.metrics.averageResponseTime > 5000) {
          issues.push(`High response time: ${status.metrics.averageResponseTime}ms`);
        }

        results.push({ name, circuitBreaker: cb, issues });
      }
    }

    return results;
  }

  /**
   * Export registry state
   */
  exportState(): {
    globalConfig: CircuitBreakerConfig;
    circuitBreakers: Array<{
      name: string;
      config: CircuitBreakerConfig;
      state: CircuitBreakerState;
      metrics: any;
    }>;
    timestamp: Date;
  } {
    const circuitBreakers = Array.from(this.circuitBreakers.entries()).map(([name, cb]) => ({
      name,
      config: this.globalConfig,
      state: cb.getStatus().state,
      metrics: cb.getMetrics(),
    }));

    return {
      globalConfig: this.globalConfig,
      circuitBreakers,
      timestamp: new Date(),
    };
  }

  /**
   * Destroy all circuit breakers
   */
  destroy(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.destroy();
    }
    this.circuitBreakers.clear();

    logger.info('Circuit breaker registry destroyed');
  }
}
