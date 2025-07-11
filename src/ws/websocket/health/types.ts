/**
 * Health monitoring types and interfaces
 * @module ws/websocket/health/types
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 */

import type { pino } from 'pino';
import type { ConnectionManager } from '../connection-manager.js';
import type { SecurityManager } from '../security-manager.js';
import type { EventHandler } from '../event-handler.js';

/**
 * Health metrics
 */
export interface HealthMetrics {
  uptime: number;
  totalConnections: number;
  activeConnections: number;
  authenticatedConnections: number;
  totalSubscriptions: number;
  messagesProcessed: number;
  errorsCount: number;
  lastErrorTime?: number;
  memoryUsage: NodeJS.MemoryUsage;
  averageResponseTime: number;
  connectionTurnover: {
    connected: number;
    disconnected: number;
    period: number; // in minutes
  };
}

/**
 * Health status levels
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown',
} as const;

export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  metrics: HealthMetrics;
  issues: string[];
  recommendations: string[];
}

/**
 * Health check context
 */
export interface HealthCheckContext {
  connectionManager: ConnectionManager;
  securityManager: SecurityManager;
  eventHandler: EventHandler;
  logger: pino.Logger;
}

/**
 * Health check options
 */
export interface HealthCheckOptions {
  name: string;
  priority: number;
  enabled: boolean;
  thresholds?: Record<string, number>;
}

/**
 * Health event types
 */
export const HealthEventType = {
  STATUS_CHANGED: 'status_changed',
  METRIC_THRESHOLD_EXCEEDED: 'metric_threshold_exceeded',
  HEALTH_CHECK_FAILED: 'health_check_failed',
  RECOVERY_ACTION_TRIGGERED: 'recovery_action_triggered',
  RECOVERY_ACTION_COMPLETED: 'recovery_action_completed',
} as const;

export type HealthEventType = (typeof HealthEventType)[keyof typeof HealthEventType];

/**
 * Health event
 */
export interface HealthEvent {
  type: HealthEventType;
  timestamp: number;
  status?: HealthStatus;
  metrics?: Partial<HealthMetrics>;
  details?: Record<string, unknown>;
}

/**
 * Health observer interface
 */
export interface HealthObserver {
  onHealthEvent(event: HealthEvent): void;
}

/**
 * Recovery action result
 */
export interface RecoveryActionResult {
  success: boolean;
  message: string;
  actionsExecuted: string[];
}

/**
 * Health monitor options
 */
export interface HealthMonitorOptions {
  heartbeatInterval?: number;
  connectionTimeout?: number;
  maxStaleAge?: number;
}

/**
 * WebSocket component dependencies
 */
export interface WSComponentDependencies {
  logger: pino.Logger;
}
