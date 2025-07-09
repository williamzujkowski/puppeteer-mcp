/**
 * Session replication exports
 * @module store/replication
 */

export { SessionReplicationManager } from './session-replication.js';
export { ConflictResolver } from './conflict-resolver.js';
export { ReplicaManager } from './replica-manager.js';
export { ReplicationCoordinator } from './replication-coordinator.js';
export { ReplicationMetrics } from './replication-metrics.js';
export { ReplicationScheduler } from './replication-scheduler.js';
export { ReplicationTransport } from './replication-transport.js';
export { SyncEngine } from './sync-engine.js';
export { HealthChecker } from './health-checker.js';
export { StatusManager } from './status-manager.js';
export { setupReplicationEventHandlers } from './event-setup.js';

export {
  DEFAULT_REPLICATION_CONFIG,
  type ReplicationConfig,
  type ReplicationEvents,
  type ReplicationOperation,
  type ReplicationMetricsData,
  type ReplicaInfo,
  type ReplicaHealthStatus,
  type SyncStats,
  type SyncBatchResult,
  type HealthCheckResult
} from './types.js';

export type { SessionReplicationManagerEvents } from './session-replication.interface.js';