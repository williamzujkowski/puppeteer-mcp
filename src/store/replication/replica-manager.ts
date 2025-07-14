/**
 * Replica management for session replication
 * @module store/replication/replica-manager
 * @nist sc-28 "Protection of information at rest"
 */

import type { SessionStore } from '../session-store.interface.js';
import type {
  ReplicaInfo,
  ReplicationConfig,
  HealthCheckResult,
  ReplicaHealthStatus,
} from './types.js';
import type { SessionData } from '../../types/session.js';
import type { Logger } from 'pino';
import { EventEmitter } from 'events';

/**
 * Manages replica stores and their lifecycle
 */
export class ReplicaManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly replicas: Map<string, ReplicaInfo> = new Map();

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Add a replica store
   */
  addReplica(id: string, store: SessionStore, config: Partial<ReplicationConfig> = {}): void {
    if (this.replicas.has(id)) {
      throw new Error(`Replica with id ${id} already exists`);
    }

    const replicaInfo: ReplicaInfo = {
      id,
      store,
      isActive: true,
      lastSync: null,
      syncErrors: 0,
      config,
    };

    this.replicas.set(id, replicaInfo);
    this.emit('replica:connected', id);

    this.logger.info({ replicaId: id }, 'Replica added');
  }

  /**
   * Remove a replica store
   */
  removeReplica(id: string): void {
    const replica = this.replicas.get(id);
    if (!replica) {
      throw new Error(`Replica with id ${id} not found`);
    }

    this.replicas.delete(id);
    this.emit('replica:disconnected', id);

    this.logger.info({ replicaId: id }, 'Replica removed');
  }

  /**
   * Get replica by ID
   */
  getReplica(id: string): ReplicaInfo | undefined {
    return this.replicas.get(id);
  }

  /**
   * Get all replicas
   */
  getAllReplicas(): ReplicaInfo[] {
    return Array.from(this.replicas.values());
  }

  /**
   * Get active replicas
   */
  getActiveReplicas(): ReplicaInfo[] {
    return Array.from(this.replicas.values()).filter((r) => r.isActive);
  }

  /**
   * Update replica status
   */
  updateReplicaStatus(id: string, updates: Partial<ReplicaInfo>): void {
    const replica = this.replicas.get(id);
    if (!replica) {
      throw new Error(`Replica with id ${id} not found`);
    }

    Object.assign(replica, updates);
    this.logger.debug({ replicaId: id, updates }, 'Replica status updated');
  }

  /**
   * Mark replica as active
   */
  activateReplica(id: string): void {
    this.updateReplicaStatus(id, { isActive: true, syncErrors: 0 });
    this.emit('replica:activated', id);
  }

  /**
   * Mark replica as inactive
   */
  deactivateReplica(id: string): void {
    this.updateReplicaStatus(id, { isActive: false });
    this.emit('replica:deactivated', id);
  }

  /**
   * Record sync completion
   */
  recordSyncCompletion(id: string): void {
    this.updateReplicaStatus(id, {
      lastSync: new Date(),
      syncErrors: 0,
      isActive: true,
    });
  }

  /**
   * Record sync error
   */
  recordSyncError(id: string, maxRetries: number): void {
    const replica = this.replicas.get(id);
    if (!replica) {
      return;
    }

    replica.syncErrors++;

    if (replica.syncErrors >= maxRetries) {
      replica.isActive = false;
      this.emit('replica:failed', id);
    }

    this.logger.warn(
      { replicaId: id, syncErrors: replica.syncErrors, maxRetries },
      'Replica sync error recorded',
    );
  }

  /**
   * Check health of a single replica
   */
  async checkReplicaHealth(replica: ReplicaInfo): Promise<HealthCheckResult> {
    try {
      const testSessionData: SessionData = {
        userId: 'health-check',
        username: 'health-check',
        roles: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      };

      const testId = await replica.store.create(testSessionData);
      await replica.store.delete(testId);

      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get health status of all replicas
   */
  async getAllReplicasHealth(): Promise<ReplicaHealthStatus[]> {
    const healthChecks = await Promise.all(
      Array.from(this.replicas.values()).map(async (replica) => {
        const health = await this.checkReplicaHealth(replica);

        return {
          id: replica.id,
          available: health.available,
          lastSync: replica.lastSync,
          syncErrors: replica.syncErrors,
          error: health.error,
        };
      }),
    );

    return healthChecks;
  }

  /**
   * Get replica statistics
   */
  getStatistics(): {
    total: number;
    active: number;
    inactive: number;
    failed: number;
    healthy: number;
  } {
    const replicas = Array.from(this.replicas.values());

    return {
      total: replicas.length,
      active: replicas.filter((r) => r.isActive).length,
      inactive: replicas.filter((r) => !r.isActive).length,
      failed: replicas.filter((r) => r.syncErrors > 0).length,
      healthy: replicas.filter((r) => r.isActive && r.syncErrors === 0).length,
    };
  }

  /**
   * Clear all replicas
   */
  clear(): void {
    this.replicas.clear();
    this.logger.debug('All replicas cleared');
  }
}
