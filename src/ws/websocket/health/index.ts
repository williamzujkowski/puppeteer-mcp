/**
 * Health monitoring module
 * @module ws/websocket/health
 * @nist au-3 "Content of audit records"
 * @nist cm-7 "Least functionality"
 * @nist si-4 "System monitoring"
 * @nist ir-4 "Incident handling"
 */

// Main coordinator
export { HealthMonitorCoordinator } from './health-monitor-coordinator.js';

// Types
export type {
  HealthMetrics,
  HealthCheckResult,
  HealthCheckContext,
  HealthEvent,
  HealthObserver,
  RecoveryActionResult,
  HealthMonitorOptions,
  WSComponentDependencies,
} from './types.js';

export { HealthStatus, HealthEventType } from './types.js';

// Strategy management
export { StrategyManager } from './strategy-manager.js';
export { 
  HealthCheckStrategy, 
  type HealthCheckStrategyResult,
  type HealthCheckIssue,
} from './strategies/index.js';

// Event management
export { HealthEventManager } from './health-event-manager.js';

// Metrics collection
export { MetricsCollector } from './metrics-collector.js';

// Recovery actions
export { 
  RecoveryAction, 
  type RecoveryContext,
  CleanupRecoveryAction,
  ConnectionLimitRecoveryAction,
} from './recovery/index.js';