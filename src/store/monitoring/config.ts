/**
 * Default monitoring configuration
 * @module store/monitoring/config
 */

import type { MonitoringConfig } from './types.js';

/**
 * Get default monitoring configuration
 */
export function getDefaultConfig(): MonitoringConfig {
  return {
    healthCheckInterval: 30000, // 30 seconds
    metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
    alertThresholds: {
      maxLatency: 1000, // 1 second
      maxErrorRate: 0.05, // 5%
      maxFallbackTime: 300000, // 5 minutes
      minAvailability: 0.99 // 99%
    },
    enableDetailedMetrics: true,
    enableAlerting: true
  };
}

/**
 * Merge configuration with defaults
 */
export function mergeConfig(config: Partial<MonitoringConfig>): MonitoringConfig {
  return {
    ...getDefaultConfig(),
    ...config
  };
}