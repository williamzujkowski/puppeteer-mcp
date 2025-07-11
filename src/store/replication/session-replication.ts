/**
 * Main session replication manager
 * @module store/replication/session-replication
 * @nist sc-28 "Protection of information at rest"
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist au-3 "Audit logging for replication operations"
 */

import type { SessionStore } from '../session-store.interface.js';
import {
  DEFAULT_REPLICATION_CONFIG,
  type ReplicationConfig,
  type SyncStats,
  type ReplicaHealthStatus,
  type HealthCheckResult,
} from './types.js';
import { pino } from 'pino';
import type { Logger } from 'pino';
import { EventEmitter } from 'events';
import { ReplicaManager } from './replica-manager.js';
import { ReplicationScheduler } from './replication-scheduler.js';
import { SyncEngine } from './sync-engine.js';
import { ReplicationCoordinator } from './replication-coordinator.js';
import { ReplicationTransport } from './replication-transport.js';
import { ReplicationMetrics } from './replication-metrics.js';
import { HealthChecker } from './health-checker.js';
import { setupReplicationEventHandlers } from './event-setup.js';
import { StatusManager } from './status-manager.js';
import type { SessionReplicationManagerEvents } from './session-replication.interface.js';

/**
 * Session replication manager
 */
export class SessionReplicationManager
  extends EventEmitter
  implements SessionReplicationManagerEvents
{
  private readonly logger: Logger;
  private readonly primaryStore: SessionStore;
  private readonly config: ReplicationConfig;
  private readonly replicaManager: ReplicaManager;
  private readonly scheduler: ReplicationScheduler;
  private readonly syncEngine: SyncEngine;
  private readonly coordinator: ReplicationCoordinator;
  private readonly transport: ReplicationTransport;
  private readonly metrics: ReplicationMetrics;
  private readonly healthChecker: HealthChecker;
  private readonly statusManager: StatusManager;

  constructor(
    primaryStore: SessionStore,
    config: Partial<ReplicationConfig> = {},
    logger?: Logger,
  ) {
    super();
    this.logger = logger ?? pino({ level: 'info' });
    this.primaryStore = primaryStore;

    this.config = {
      ...DEFAULT_REPLICATION_CONFIG,
      ...config,
    };

    // Initialize components
    this.replicaManager = new ReplicaManager(this.logger);
    this.scheduler = new ReplicationScheduler(this.logger);
    this.syncEngine = new SyncEngine(this.logger);
    this.coordinator = new ReplicationCoordinator(this.config, this.logger);
    this.transport = new ReplicationTransport(this.logger);
    this.metrics = new ReplicationMetrics(this.logger);
    this.healthChecker = new HealthChecker(this.logger);
    this.statusManager = new StatusManager(this.logger);

    // Set up event handlers
    setupReplicationEventHandlers({
      manager: this,
      replicaManager: this.replicaManager,
      syncEngine: this.syncEngine,
      coordinator: this.coordinator,
      metrics: this.metrics,
      config: this.config,
    });
  }

  /**
   * Add a replica store
   */
  async addReplica(
    id: string,
    store: SessionStore,
    config: Partial<ReplicationConfig> = {},
  ): Promise<void> {
    this.replicaManager.addReplica(id, store, config);

    // Initial sync
    await this.syncReplica(id);
  }

  /**
   * Remove a replica store
   */
  removeReplica(id: string): void {
    this.replicaManager.removeReplica(id);
  }

  /**
   * Start replication
   */
  start(): void {
    this.scheduler.start(this.config.syncInterval, async () => {
      await this.syncAll();
    });

    this.logger.info('Session replication started');
  }

  /**
   * Stop replication
   */
  stop(): void {
    this.scheduler.stop();
    this.logger.info('Session replication stopped');
  }

  /**
   * Sync all replicas
   */
  async syncAll(): Promise<void> {
    const replicas = this.replicaManager.getActiveReplicas();
    const primarySessions = await this.transport.getAllSessions(this.primaryStore);

    await this.syncEngine.syncAllReplicas(replicas, primarySessions, this.config);
  }

  /**
   * Sync a specific replica
   */
  async syncReplica(replicaId: string): Promise<SyncStats> {
    const replica = this.replicaManager.getReplica(replicaId);
    if (!replica) {
      throw new Error(`Replica with id ${replicaId} not found`);
    }

    const primarySessions = await this.transport.getAllSessions(this.primaryStore);
    const stats = await this.syncEngine.syncReplica(replica, primarySessions, this.config);

    this.replicaManager.recordSyncCompletion(replicaId);

    return stats;
  }

  /**
   * Get replication status
   */
  getStatus(): ReturnType<StatusManager['getStatus']> {
    return this.statusManager.getStatus(this.scheduler, this.config, this.replicaManager);
  }

  /**
   * Get health status of all replicas
   */
  async getHealth(): Promise<{
    primary: HealthCheckResult;
    replicas: ReplicaHealthStatus[];
  }> {
    return this.healthChecker.getHealth(this.primaryStore, this.replicaManager);
  }

  /**
   * Force sync all replicas
   */
  async forceSyncAll(): Promise<SyncStats[]> {
    return this.statusManager.forceSyncAll(this.replicaManager, (id) => this.syncReplica(id));
  }

  /**
   * Get replication metrics
   */
  getMetrics(): ReturnType<ReplicationMetrics['exportMetrics']> {
    return this.statusManager.getMetrics(this.coordinator);
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.stop();
    this.removeAllListeners();
    this.replicaManager.clear();
    this.coordinator.clearMetrics();
    this.logger.info('Session replication manager destroyed');
  }
}
