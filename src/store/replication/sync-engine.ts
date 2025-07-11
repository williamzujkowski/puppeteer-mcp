/**
 * Synchronization engine for session replication
 * @module store/replication/sync-engine
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist au-3 "Audit logging for replication operations"
 */

import type { Session } from '../../types/session.js';
import type { ReplicaInfo, SyncStats, SyncBatchResult, ReplicationConfig } from './types.js';
import type { Logger } from 'pino';
import { logDataAccess } from '../../utils/logger.js';
import { ConflictResolver } from './conflict-resolver.js';
import { ReplicationTransport } from './replication-transport.js';
import { EventEmitter } from 'events';

/**
 * Handles session synchronization between stores
 */
export class SyncEngine extends EventEmitter {
  private readonly logger: Logger;
  private readonly conflictResolver: ConflictResolver;
  private readonly transport: ReplicationTransport;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.conflictResolver = new ConflictResolver(logger);
    this.transport = new ReplicationTransport(logger);
  }

  /**
   * Sync a specific replica
   */
  async syncReplica(
    replica: ReplicaInfo,
    primarySessions: Session[],
    config: ReplicationConfig,
  ): Promise<SyncStats> {
    const stats: SyncStats = {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      syncedSessions: 0,
      failedSessions: 0,
      skippedSessions: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      this.emit('sync:started', replica.id);

      this.logger.debug(
        { replicaId: replica.id, sessionCount: primarySessions.length },
        'Starting replica sync',
      );

      // Process sessions in batches
      await this.transport.batchOperation(primarySessions, config.batchSize, async (batch) => {
        const batchResult = await this.processSyncBatch(replica, batch, config);
        this.updateStats(stats, batchResult);
      });

      stats.endTime = Date.now();
      stats.duration = stats.endTime - stats.startTime;

      this.logger.info(
        {
          replicaId: replica.id,
          synced: stats.syncedSessions,
          failed: stats.failedSessions,
          skipped: stats.skippedSessions,
          conflicts: stats.conflicts,
          duration: stats.duration,
        },
        'Replica sync completed',
      );

      this.emit('sync:completed', replica.id, stats);

      // Audit log
      await logDataAccess('WRITE', `session/sync/${replica.id}`, {
        action: 'sync',
        replicaId: replica.id,
        stats,
      });

      return stats;
    } catch (error) {
      stats.endTime = Date.now();
      stats.duration = stats.endTime - stats.startTime;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ replicaId: replica.id, error: errorMessage }, 'Replica sync failed');

      this.emit('sync:failed', replica.id, error);
      throw error;
    }
  }

  /**
   * Process a batch of sessions for synchronization
   */
  private async processSyncBatch(
    replica: ReplicaInfo,
    sessions: Session[],
    config: ReplicationConfig,
  ): Promise<SyncBatchResult> {
    const result: SyncBatchResult = {
      processed: sessions.length,
      succeeded: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    for (const session of sessions) {
      try {
        const syncResult = await this.syncSession(replica, session, config);

        switch (syncResult) {
          case 'synced':
            result.succeeded++;
            break;
          case 'skipped':
            // Don't count as failed
            break;
          case 'conflict':
            result.conflicts++;
            break;
          case 'failed':
            result.failed++;
            break;
        }
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        result.errors.push({
          sessionId: session.id,
          error: errorMessage,
        });

        this.logger.error(
          {
            replicaId: replica.id,
            sessionId: session.id,
            error: errorMessage,
          },
          'Failed to sync session',
        );
      }
    }

    return result;
  }

  /**
   * Sync a single session
   */
  private async syncSession(
    replica: ReplicaInfo,
    session: Session,
    config: ReplicationConfig,
  ): Promise<'synced' | 'skipped' | 'conflict' | 'failed'> {
    // Skip expired sessions if configured
    if (!config.syncExpired && new Date(session.data.expiresAt) < new Date()) {
      return 'skipped';
    }

    // Check if session exists in replica
    const replicaSession = await this.transport.getSession(
      replica.store,
      session.id,
      config.maxRetries,
      config.retryDelay,
    );

    if (replicaSession) {
      // Handle conflict resolution
      const shouldUpdate = this.conflictResolver.resolve(
        session,
        replicaSession,
        config.conflictResolution,
      );

      if (shouldUpdate) {
        await this.transport.updateSession({
          store: replica.store,
          sessionId: session.id,
          sessionData: session.data,
          maxRetries: config.maxRetries,
          retryDelay: config.retryDelay,
        });
        return 'synced';
      } else {
        return 'conflict';
      }
    } else {
      // Create new session in replica
      await this.transport.createSession(
        replica.store,
        session.data,
        config.maxRetries,
        config.retryDelay,
      );
      return 'synced';
    }
  }

  /**
   * Update sync statistics
   */
  private updateStats(stats: SyncStats, batchResult: SyncBatchResult): void {
    stats.syncedSessions += batchResult.succeeded;
    stats.failedSessions += batchResult.failed;
    stats.conflicts += batchResult.conflicts;
    stats.errors.push(...batchResult.errors);
  }

  /**
   * Sync all replicas
   */
  async syncAllReplicas(
    replicas: ReplicaInfo[],
    primarySessions: Session[],
    config: ReplicationConfig,
  ): Promise<Map<string, SyncStats>> {
    const results = new Map<string, SyncStats>();

    this.logger.debug({ replicaCount: replicas.length }, 'Starting sync for all replicas');

    // Sync replicas in parallel
    const syncPromises = replicas.map(async (replica) => {
      try {
        const stats = await this.syncReplica(replica, primarySessions, config);
        results.set(replica.id, stats);
      } catch (error) {
        this.logger.error(
          {
            replicaId: replica.id,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to sync replica',
        );
      }
    });

    await Promise.all(syncPromises);

    return results;
  }
}
