/**
 * Backup strategy implementation
 * @module store/redis/migration/backup-strategy
 * @nist cp-9 "Information system backup"
 * @nist cp-10 "Information system recovery and reconstitution"
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { RedisClient, StoreLogger } from '../types.js';
import type {
  BackupOptions,
  BackupResult,
  BackupData,
  BackupSession,
  MigrationContext,
} from './types.js';
import { BaseMigration } from './base-migration.js';
import { SessionValidator } from './session-validator.js';

/**
 * Configuration for backup strategy
 */
export interface BackupConfig {
  client: RedisClient;
  backupPath: string;
  options?: BackupOptions;
}

/**
 * Backup strategy implementation
 */
export class BackupStrategy extends BaseMigration<BackupConfig, BackupResult> {
  private validator: SessionValidator;
  private readonly SESSION_KEY_PREFIX = 'session:';

  constructor(logger: StoreLogger) {
    super(logger);
    this.validator = new SessionValidator(logger);
  }

  protected createContext(config: BackupConfig, startTime: Date): MigrationContext {
    return {
      operation: 'backup',
      startTime,
      options: config.options ?? {},
    };
  }

  protected async validate(config: BackupConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!config.client) {
      errors.push('Redis client is required');
    }

    if (!config.backupPath) {
      errors.push('Backup path is required');
    }

    // Validate Redis connection
    try {
      await config.client.ping();
    } catch (error) {
      errors.push(
        `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  protected async preMigration(config: BackupConfig): Promise<void> {
    // Ensure backup directory exists
    await mkdir(dirname(config.backupPath), { recursive: true });
  }

  protected async performMigration(config: BackupConfig): Promise<BackupResult> {
    const sessionKeys = await config.client.keys(`${this.SESSION_KEY_PREFIX}*`);
    const backup: BackupSession[] = [];

    this.logger.info({ sessionCount: sessionKeys.length }, 'Starting session backup');

    // Process sessions in batches
    await this.processBatch(
      sessionKeys,
      100, // Batch size
      async (batch) => {
        for (const key of batch) {
          const data = await config.client.get(key);
          if (data && this.validator.validateSessionData(data)) {
            const backupEntry: BackupSession = { key, data };

            if (config.options?.preserveTTL) {
              const ttl = this.validator.calculateTTL(data);
              if (ttl > 0) {
                backupEntry.ttl = ttl;
              }
            }

            backup.push(backupEntry);
          }
        }
      },
      (processed, total) => {
        this.logger.info({ progress: `${processed}/${total}` }, 'Backup progress');
      },
    );

    // Create backup data structure
    const backupData: BackupData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      sessionCount: backup.length,
      preserveTTL: config.options?.preserveTTL ?? false,
      sessions: backup,
    };

    // Write backup file
    const serializedData = JSON.stringify(backupData, null, 2);
    await writeFile(config.backupPath, serializedData, 'utf8');

    return {
      success: true,
      sessionCount: backup.length,
      backupSize: Buffer.byteLength(serializedData, 'utf8'),
      errors: [],
    };
  }

  protected async postMigration(config: BackupConfig, result: BackupResult): Promise<void> {
    this.logger.info(
      {
        backupPath: config.backupPath,
        sessionCount: result.sessionCount,
        backupSize: result.backupSize,
      },
      'Backup completed successfully',
    );
  }

  protected createErrorResult(errors: string[]): BackupResult {
    return {
      success: false,
      sessionCount: 0,
      backupSize: 0,
      errors,
      error: errors[0],
    };
  }

  /**
   * Quick backup with default options
   */
  async quickBackup(client: RedisClient, backupPath: string): Promise<BackupResult> {
    return this.execute({
      client,
      backupPath,
      options: { preserveTTL: true },
    });
  }
}
