/**
 * Main coordination for session replication
 * @module store/replication/replication-coordinator
 * @nist sc-28 "Protection of information at rest"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import type { SessionStore } from '../session-store.interface.js';
import type { Session } from '../../types/session.js';
import type { ReplicationConfig, ReplicationOperation } from './types.js';
import type { Logger } from 'pino';
import { ReplicationTransport } from './replication-transport.js';
import { ReplicationMetrics } from './replication-metrics.js';
import { EventEmitter } from 'events';

interface ReplicationOperationParams {
  operationType: ReplicationOperation;
  sessionId: string;
  replicaIds: string[];
  getReplica: (id: string) => { store: SessionStore; isActive: boolean } | undefined;
  operation: (store: SessionStore) => Promise<void>;
}

/**
 * Coordinates replication operations across replicas
 */
export class ReplicationCoordinator extends EventEmitter {
  private readonly logger: Logger;
  private readonly transport: ReplicationTransport;
  private readonly metrics: ReplicationMetrics;
  private readonly config: ReplicationConfig;

  constructor(config: ReplicationConfig, logger: Logger) {
    super();
    this.logger = logger;
    this.config = config;
    this.transport = new ReplicationTransport(logger);
    this.metrics = new ReplicationMetrics(logger);
  }

  /**
   * Replicate session creation to all replicas
   */
  async replicateCreate(
    session: Session,
    replicaIds: string[],
    getReplica: (id: string) => { store: SessionStore; isActive: boolean } | undefined,
  ): Promise<void> {
    await this.replicateOperation({
      operationType: 'create',
      sessionId: session.id,
      replicaIds,
      getReplica,
      operation: async (store) => {
        await this.transport.createSession(
          store,
          session.data,
          this.config.maxRetries,
          this.config.retryDelay,
        );
      },
    });
  }

  /**
   * Replicate session update to all replicas
   */
  async replicateUpdate(
    session: Session,
    replicaIds: string[],
    getReplica: (id: string) => { store: SessionStore; isActive: boolean } | undefined,
  ): Promise<void> {
    await this.replicateOperation({
      operationType: 'update',
      sessionId: session.id,
      replicaIds,
      getReplica,
      operation: async (store) => {
        await this.transport.updateSession({
          store,
          sessionId: session.id,
          sessionData: session.data,
          maxRetries: this.config.maxRetries,
          retryDelay: this.config.retryDelay,
        });
      },
    });
  }

  /**
   * Replicate session deletion to all replicas
   */
  async replicateDelete(
    sessionId: string,
    replicaIds: string[],
    getReplica: (id: string) => { store: SessionStore; isActive: boolean } | undefined,
  ): Promise<void> {
    if (!this.config.syncDeletions) {
      return;
    }

    await this.replicateOperation({
      operationType: 'delete',
      sessionId,
      replicaIds,
      getReplica,
      operation: async (store) => {
        await this.transport.deleteSession(
          store,
          sessionId,
          this.config.maxRetries,
          this.config.retryDelay,
        );
      },
    });
  }

  /**
   * Replicate session touch to all replicas
   */
  async replicateTouch(
    sessionId: string,
    replicaIds: string[],
    getReplica: (id: string) => { store: SessionStore; isActive: boolean } | undefined,
  ): Promise<void> {
    await this.replicateOperation({
      operationType: 'touch',
      sessionId,
      replicaIds,
      getReplica,
      operation: async (store) => {
        await this.transport.touchSession(
          store,
          sessionId,
          this.config.maxRetries,
          this.config.retryDelay,
        );
      },
    });
  }

  /**
   * Generic replication operation
   */
  private async replicateOperation(params: ReplicationOperationParams): Promise<void> {
    const { operationType, sessionId, replicaIds, getReplica, operation } = params;
    const promises = replicaIds.map(async (replicaId) => {
      const replica = getReplica(replicaId);
      if (!replica?.isActive) {
        return;
      }

      const startTime = Date.now();

      try {
        await operation(replica.store);

        const duration = Date.now() - startTime;

        this.metrics.recordOperation({
          operationType,
          replicaId,
          sessionId,
          success: true,
          duration,
        });

        this.logger.debug(
          { replicaId, sessionId, operationType },
          `Session ${operationType}d in replica`,
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        this.metrics.recordOperation({
          operationType,
          replicaId,
          sessionId,
          success: false,
          duration,
          error: errorMessage,
        });

        this.handleReplicaError(replicaId, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Handle replica errors
   */
  private handleReplicaError(replicaId: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    this.logger.error({ replicaId, error: errorMessage }, 'Replica operation failed');

    this.emit('replica:error', replicaId, error instanceof Error ? error : new Error(errorMessage));
  }

  /**
   * Get replication metrics
   */
  getMetrics(): ReturnType<ReplicationMetrics['exportMetrics']> {
    return this.metrics.exportMetrics();
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics.clearAllMetrics();
  }
}
