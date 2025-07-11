/**
 * Backup and restore manager for session store factory
 * @module store/factory/backup-restore-manager
 * @nist cm-6 "Configuration settings"
 * @nist au-3 "Audit logging for backup operations"
 */

import type { SessionStoreFactoryResult, BackupResult, RestoreStats } from './types.js';
import type { pino } from 'pino';

/**
 * Backup and restore manager for session stores
 */
export class BackupRestoreManager {
  constructor(private logger: pino.Logger) {}

  /**
   * Create a backup of all session data
   */
  async createBackup(
    instanceId: string,
    instance: SessionStoreFactoryResult,
  ): Promise<BackupResult> {
    if (!instance.migration) {
      throw new Error(`Migration not enabled for store '${instanceId}'`);
    }

    const sessions = await instance.migration.backup(instance.store);

    const backup = {
      instanceId,
      storeType: instance.type,
      sessionCount: sessions.length,
      createdAt: new Date(),
      data: sessions,
    };

    this.logger.info(
      {
        instanceId,
        storeType: instance.type,
        sessionCount: sessions.length,
      },
      'Session backup created',
    );

    return backup;
  }

  /**
   * Restore sessions from a backup
   */
  async restoreBackup(
    instanceId: string,
    instance: SessionStoreFactoryResult,
    backup: {
      data: Array<unknown>;
      sessionCount: number;
    },
    options: {
      overwrite?: boolean;
      skipExpired?: boolean;
    } = {},
  ): Promise<RestoreStats> {
    if (!instance.migration) {
      throw new Error(`Migration not enabled for store '${instanceId}'`);
    }

    const stats = await instance.migration.restore(
      instance.store,
      backup.data as Parameters<typeof instance.migration.restore>[1],
      options,
    );

    this.logger.info(
      {
        instanceId,
        ...stats,
      },
      'Session backup restored',
    );

    return stats;
  }
}
