/**
 * Shared types and interfaces for session monitoring
 * @module store/monitoring/types
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 */

import type { SessionData } from '../../types/session.js';

/**
 * Performance metrics for session operations
 */
export interface SessionMetrics {
  operations: {
    create: OperationMetrics;
    get: GetOperationMetrics;
    update: OperationMetrics;
    delete: OperationMetrics;
    touch: OperationMetrics;
  };
  store: StoreMetrics;
  redis?: RedisMetrics;
  fallback: FallbackMetrics;
}

/**
 * Base operation metrics
 */
export interface OperationMetrics {
  count: number;
  avgLatency: number;
  errors: number;
}

/**
 * Get operation metrics with cache tracking
 */
export interface GetOperationMetrics extends OperationMetrics {
  cacheMisses: number;
}

/**
 * Store metrics
 */
export interface StoreMetrics {
  type: string;
  available: boolean;
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
}

/**
 * Redis-specific metrics
 */
export interface RedisMetrics {
  available: boolean;
  latency?: number;
  memoryUsage?: number;
  keyCount?: number;
  connections?: number;
}

/**
 * Fallback store metrics
 */
export interface FallbackMetrics {
  activations: number;
  lastActivation?: Date;
  totalFallbackTime: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: HealthChecks;
  metrics: SessionMetrics;
  alerts: Alert[];
}

/**
 * Individual health check results
 */
export interface HealthChecks {
  redis: ComponentHealth;
  sessionStore: ComponentHealth;
  fallback: ComponentHealth;
}

/**
 * Component health status
 */
export interface ComponentHealth {
  available: boolean;
  latency?: number;
  error?: string;
}

/**
 * Alert structure
 */
export interface Alert {
  level: 'warning' | 'critical';
  message: string;
  timestamp: Date;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  healthCheckInterval: number;
  metricsRetentionPeriod: number;
  alertThresholds: AlertThresholds;
  enableDetailedMetrics: boolean;
  enableAlerting: boolean;
}

/**
 * Alert threshold configuration
 */
export interface AlertThresholds {
  maxLatency: number;
  maxErrorRate: number;
  maxFallbackTime: number;
  minAvailability: number;
}

/**
 * Metrics history entry
 */
export interface MetricsHistoryEntry {
  timestamp: Date;
  metrics: SessionMetrics;
}

/**
 * Alert history entry
 */
export interface AlertHistoryEntry {
  timestamp: Date;
  level: string;
  message: string;
}

/**
 * Operation recording parameters
 */
export interface OperationRecord {
  operation: keyof SessionMetrics['operations'];
  latency: number;
  success: boolean;
  cacheMiss?: boolean;
}

/**
 * Uptime statistics
 */
export interface UptimeStats {
  startTime: Date;
  uptime: number;
  availability: number;
}

/**
 * Monitoring status
 */
export interface MonitoringStatus {
  isRunning: boolean;
  config: MonitoringConfig;
  uptime: number;
  metricsCount: number;
  alertCount: number;
}

/**
 * Exported metrics format
 */
export interface ExportedMetrics {
  prometheus?: string;
  json: SessionMetrics;
}

/**
 * Test session data for health checks
 */
export interface TestSessionData extends SessionData {
  userId: string;
  username: string;
  roles: string[];
  createdAt: string;
  expiresAt: string;
}
