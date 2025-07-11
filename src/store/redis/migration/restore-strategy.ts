/**
 * Restore strategy implementation
 * @module store/redis/migration/restore-strategy
 * @nist cp-10 "Information system recovery and reconstitution"
 * @nist cp-12 "Safe mode operation"
 */

import { readFile } from 'fs/promises';
import type { RedisClient, StoreLogger } from '../types.js';
import type {
  RestoreOptions,
  RestoreResult,
  BackupData,
  BackupSession,
  MigrationContext,
} from './types.js';
import { BaseMigration } from './base-migration.js';
import { SessionValidator } from './session-validator.js';

/**
 * Configuration for restore strategy
 */
export interface RestoreConfig {
  client: RedisClient;
  backupPath: string;
  options?: RestoreOptions;
}

/**
 * Restore strategy implementation
 */
export class RestoreStrategy extends BaseMigration<RestoreConfig, RestoreResult> {
  private validator: SessionValidator;
  private backupData?: BackupData;
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours

  constructor(logger: StoreLogger) {
    super(logger);
    this.validator = new SessionValidator(logger);
  }

  protected createContext(config: RestoreConfig, startTime: Date): MigrationContext {
    return {
      operation: 'restore',
      startTime,
      options: config.options ?? {},
    };
  }

  protected async validate(config: RestoreConfig): Promise<{ valid: boolean; errors: string[] }> {
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

    // Load and validate backup file
    try {
      const backupContent = await readFile(config.backupPath, 'utf8');
      const backupData = JSON.parse(backupContent);

      if (!this.validator.validateBackupData(backupData)) {
        errors.push('Invalid backup file format');
      } else {
        this.backupData = backupData;
      }
    } catch (error) {
      errors.push(
        `Failed to read backup file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  protected async preMigration(config: RestoreConfig): Promise<void> {
    if (!this.backupData) {
      throw new Error('Backup data not loaded');
    }

    this.logger.info(
      {
        sessionCount: this.backupData.sessions.length,
        backupVersion: this.backupData.version,
        backupTimestamp: this.backupData.timestamp,
        options: config.options,
      },
      'Starting session restore',
    );
  }

  protected async performMigration(config: RestoreConfig): Promise<RestoreResult> {
    if (!this.backupData) {
      throw new Error('Backup data not loaded');
    }

    const result: RestoreResult = {
      success: false,
      restoredCount: 0,
      skippedCount: 0,
      errors: [],
    };

    // Validate sessions first if requested
    if (config.options?.validateOnly) {
      const validationResult = await this.validator.validateSessions(this.backupData.sessions, {
        strict: false,
      });

      result.restoredCount = validationResult.validCount;
      result.skippedCount = validationResult.invalidCount;
      result.errors = validationResult.errors;
      result.success = validationResult.valid;

      return result;
    }

    // Process sessions in batches
    await this.processBatch(
      this.backupData.sessions,
      50, // Smaller batch size for restore
      async (batch) => {
        for (const sessionBackup of batch) {
          try {
            const restoreResult = await this.restoreSession(
              config.client,
              sessionBackup,
              config.options,
            );

            if (restoreResult.restored) {
              result.restoredCount++;
            } else if (restoreResult.skipped) {
              result.skippedCount++;
            }

            if (restoreResult.error) {
              result.errors.push(restoreResult.error);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Failed to restore session: ${errorMessage}`);
          }
        }
      },
      (processed, total) => {
        this.logger.info(
          {
            progress: `${processed}/${total}`,
            restored: result.restoredCount,
            skipped: result.skippedCount,
          },
          'Restore progress',
        );
      },
    );

    result.success = result.errors.length === 0;
    return result;
  }

  protected async postMigration(_config: RestoreConfig, result: RestoreResult): Promise<void> {
    this.logger.info(
      {
        restoredCount: result.restoredCount,
        skippedCount: result.skippedCount,
        errorCount: result.errors.length,
      },
      'Restore completed',
    );
  }

  protected createErrorResult(errors: string[]): RestoreResult {
    return {
      success: false,
      restoredCount: 0,
      skippedCount: 0,
      errors,
    };
  }

  /**
   * Restore individual session
   */
  private async restoreSession(
    client: RedisClient,
    sessionBackup: BackupSession,
    options?: RestoreOptions,
  ): Promise<{ restored: boolean; skipped: boolean; error?: string }> {
    const { key, data, ttl } = sessionBackup;

    // Validate session data
    if (!this.validator.validateSessionData(data)) {
      return {
        restored: false,
        skipped: false,
        error: `Invalid session data for key: ${key}`,
      };
    }

    // Check if session already exists
    if (!options?.overwrite) {
      const exists = await client.exists(key);
      if (exists) {
        return { restored: false, skipped: true };
      }
    }

    // Skip dry run
    if (options?.dryRun) {
      return { restored: true, skipped: false };
    }

    // Determine TTL
    let effectiveTTL = this.DEFAULT_TTL;
    if (ttl && this.validator.validateTTL(ttl) && ttl > 0) {
      effectiveTTL = ttl;
    } else if (!this.validator.isSessionExpired(data)) {
      // Try to calculate TTL from session data
      const calculatedTTL = this.validator.calculateTTL(data);
      if (calculatedTTL > 0) {
        effectiveTTL = calculatedTTL;
      }
    }

    // Restore session
    await client.setex(key, effectiveTTL, data);
    return { restored: true, skipped: false };
  }
}
