/**
 * Migration metrics and reporting functionality
 * @module store/migration/migration-metrics
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { pino } from 'pino';
import type { MigrationStats, RestoreStats, MigrationContext } from './types.js';
import type { SessionStore } from '../session-store.interface.js';
import { MigrationLogger } from './migration-logger.js';
import { MigrationAuditLogger } from './migration-audit.js';
import { StatsInitializer } from './stats-initializer.js';

/**
 * Migration metrics manager
 */
export class MigrationMetrics {
  private logger: pino.Logger;
  private migrationLogger: MigrationLogger;
  private auditLogger: MigrationAuditLogger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
    this.migrationLogger = new MigrationLogger(logger);
    this.auditLogger = new MigrationAuditLogger();
  }

  /**
   * Initialize migration statistics
   */
  initializeMigrationStats(): MigrationStats {
    return StatsInitializer.initializeMigrationStats();
  }

  /**
   * Initialize restore statistics
   */
  initializeRestoreStats(): RestoreStats {
    return StatsInitializer.initializeRestoreStats();
  }

  /**
   * Record migration start
   */
  recordMigrationStart(_context: MigrationContext): void {
    this.logger.info('Starting session migration');
  }

  /**
   * Record migration completion
   */
  recordMigrationCompletion(context: MigrationContext): void {
    context.stats.duration = Date.now() - context.startTime;

    this.logger.info({
      migrated: context.stats.migratedSessions,
      failed: context.stats.failedSessions,
      skipped: context.stats.skippedSessions,
      duration: context.stats.duration
    }, 'Session migration completed');
  }

  /**
   * Record migration error
   */
  recordMigrationError(context: MigrationContext, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    this.logger.error({ error: errorMessage }, 'Session migration failed');
    
    context.stats.duration = Date.now() - context.startTime;
    context.stats.errors.push({
      sessionId: 'migration',
      error: errorMessage
    });
  }

  /**
   * Record session migration success
   */
  recordSessionMigrationSuccess(stats: MigrationStats, sessionId: string): void {
    stats.migratedSessions++;
    this.logger.debug({ sessionId }, 'Session migrated successfully');
  }

  /**
   * Record session migration skip
   */
  recordSessionMigrationSkip(stats: MigrationStats, sessionId: string, reason: string): void {
    stats.skippedSessions++;
    this.logger.debug({ sessionId, reason }, 'Session skipped');
  }

  /**
   * Record session migration failure
   */
  recordSessionMigrationFailure(stats: MigrationStats, sessionId: string, error: unknown): void {
    stats.failedSessions++;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    stats.errors.push({
      sessionId,
      error: errorMessage
    });

    this.logger.error({ 
      sessionId, 
      error: errorMessage 
    }, 'Failed to migrate session');
  }

  /**
   * Record session deletion after migration
   */
  recordSessionDeletion(sessionId: string): void {
    this.logger.debug({ sessionId }, 'Session deleted from source store');
  }

  /**
   * Record restore completion
   */
  recordRestoreCompletion(stats: RestoreStats): void {
    this.logger.info(stats, 'Session restore completed');
  }

  /**
   * Record restore error
   */
  recordRestoreError(stats: RestoreStats, sessionId: string, error: unknown): void {
    stats.failed++;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    stats.errors.push({
      sessionId,
      error: errorMessage
    });

    this.logger.error({ 
      sessionId, 
      error: errorMessage 
    }, 'Failed to restore session');
  }

  /**
   * Record restore skip
   */
  recordRestoreSkip(stats: RestoreStats): void {
    stats.skipped++;
  }

  /**
   * Record restore success
   */
  recordRestoreSuccess(stats: RestoreStats): void {
    stats.restored++;
  }

  /**
   * Log migration audit trail
   */
  async logMigrationAudit(context: MigrationContext): Promise<void> {
    return this.auditLogger.logMigrationAudit(context);
  }

  /**
   * Log restore audit trail
   */
  async logRestoreAudit(store: SessionStore, stats: RestoreStats): Promise<void> {
    return this.auditLogger.logRestoreAudit(store, stats);
  }

  /**
   * Log backup audit trail
   */
  async logBackupAudit(store: SessionStore, sessionCount: number): Promise<void> {
    return this.auditLogger.logBackupAudit(store, sessionCount);
  }

  /**
   * Log session processing info
   */
  logSessionProcessingInfo(totalSessions: number, toMigrate: number): void {
    this.migrationLogger.logSessionProcessingInfo(totalSessions, toMigrate);
  }

  /**
   * Log no sessions to migrate
   */
  logNoSessionsToMigrate(): void {
    this.migrationLogger.logNoSessionsToMigrate();
  }

  /**
   * Log backup creation
   */
  logBackupCreation(total: number, backup: number): void {
    this.migrationLogger.logBackupCreation(total, backup);
  }

  /**
   * Log validation completion
   */
  logValidationCompletion(result: {
    valid: boolean;
    sourceSessions: number;
    targetSessions: number;
    missingSessions: string[];
    extraSessions: string[];
  }): void {
    this.migrationLogger.logValidationCompletion(result);
  }

  /**
   * Log restore start
   */
  logRestoreStart(sessionCount: number): void {
    this.migrationLogger.logRestoreStart(sessionCount);
  }

  /**
   * Log validation start
   */
  logValidationStart(): void {
    this.migrationLogger.logValidationStart();
  }

  /**
   * Log backup start
   */
  logBackupStart(): void {
    this.migrationLogger.logBackupStart();
  }
}