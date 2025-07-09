/**
 * Optimization configuration types and defaults
 * @module puppeteer/pool/optimization-config
 * @nist cm-7 "Least functionality"
 */

import type { ScalingStrategy } from './browser-pool-scaling.js';
import type { ResourceMonitoringConfig } from './browser-pool-resource-manager.js';
import type { RecyclingConfig } from './browser-pool-recycler.js';
import type { CircuitBreakerConfig } from './browser-pool-circuit-breaker.js';
import type { PerformanceMonitoringConfig } from './browser-pool-performance-monitor.js';
import {
  DEFAULT_SCALING_STRATEGY,
  DEFAULT_RESOURCE_CONFIG,
  DEFAULT_RECYCLING_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
} from './browser-pool-defaults.js';

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  /** Enable optimization features */
  enabled: boolean;
  /** Scaling configuration */
  scaling: Partial<ScalingStrategy>;
  /** Resource monitoring configuration */
  resourceMonitoring: Partial<ResourceMonitoringConfig>;
  /** Recycling configuration */
  recycling: Partial<RecyclingConfig>;
  /** Circuit breaker configuration */
  circuitBreaker: Partial<CircuitBreakerConfig>;
  /** Performance monitoring configuration */
  performanceMonitoring: Partial<PerformanceMonitoringConfig>;
  /** Enable automatic optimization */
  autoOptimization: boolean;
  /** Optimization check interval (ms) */
  optimizationInterval: number;
}

/**
 * Optimization status
 */
export interface OptimizationStatus {
  enabled: boolean;
  scalingActive: boolean;
  resourceMonitoringActive: boolean;
  recyclingActive: boolean;
  circuitBreakerActive: boolean;
  performanceMonitoringActive: boolean;
  autoOptimizationActive: boolean;
  lastOptimizationCheck: Date;
  optimizationActions: number;
  overallHealth: number;
  recommendations: Array<{
    type: string;
    priority: string;
    description: string;
    timestamp: Date;
  }>;
}

/**
 * Default optimization configuration
 */
export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  enabled: true,
  scaling: DEFAULT_SCALING_STRATEGY,
  resourceMonitoring: DEFAULT_RESOURCE_CONFIG,
  recycling: DEFAULT_RECYCLING_CONFIG,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  performanceMonitoring: DEFAULT_PERFORMANCE_CONFIG,
  autoOptimization: true,
  optimizationInterval: 30000,
};

/**
 * Merge optimization configuration with defaults
 */
export function mergeOptimizationConfig(
  config: Partial<OptimizationConfig> = {}
): OptimizationConfig {
  return {
    ...DEFAULT_OPTIMIZATION_CONFIG,
    ...config,
    scaling: { ...DEFAULT_SCALING_STRATEGY, ...config.scaling },
    resourceMonitoring: { ...DEFAULT_RESOURCE_CONFIG, ...config.resourceMonitoring },
    recycling: { ...DEFAULT_RECYCLING_CONFIG, ...config.recycling },
    circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config.circuitBreaker },
    performanceMonitoring: { ...DEFAULT_PERFORMANCE_CONFIG, ...config.performanceMonitoring },
  };
}

/**
 * Update optimization configuration with new values
 */
export function updateOptimizationConfig(
  currentConfig: OptimizationConfig,
  newConfig: Partial<OptimizationConfig>
): OptimizationConfig {
  return mergeOptimizationConfig({ ...currentConfig, ...newConfig });
}