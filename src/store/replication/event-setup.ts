/**
 * Event setup for session replication
 * @module store/replication/event-setup
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import type { Session } from '../../types/session.js';
import type { SessionReplicationManager } from './session-replication.js';
import { ReplicaManager } from './replica-manager.js';
import { SyncEngine } from './sync-engine.js';
import { ReplicationCoordinator } from './replication-coordinator.js';
import { ReplicationMetrics } from './replication-metrics.js';
import { ReplicationConfig } from './types.js';

export interface EventSetupConfig {
  manager: SessionReplicationManager;
  replicaManager: ReplicaManager;
  syncEngine: SyncEngine;
  coordinator: ReplicationCoordinator;
  metrics: ReplicationMetrics;
  config: ReplicationConfig;
}

/**
 * Sets up event handlers for replication system
 */
export function setupReplicationEventHandlers(setupConfig: EventSetupConfig): void {
  const { manager, replicaManager, syncEngine, coordinator, metrics, config } = setupConfig;
  // Forward events from components
  replicaManager.on('replica:connected', (id) => manager.emit('replica:connected', id));
  replicaManager.on('replica:disconnected', (id) => manager.emit('replica:disconnected', id));

  syncEngine.on('sync:started', () => manager.emit('sync:started'));
  syncEngine.on('sync:completed', (_replicaId, stats) => {
    metrics.recordSyncCompletion(stats);
    manager.emit('sync:completed', stats);
  });
  syncEngine.on('sync:failed', (_replicaId, error) => manager.emit('sync:failed', error));

  coordinator.on('replica:error', (id, error) => {
    replicaManager.recordSyncError(id, config.maxRetries);
    manager.emit('replica:error', id, error);
  });

  // Set up replication event handlers
  manager.on('session:created', (session: Session) => {
    void coordinator.replicateCreate(
      session,
      Array.from(replicaManager.getAllReplicas().map((r) => r.id)),
      (id) => replicaManager.getReplica(id),
    );
  });

  manager.on('session:updated', (session: Session) => {
    void coordinator.replicateUpdate(
      session,
      Array.from(replicaManager.getAllReplicas().map((r) => r.id)),
      (id) => replicaManager.getReplica(id),
    );
  });

  manager.on('session:deleted', (sessionId: string) => {
    void coordinator.replicateDelete(
      sessionId,
      Array.from(replicaManager.getAllReplicas().map((r) => r.id)),
      (id) => replicaManager.getReplica(id),
    );
  });

  manager.on('session:touched', (sessionId: string) => {
    void coordinator.replicateTouch(
      sessionId,
      Array.from(replicaManager.getAllReplicas().map((r) => r.id)),
      (id) => replicaManager.getReplica(id),
    );
  });
}
