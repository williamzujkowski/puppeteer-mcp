/**
 * Batch processing operations for session migration
 * @module store/migration/batch-processor
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { pino } from 'pino';
import type { SessionStore } from '../session-store.interface.js';
import type { Session } from '../../types/session.js';
import type { MigrationStats, BatchProcessingOptions } from './types.js';
import { isSessionExpired } from './migration-utils.js';
import { MigrationMetrics } from './migration-metrics.js';

/**
 * Batch processor for session migration
 */
export class BatchProcessor {
  private _logger: pino.Logger;
  private metrics: MigrationMetrics;

  constructor(logger: pino.Logger) {
    this._logger = logger;
    this.metrics = new MigrationMetrics(logger);
  }

  /**
   * Process a batch of sessions for migration
   */
  async processBatch(context: MigrationBatchContext): Promise<void> {
    const { sessions, sourceStore, targetStore, options, stats } = context;
    const { skipExisting, deleteAfterMigration, continueOnError } = options;

    for (const session of sessions) {
      try {
        await this.processSingleSession({
          session,
          sourceStore,
          targetStore,
          options: {
            skipExisting,
            deleteAfterMigration,
          },
          stats,
        });
      } catch (error) {
        this.metrics.recordSessionMigrationFailure(stats, session.id, error);

        if (!continueOnError) {
          throw error;
        }
      }
    }
  }

  /**
   * Process a single session for migration
   */
  private async processSingleSession(context: SingleSessionContext): Promise<void> {
    const { session, sourceStore, targetStore, options, stats } = context;
    const { skipExisting, deleteAfterMigration } = options;

    // Check if session exists in target store
    if (skipExisting && (await targetStore.exists(session.id))) {
      this.metrics.recordSessionMigrationSkip(
        stats,
        session.id,
        'Session already exists in target store',
      );
      return;
    }

    // Check if session is expired
    if (isSessionExpired(session)) {
      this.metrics.recordSessionMigrationSkip(stats, session.id, 'Session expired');
      return;
    }

    // Migrate session
    await targetStore.create(session.data);
    this.metrics.recordSessionMigrationSuccess(stats, session.id);

    // Delete from source store if requested
    if (deleteAfterMigration) {
      await sourceStore.delete(session.id);
      this.metrics.recordSessionDeletion(session.id);
    }
  }

  /**
   * Process sessions in batches
   */
  async processBatches(context: BatchProcessingContext): Promise<void> {
    const { sessions, batchSize, onProgress } = context;

    for (let i = 0; i < sessions.length; i += batchSize) {
      const batch = sessions.slice(i, i + batchSize);

      await this.processBatch({
        sessions: batch,
        sourceStore: context.sourceStore,
        targetStore: context.targetStore,
        options: context.options,
        stats: context.stats,
      });

      // Report progress
      if (onProgress) {
        onProgress(i + batch.length, sessions.length);
      }
    }
  }
}

/**
 * Context for batch processing
 */
interface BatchProcessingContext {
  sessions: Session[];
  sourceStore: SessionStore;
  targetStore: SessionStore;
  options: BatchProcessingOptions;
  stats: MigrationStats;
  batchSize: number;
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Context for migration batch processing
 */
interface MigrationBatchContext {
  sessions: Session[];
  sourceStore: SessionStore;
  targetStore: SessionStore;
  options: BatchProcessingOptions;
  stats: MigrationStats;
}

/**
 * Context for single session processing
 */
interface SingleSessionContext {
  session: Session;
  sourceStore: SessionStore;
  targetStore: SessionStore;
  options: {
    skipExisting: boolean;
    deleteAfterMigration: boolean;
  };
  stats: MigrationStats;
}
