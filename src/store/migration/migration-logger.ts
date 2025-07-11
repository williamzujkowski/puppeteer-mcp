/**
 * Migration logging utilities
 * @module store/migration/migration-logger
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { pino } from 'pino';

/**
 * Migration logger utility class
 */
export class MigrationLogger {
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  /**
   * Log session processing info
   */
  logSessionProcessingInfo(totalSessions: number, toMigrate: number): void {
    this.logger.info(
      {
        total: totalSessions,
        toMigrate,
      },
      'Sessions ready for migration',
    );
  }

  /**
   * Log no sessions to migrate
   */
  logNoSessionsToMigrate(): void {
    this.logger.info('No sessions to migrate');
  }

  /**
   * Log backup creation
   */
  logBackupCreation(total: number, backup: number): void {
    this.logger.info({ total, backup }, 'Session backup completed');
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
    this.logger.info(result, 'Migration validation completed');
  }

  /**
   * Log restore start
   */
  logRestoreStart(sessionCount: number): void {
    this.logger.info({ sessionCount }, 'Restoring sessions from backup');
  }

  /**
   * Log validation start
   */
  logValidationStart(): void {
    this.logger.info('Validating migration');
  }

  /**
   * Log backup start
   */
  logBackupStart(): void {
    this.logger.info('Creating session backup');
  }
}
