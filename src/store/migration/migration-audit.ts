/**
 * Migration audit logging utilities
 * @module store/migration/migration-audit
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { RestoreStats, MigrationContext } from './types.js';
import type { SessionStore } from '../session-store.interface.js';
import { logDataAccess } from '../../utils/logger.js';

/**
 * Migration audit logger utility class
 */
export class MigrationAuditLogger {
  /**
   * Log migration audit trail
   */
  async logMigrationAudit(context: MigrationContext): Promise<void> {
    await logDataAccess('WRITE', 'session/migration', {
      action: 'migrate',
      sourceStore: context.sourceStore.constructor.name,
      targetStore: context.targetStore.constructor.name,
      stats: context.stats
    });
  }

  /**
   * Log restore audit trail
   */
  async logRestoreAudit(store: SessionStore, stats: RestoreStats): Promise<void> {
    await logDataAccess('WRITE', 'session/restore', {
      action: 'restore',
      targetStore: store.constructor.name,
      stats
    });
  }

  /**
   * Log backup audit trail
   */
  async logBackupAudit(store: SessionStore, sessionCount: number): Promise<void> {
    await logDataAccess('READ', 'session/backup', {
      action: 'backup',
      sourceStore: store.constructor.name,
      sessionCount
    });
  }
}