/**
 * Resource management type definitions
 * @module puppeteer/pool/resource-management/resource-types
 * @nist si-4 "Information system monitoring"
 */

/**
 * System resource information
 */
export interface SystemResources {
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  availableCpuCores: number;
  loadAverage: number[];
  uptime: number;
  processCount: number;
}

/**
 * Browser resource usage
 */
export interface BrowserResourceUsage {
  browserId: string;
  pid: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
    percent: number;
  };
  openHandles: number;
  threadCount: number;
  connectionCount: number;
  timestamp: Date;
}

/**
 * Resource monitoring thresholds
 */
export interface ResourceThresholds {
  memoryWarning: number;
  memoryCritical: number;
  cpuWarning: number;
  cpuCritical: number;
  connectionWarning: number;
  connectionCritical: number;
  handleWarning: number;
  handleCritical: number;
}

/**
 * Resource monitoring configuration
 */
export interface ResourceMonitoringConfig {
  enabled: boolean;
  intervalMs: number;
  thresholds: ResourceThresholds;
  enableSystemMonitoring: boolean;
  enableBrowserMonitoring: boolean;
  enableGarbageCollection: boolean;
  gcTriggerThreshold: number;
  enableMemoryOptimization: boolean;
  enableCpuOptimization: boolean;
}

/**
 * Resource alert
 */
export interface ResourceAlert {
  type: 'memory' | 'cpu' | 'connection' | 'handle' | 'system';
  level: 'warning' | 'critical';
  message: string;
  browserId?: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  impact: 'low' | 'medium' | 'high';
  suggestedAction: string;
}

/**
 * Memory optimization options
 */
export interface MemoryOptimizationOptions {
  enablePageMemoryReduction: boolean;
  enableImageOptimization: boolean;
  enableJavaScriptOptimization: boolean;
  enableCacheOptimization: boolean;
  maxPageMemoryMB: number;
  maxBrowserMemoryMB: number;
}

/**
 * CPU optimization options
 */
export interface CpuOptimizationOptions {
  enableRequestThrottling: boolean;
  maxConcurrentRequests: number;
  enableResourceBlocking: boolean;
  blockedResourceTypes: string[];
  enableAnimationDisabling: boolean;
  maxCpuUsagePercent: number;
}

/**
 * Default resource monitoring configuration
 */
export const DEFAULT_RESOURCE_CONFIG: ResourceMonitoringConfig = {
  enabled: true,
  intervalMs: 10000,
  thresholds: {
    memoryWarning: 1024 * 1024 * 500, // 500MB
    memoryCritical: 1024 * 1024 * 1000, // 1GB
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