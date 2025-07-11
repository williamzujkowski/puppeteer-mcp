/**
 * Unified migration manager that coordinates all migration operations
 * @module store/redis/migration/migration-manager
 * @nist cp-9 "Information system backup"
 * @nist cp-10 "Information system recovery and reconstitution"
 */

import type { RedisClient, StoreLogger, MigrationConfig } from '../types.js';
import type {
  BackupOptions,
  BackupResult,
  RestoreOptions,
  RestoreResult,
  SessionMigrationResult,
  BackupValidationResult,
} from './types.js';
import { MigrationFactory } from './migration-factory.js';
import type { CleanupOptions, CleanupResult } from './cleanup-service.js';
import type { ValidationOptions } from './validation-service.js';

/**
 * Unified migration manager
 */
export class MigrationManager {
  private _logger: StoreLogger;
  private factory: MigrationFactory;

  constructor(logger: StoreLogger) {
    this._logger = logger;
    this.factory = new MigrationFactory(logger);
  }

  /**
   * Backup sessions to file
   */
  async backupSessions(
    client: RedisClient,
    backupPath: string,
    options?: BackupOptions,
  ): Promise<BackupResult> {
    const strategy = this.factory.createBackupStrategy();
    return strategy.execute({
      client,
      backupPath,
      options,
    });
  }

  /**
   * Restore sessions from backup file
   */
  async restoreSessions(
    client: RedisClient,
    backupPath: string,
    options?: RestoreOptions,
  ): Promise<RestoreResult> {
    const strategy = this.factory.createRestoreStrategy();
    return strategy.execute({
      client,
      backupPath,
      options,
    });
  }

  /**
   * Migrate sessions between Redis instances
   */
  async migrateSessions(
    sourceClient: RedisClient,
    targetClient: RedisClient,
    config: MigrationConfig,
  ): Promise<SessionMigrationResult> {
    const strategy = this.factory.createTransferStrategy();
    return strategy.execute({
      sourceClient,
      targetClient,
      migrationConfig: config,
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(
    client: RedisClient,
    options?: CleanupOptions,
  ): Promise<CleanupResult> {
    const service = this.factory.createCleanupService();
    return service.cleanupExpiredSessions(client, options);
  }

  /**
   * Validate backup file
   */
  async validateBackup(
    backupPath: string,
    options?: ValidationOptions,
  ): Promise<BackupValidationResult> {
    const service = this.factory.createValidationService();
    return service.validateBackupFile(backupPath, options);
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(client: RedisClient): Promise<{
    total: number;
    expired: number;
    invalid: number;
    valid: number;
  }> {
    const service = this.factory.createCleanupService();
    return service.getSessionStatistics(client);
  }

  /**
   * Compare two backup files
   */
  async compareBackups(
    backupPath1: string,
    backupPath2: string,
  ): Promise<{
    identical: boolean;
    differences: Record<string, unknown>;
  }> {
    const service = this.factory.createValidationService();
    return service.compareBackups(backupPath1, backupPath2);
  }

  /**
   * Full backup and validate workflow
   */
  async backupAndValidate(
    client: RedisClient,
    backupPath: string,
    options?: BackupOptions & ValidationOptions,
  ): Promise<{
    backup: BackupResult;
    validation: BackupValidationResult;
  }> {
    // Clean up expired sessions first
    await this.cleanupExpiredSessions(client);

    // Perform backup
    const backup = await this.backupSessions(client, backupPath, options);

    // Validate backup
    const validation = await this.validateBackup(backupPath, options);

    return { backup, validation };
  }

  /**
   * Full migration workflow between Redis instances
   */
  async fullMigration(
    sourceClient: RedisClient,
    targetClient: RedisClient,
    config: MigrationConfig & { backupPath?: string },
  ): Promise<{
    cleanup?: CleanupResult;
    backup?: BackupResult;
    migration: SessionMigrationResult;
  }> {
    const results: any = {};

    // Clean up expired sessions on source
    if (config.preserveTTL) {
      results.cleanup = await this.cleanupExpiredSessions(sourceClient);
    }

    // Create backup if path provided
    if (config.backupPath) {
      results.backup = await this.backupSessions(sourceClient, config.backupPath, {
        preserveTTL: config.preserveTTL,
      });
    }

    // Perform migration
    results.migration = await this.migrateSessions(sourceClient, targetClient, config);

    return results;
  }

  /**
   * Get migration factory for advanced usage
   */
  getFactory(): MigrationFactory {
    return this.factory;
  }
}
