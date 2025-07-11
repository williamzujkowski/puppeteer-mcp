/**
 * Main migration coordination logic
 * @module store/migration/migration-orchestrator
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { pino } from 'pino';
import type { SessionStore } from '../session-store.interface.js';
import type { Session } from '../../types/session.js';
import type { MigrationOptions, MigrationStats, MigrationContext, BackupOptions } from './types.js';
import {
  getAllSessions,
  filterExpiredSessions,
  filterSessionsByCustomFilter,
} from './migration-utils.js';
import { BatchProcessor } from './batch-processor.js';
import { MigrationValidator } from './migration-validator.js';
import { MigrationMetrics } from './migration-metrics.js';

/**
 * Migration orchestrator class
 */
export class MigrationOrchestrator {
  private logger: pino.Logger;
  private batchProcessor: BatchProcessor;
  private validator: MigrationValidator;
  private metrics: MigrationMetrics;

  constructor(logger: pino.Logger) {
    this.logger = logger;
    this.batchProcessor = new BatchProcessor(logger);
    this.validator = new MigrationValidator(logger);
    this.metrics = new MigrationMetrics(logger);
  }

  /**
   * Orchestrate the migration process
   */
  async migrate(
    sourceStore: SessionStore,
    targetStore: SessionStore,
    options: MigrationOptions = {},
  ): Promise<MigrationStats> {
    const context = this.createMigrationContext(sourceStore, targetStore, options);

    this.metrics.recordMigrationStart(context);

    try {
      // Get all sessions from source store
      const allSessions = await getAllSessions(sourceStore, this.logger);
      context.stats.totalSessions = allSessions.length;

      if (context.stats.totalSessions === 0) {
        this.metrics.logNoSessionsToMigrate();
        context.stats.duration = Date.now() - context.startTime;
        return context.stats;
      }

      // Filter sessions for migration
      const sessionsToMigrate = this.filterSessionsForMigration(allSessions, context.options);

      this.metrics.logSessionProcessingInfo(context.stats.totalSessions, sessionsToMigrate.length);

      // Process sessions in batches
      await this.processMigrationBatches(sessionsToMigrate, context);

      this.metrics.recordMigrationCompletion(context);
      await this.metrics.logMigrationAudit(context);

      return context.stats;
    } catch (error) {
      this.metrics.recordMigrationError(context, error);
      throw error;
    }
  }

  /**
   * Create a backup of all sessions from a store
   */
  async backup(store: SessionStore, options: BackupOptions = {}): Promise<Session[]> {
    const { includeExpired = false, filter } = options;

    this.metrics.logBackupStart();

    const allSessions = await getAllSessions(store, this.logger);

    let sessionsToBackup = allSessions;

    // Filter out expired sessions if requested
    if (!includeExpired) {
      sessionsToBackup = filterExpiredSessions(sessionsToBackup);
    }

    // Apply custom filter if provided
    if (filter) {
      sessionsToBackup = filterSessionsByCustomFilter(sessionsToBackup, filter);
    }

    this.metrics.logBackupCreation(allSessions.length, sessionsToBackup.length);
    await this.metrics.logBackupAudit(store, sessionsToBackup.length);

    return sessionsToBackup;
  }

  /**
   * Get migration validator
   */
  getValidator(): MigrationValidator {
    return this.validator;
  }

  /**
   * Create migration context
   */
  private createMigrationContext(
    sourceStore: SessionStore,
    targetStore: SessionStore,
    options: MigrationOptions,
  ): MigrationContext {
    return {
      sourceStore,
      targetStore,
      options,
      startTime: Date.now(),
      stats: this.metrics.initializeMigrationStats(),
    };
  }

  /**
   * Filter sessions for migration based on options
   */
  private filterSessionsForMigration(sessions: Session[], options: MigrationOptions): Session[] {
    return options.filter ? filterSessionsByCustomFilter(sessions, options.filter) : sessions;
  }

  /**
   * Process migration batches
   */
  private async processMigrationBatches(
    sessions: Session[],
    context: MigrationContext,
  ): Promise<void> {
    const {
      skipExisting = false,
      deleteAfterMigration = false,
      batchSize = 100,
      continueOnError = true,
      onProgress,
    } = context.options;

    await this.batchProcessor.processBatches({
      sessions,
      sourceStore: context.sourceStore,
      targetStore: context.targetStore,
      options: {
        skipExisting,
        deleteAfterMigration,
        continueOnError,
      },
      stats: context.stats,
      batchSize,
      onProgress,
    });
  }
}
