/**
 * Browser pool module exports
 * @module puppeteer/pool
 */

// Core browser pool exports
export { BrowserPool } from './browser-pool.js';
export { OptimizedBrowserPool } from './browser-pool-optimized.js';

// Optimization component exports
export { BrowserPoolScaling, DEFAULT_SCALING_STRATEGY } from './browser-pool-scaling.js';
export type { ScalingDecision } from './browser-pool-scaling.js';
export { BrowserPoolResourceManager, DEFAULT_RESOURCE_CONFIG } from './browser-pool-resource-manager.js';
export { BrowserPoolRecycler, RecyclingStrategy, DEFAULT_RECYCLING_CONFIG } from './browser-pool-recycler.js';
export { CircuitBreaker, CircuitBreakerRegistry, CircuitBreakerState, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './browser-pool-circuit-breaker.js';
export { BrowserPoolPerformanceMonitor, DEFAULT_PERFORMANCE_CONFIG } from './browser-pool-performance-monitor.js';
export type { PerformanceMetricType } from './browser-pool-performance-monitor.js';

// Compatibility exports
export { BrowserPoolFactory, MigrationUtils } from './browser-pool-compatibility.js';
export { LegacyBrowserPool, EnhancedBrowserPool } from './browser-pool-compatibility.js';

// Configuration exports
export { DEFAULT_OPTIMIZATION_CONFIG } from './browser-pool-optimized.js';
export { DEFAULT_OPTIONS } from './browser-pool-config.js';

// Metrics exports
export { BrowserPoolMetrics, getPoolMetrics } from './browser-pool-metrics.js';
export type { ExtendedPoolMetrics } from './browser-pool-metrics.js';

// Health monitoring exports
export { BrowserHealthMonitor, checkBrowserHealth } from './browser-health.js';
export type { HealthCheckResult } from './browser-health.js';

// Interface exports
export type { BrowserInstance, BrowserPoolOptions, PoolMetrics } from '../interfaces/browser-pool.interface.js';

// Type exports for optimization
export type { BrowserPoolScalingStrategy } from './browser-pool-scaling.js';
export type { ResourceMonitoringConfig, ResourceThresholds } from './browser-pool-resource-manager.js';
export type { RecyclingConfig } from './browser-pool-recycler.js';
export type { CircuitBreakerConfig } from './browser-pool-circuit-breaker.js';
export type { PerformanceMonitoringConfig } from './browser-pool-performance-monitor.js';
export type { OptimizationConfig } from './browser-pool-optimized.js';
export type { CompatibilityConfig } from './browser-pool-compatibility.js';

// Default export for backward compatibility
export { BrowserPoolFactory as default } from './browser-pool-compatibility.js';