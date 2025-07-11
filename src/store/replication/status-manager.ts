/**
 * Status management for replication system
 * @module store/replication/status-manager
 * @nist au-3 "Audit logging for replication operations"
 */

import type { ReplicationConfig, SyncStats } from './types.js';
import type { Logger } from 'pino';
import { ReplicaManager } from './replica-manager.js';
import { ReplicationScheduler } from './replication-scheduler.js';
import { ReplicationCoordinator } from './replication-coordinator.js';
import { ReplicationMetrics } from './replication-metrics.js';

/**
 * Manages replication status and metrics
 */
export class StatusManager {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Get replication status
   */
  getStatus(
    scheduler: ReplicationScheduler,
    config: ReplicationConfig,
    replicaManager: ReplicaManager,
  ): {
    isRunning: boolean;
    config: ReplicationConfig;
    replicas: Array<{
      id: string;
      isActive: boolean;
      lastSync: Date | null;
      syncErrors: number;
    }>;
  } {
    const schedulerStatus = scheduler.getStatus();

    return {
      isRunning: schedulerStatus.isRunning,
      config,
      replicas: replicaManager.getAllReplicas().map((replica) => ({
        id: replica.id,
        isActive: replica.isActive,
        lastSync: replica.lastSync,
        syncErrors: replica.syncErrors,
      })),
    };
  }

  /**
   * Force sync all replicas
   */
  async forceSyncAll(
    replicaManager: ReplicaManager,
    syncReplica: (id: string) => Promise<SyncStats>,
  ): Promise<SyncStats[]> {
    const replicaIds = replicaManager.getAllReplicas().map((r) => r.id);

    this.logger.info({ replicaCount: replicaIds.length }, 'Starting forced sync for all replicas');

    return Promise.all(replicaIds.map((id) => syncReplica(id)));
  }

  /**
   * Get replication metrics
   */
  getMetrics(coordinator: ReplicationCoordinator): ReturnType<ReplicationMetrics['exportMetrics']> {
    return coordinator.getMetrics();
  }
}
