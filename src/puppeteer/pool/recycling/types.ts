/**
 * Shared types and interfaces for browser recycling
 * @module puppeteer/pool/recycling/types
 * @nist ac-12 "Session termination"
 * @nist si-4 "Information system monitoring"
 */

import type { InternalBrowserInstance } from '../browser-pool-maintenance.js';

/**
 * Recycling strategy
 */
export enum RecyclingStrategy {
  TIME_BASED = 'time_based',
  USAGE_BASED = 'usage_based',
  HEALTH_BASED = 'health_based',
  RESOURCE_BASED = 'resource_based',
  HYBRID = 'hybrid',
}

/**
 * Recycling reason
 */
export enum RecyclingReason {
  MAX_LIFETIME = 'max_lifetime',
  MAX_USAGE = 'max_usage',
  HEALTH_DEGRADATION = 'health_degradation',
  MEMORY_PRESSURE = 'memory_pressure',
  CPU_PRESSURE = 'cpu_pressure',
  CONNECTION_OVERLOAD = 'connection_overload',
  ERROR_THRESHOLD = 'error_threshold',
  MANUAL_TRIGGER = 'manual_trigger',
  SCHEDULED_MAINTENANCE = 'scheduled_maintenance',
}

/**
 * Recycling configuration
 */
export interface RecyclingConfig {
  enabled: boolean;
  strategy: RecyclingStrategy;
  
  // Time-based settings
  maxLifetimeMs: number;
  maxIdleTimeMs: number;
  
  // Usage-based settings
  maxUseCount: number;
  maxPageCount: number;
  
  // Health-based settings
  healthCheckInterval: number;
  healthThreshold: number;
  consecutiveFailuresLimit: number;
  
  // Resource-based settings
  maxMemoryUsageMB: number;
  maxCpuUsagePercent: number;
  maxConnectionCount: number;
  maxHandleCount: number;
  
  // Hybrid settings
  weightTimeBasedScore: number;
  weightUsageBasedScore: number;
  weightHealthBasedScore: number;
  weightResourceBasedScore: number;
  
  // Recycling behavior
  recyclingThreshold: number;
  batchRecyclingEnabled: boolean;
  maxBatchSize: number;
  recyclingCooldownMs: number;
  
  // Maintenance settings
  scheduledMaintenanceEnabled: boolean;
  maintenanceInterval: number;
  maintenanceWindowStart: number; // Hour of day (0-23)
  maintenanceWindowEnd: number; // Hour of day (0-23)
}

/**
 * Browser health metrics
 */
export interface BrowserHealthMetrics {
  browserId: string;
  overallHealth: number; // 0-100
  responsiveness: number; // 0-100
  stability: number; // 0-100
  performance: number; // 0-100
  lastHealthCheck: Date;
  consecutiveFailures: number;
  totalHealthChecks: number;
  failureRate: number;
  avgResponseTime: number;
  errorCount: number;
  warningCount: number;
}

/**
 * Recycling candidate
 */
export interface RecyclingCandidate {
  browserId: string;
  instance: InternalBrowserInstance;
  score: number;
  reasons: RecyclingReason[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: 'minimal' | 'moderate' | 'significant' | 'severe';
  recommendedAction: 'recycle' | 'monitor' | 'optimize';
  metrics: CandidateMetrics;
}

/**
 * Candidate metrics
 */
export interface CandidateMetrics {
  ageMs: number;
  useCount: number;
  pageCount: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  healthScore: number;
  errorRate: number;
}

/**
 * Recycling event
 */
export interface RecyclingEvent {
  browserId: string;
  reason: RecyclingReason;
  strategy: RecyclingStrategy;
  score: number;
  timestamp: Date;
  success: boolean;
  executionTimeMs: number;
  replacementBrowserId?: string;
}

/**
 * Recycling statistics
 */
export interface RecyclingStats {
  totalRecycled: number;
  successRate: number;
  avgExecutionTime: number;
  reasonBreakdown: Record<RecyclingReason, number>;
  recentEvents: RecyclingEvent[];
}

/**
 * Default recycling configuration
 */
// @ts-expect-error - RecyclingReason enum is used in type definition
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _RecyclingReasonCheck = RecyclingReason;

export const DEFAULT_RECYCLING_CONFIG: RecyclingConfig = {
  enabled: true,
  strategy: RecyclingStrategy.HYBRID,
  maxLifetimeMs: 2 * 60 * 60 * 1000, // 2 hours
  maxIdleTimeMs: 30 * 60 * 1000, // 30 minutes
  maxUseCount: 100,
  maxPageCount: 50,
  healthCheckInterval: 60000,
  healthThreshold: 70,
  consecutiveFailuresLimit: 3,
  maxMemoryUsageMB: 500,
  maxCpuUsagePercent: 80,
  maxConnectionCount: 100,
  maxHandleCount: 1000,
  weightTimeBasedScore: 0.25,
  weightUsageBasedScore: 0.25,
  weightHealthBasedScore: 0.30,
  weightResourceBasedScore: 0.20,
  recyclingThreshold: 80,
  batchRecyclingEnabled: true,
  maxBatchSize: 3,
  recyclingCooldownMs: 300000,
  scheduledMaintenanceEnabled: true,
  maintenanceInterval: 6 * 60 * 60 * 1000,
  maintenanceWindowStart: 2,
  maintenanceWindowEnd: 4,
};