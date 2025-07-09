/**
 * Types and interfaces for browser pool compatibility
 * @module puppeteer/pool/compatibility/types
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */

import type { OptimizationConfig } from '../browser-pool-optimized.js';
import { RecyclingStrategy } from '../browser-pool-recycler.js';

/**
 * Compatibility configuration
 */
export interface CompatibilityConfig {
  /** Enable optimization features */
  enableOptimization: boolean;
  /** Use legacy behavior for specific operations */
  useLegacyBehavior: boolean;
  /** Migration mode for gradual adoption */
  migrationMode: boolean;
  /** Fallback to legacy on optimization errors */
  fallbackToLegacy: boolean;
  /** Log compatibility warnings */
  logWarnings: boolean;
  /** Optimization configuration (when enabled) */
  optimization?: Partial<OptimizationConfig>;
}

/**
 * Migration metrics for tracking compatibility performance
 */
export interface MigrationMetrics {
  optimizedCalls: number;
  legacyFallbacks: number;
  errors: number;
}

/**
 * Extended migration metrics with calculated rates
 */
export interface ExtendedMigrationMetrics extends MigrationMetrics {
  optimizedSuccessRate: number;
  fallbackRate: number;
}

/**
 * Current usage statistics for migration analysis
 */
export interface UsageStatistics {
  averagePoolSize: number;
  peakPoolSize: number;
  errorRate: number;
  resourceUsage: number;
}

/**
 * Migration risk levels
 */
export type MigrationRisk = 'low' | 'medium' | 'high';

/**
 * Compatibility analysis result
 */
export interface CompatibilityAnalysis {
  recommendOptimization: boolean;
  suggestedConfig: Partial<OptimizationConfig>;
  migrationRisk: MigrationRisk;
  recommendations: string[];
}

/**
 * Migration phase configuration
 */
export interface MigrationPhase {
  phase: number;
  name: string;
  duration: string;
  config: Partial<OptimizationConfig>;
  rollbackPlan: string;
  successCriteria: string[];
}

/**
 * Complete migration plan
 */
export interface MigrationPlan {
  phases: MigrationPhase[];
  totalDuration: string;
  riskMitigation: string[];
}

/**
 * Version compatibility information
 */
export interface VersionCompatibility {
  version: string;
  isCompatible: boolean;
  requiredMigrations: string[];
  deprecatedFeatures: string[];
}

/**
 * Compatibility check result
 */
export interface CompatibilityCheckResult {
  isCompatible: boolean;
  issues: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Default compatibility configuration
 */
export const DEFAULT_COMPATIBILITY_CONFIG: CompatibilityConfig = {
  enableOptimization: false,
  useLegacyBehavior: false,
  migrationMode: false,
  fallbackToLegacy: true,
  logWarnings: true,
  optimization: {
    enabled: true,
    autoOptimization: false,
    optimizationInterval: 60000,
    scaling: { enabled: false },
    resourceMonitoring: { enabled: false },
    recycling: { enabled: false },
    circuitBreaker: { enabled: false },
    performanceMonitoring: { enabled: false },
  },
};

/**
 * Default recycling configuration for migration
 */
export const DEFAULT_RECYCLING_CONFIG = {
  enabled: true,
  strategy: RecyclingStrategy.HYBRID,
  maxLifetimeMs: 3600000,
  maxIdleTimeMs: 600000,
  maxUseCount: 1000,
  maxPageCount: 100,
  healthCheckInterval: 30000,
  healthThreshold: 0.7,
  consecutiveFailuresLimit: 3,
  maxMemoryUsageMB: 500,
  maxCpuUsagePercent: 80,
  maxConnectionCount: 50,
  maxHandleCount: 1000,
  weightTimeBasedScore: 0.25,
  weightUsageBasedScore: 0.25,
  weightHealthBasedScore: 0.25,
  weightResourceBasedScore: 0.25,
  recyclingThreshold: 0.8,
  batchRecyclingEnabled: true,
  maxBatchSize: 5,
  recyclingCooldownMs: 5000,
  scheduledMaintenanceEnabled: false,
  maintenanceInterval: 86400000,
  maintenanceWindowStart: 2,
  maintenanceWindowEnd: 6,
  gracefulShutdownEnabled: true,
  gracefulShutdownTimeoutMs: 30000,
  preRecyclingWarmupEnabled: true,
  warmupPoolSize: 2,
};
