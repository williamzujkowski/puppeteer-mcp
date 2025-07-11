/**
 * Registry utilities and helpers
 * @module puppeteer/pool/circuit-breaker/registry-utils
 * @nist si-4 "Information system monitoring"
 */

import { CircuitBreaker } from './circuit-breaker-core.js';
import { CircuitBreakerState, CircuitBreakerConfig } from './types.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('circuit-breaker-registry-utils');

/**
 * Registry export data structure
 */
export interface RegistryExportData {
  globalConfig: CircuitBreakerConfig;
  circuitBreakers: Array<{
    name: string;
    config: any;
    state: CircuitBreakerState;
    metrics: any;
  }>;
  timestamp: Date;
}

/**
 * Find circuit breakers by state
 */
export function findByState(
  circuitBreakers: Map<string, CircuitBreaker>,
  state: CircuitBreakerState,
): Array<{ name: string; circuitBreaker: CircuitBreaker }> {
  const results: Array<{ name: string; circuitBreaker: CircuitBreaker }> = [];

  for (const [name, cb] of circuitBreakers) {
    if (cb.getStatus().state === state) {
      results.push({ name, circuitBreaker: cb });
    }
  }

  return results;
}

/**
 * Find unhealthy circuit breakers
 */
export function findUnhealthy(
  circuitBreakers: Map<string, CircuitBreaker>,
): Array<{ name: string; circuitBreaker: CircuitBreaker; issues: string[] }> {
  const results: Array<{ name: string; circuitBreaker: CircuitBreaker; issues: string[] }> = [];

  for (const [name, cb] of circuitBreakers) {
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
 * Calculate aggregated metrics
 */
export function calculateAggregatedMetrics(circuitBreakers: Map<string, CircuitBreaker>): {
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

  for (const [name, cb] of circuitBreakers) {
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
 * Export registry state
 */
export function exportRegistryState(
  circuitBreakers: Map<string, CircuitBreaker>,
  globalConfig: CircuitBreakerConfig,
): RegistryExportData {
  const circuitBreakerData = Array.from(circuitBreakers.entries()).map(([name, cb]) => ({
    name,
    config: cb.getStatus().metrics,
    state: cb.getStatus().state,
    metrics: cb.getMetrics(),
  }));

  return {
    globalConfig,
    circuitBreakers: circuitBreakerData,
    timestamp: new Date(),
  };
}

/**
 * Apply configuration to all circuit breakers
 */
export function applyConfigToAll(
  circuitBreakers: Map<string, CircuitBreaker>,
  config: Partial<CircuitBreakerConfig>,
): void {
  for (const circuitBreaker of circuitBreakers.values()) {
    circuitBreaker.updateConfig(config);
  }

  logger.info(
    {
      config,
      appliedTo: circuitBreakers.size,
    },
    'Configuration applied to all circuit breakers',
  );
}

/**
 * Reset all circuit breakers
 */
export function resetAll(circuitBreakers: Map<string, CircuitBreaker>): void {
  for (const circuitBreaker of circuitBreakers.values()) {
    circuitBreaker.reset();
  }

  logger.info(
    {
      resetCount: circuitBreakers.size,
    },
    'All circuit breakers reset',
  );
}

/**
 * Evict circuit breaker based on eviction policy
 */
export function evictCircuitBreaker(
  circuitBreakers: Map<string, CircuitBreaker>,
  removeCallback: (name: string) => boolean,
): string | null {
  // First try to evict closed and healthy circuit breakers
  for (const [name, cb] of circuitBreakers) {
    const status = cb.getStatus();
    if (status.state === CircuitBreakerState.CLOSED && status.healthy) {
      removeCallback(name);
      logger.info({ evictedName: name }, 'Circuit breaker evicted due to capacity limit');
      return name;
    }
  }

  // If no healthy closed circuit breakers, evict the oldest one
  const oldestName = circuitBreakers.keys().next().value;
  if (oldestName) {
    removeCallback(oldestName);
    logger.info(
      { evictedName: oldestName },
      'Oldest circuit breaker evicted due to capacity limit',
    );
    return oldestName;
  }

  return null;
}

/**
 * Setup event forwarding for metrics aggregation
 */
export function setupEventForwarding(name: string, circuitBreaker: CircuitBreaker): void {
  circuitBreaker.on('circuit-breaker-event', (event) => {
    logger.debug(
      {
        circuitBreaker: name,
        eventType: event.type,
        state: event.state,
      },
      'Circuit breaker event received',
    );
  });

  circuitBreaker.on('performance-warning', (warning) => {
    logger.warn(
      {
        circuitBreaker: name,
        warning,
      },
      'Circuit breaker performance warning',
    );
  });
}
