/**
 * Configuration utilities for resource management
 * @module puppeteer/pool/resource-management/config-utils
 * @nist cm-7 "Least functionality"
 */

import type {
  ResourceMonitoringConfig,
  MemoryOptimizationOptions,
  CpuOptimizationOptions,
} from './resource-types.js';

/**
 * Default resource monitoring configuration
 */
export const DEFAULT_CONFIG: ResourceMonitoringConfig = {
  enabled: true,
  intervalMs: 10000,
  thresholds: {
    memoryWarning: 1024 * 1024 * 500,
    memoryCritical: 1024 * 1024 * 1000,
    cpuWarning: 70,
    cpuCritical: 90,
    connectionWarning: 100,
    connectionCritical: 200,
    handleWarning: 1000,
    handleCritical: 2000,
  },
  enableSystemMonitoring: true,
  enableBrowserMonitoring: true,
  enableGarbageCollection: true,
  gcTriggerThreshold: 80,
  enableMemoryOptimization: true,
  enableCpuOptimization: true,
};

/**
 * Default memory optimization options
 */
export const DEFAULT_MEMORY_OPTIMIZATION: MemoryOptimizationOptions = {
  enablePageMemoryReduction: true,
  enableImageOptimization: true,
  enableJavaScriptOptimization: true,
  enableCacheOptimization: true,
  maxPageMemoryMB: 100,
  maxBrowserMemoryMB: 500,
};

/**
 * Default CPU optimization options
 */
export const DEFAULT_CPU_OPTIMIZATION: CpuOptimizationOptions = {
  enableRequestThrottling: true,
  maxConcurrentRequests: 10,
  enableResourceBlocking: true,
  blockedResourceTypes: ['image', 'stylesheet', 'font', 'media'],
  enableAnimationDisabling: true,
  maxCpuUsagePercent: 80,
};

/**
 * Create resource monitoring configuration
 */
export function createResourceConfig(
  config: Partial<ResourceMonitoringConfig> = {}
): ResourceMonitoringConfig {
  return { ...DEFAULT_CONFIG, ...config };
}

/**
 * Create memory optimization configuration
 */
export function createMemoryConfig(
  config: Partial<MemoryOptimizationOptions> = {}
): MemoryOptimizationOptions {
  return { ...DEFAULT_MEMORY_OPTIMIZATION, ...config };
}

/**
 * Create CPU optimization configuration
 */
export function createCpuConfig(
  config: Partial<CpuOptimizationOptions> = {}
): CpuOptimizationOptions {
  return { ...DEFAULT_CPU_OPTIMIZATION, ...config };
}