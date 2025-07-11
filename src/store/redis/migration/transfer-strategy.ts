/**
 * Transfer strategy for migrating sessions between Redis instances
 * @module store/redis/migration/transfer-strategy
 * @nist cp-9 "Information system backup"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import type { RedisClient, StoreLogger, MigrationConfig } from '../types.js';
import type { SessionMigrationResult, MigrationContext } from './types.js';
import { BaseMigration } from './base-migration.js';
import { SessionValidator } from './session-validator.js';

/**
 * Configuration for transfer strategy
 */
export interface TransferConfig {
  sourceClient: RedisClient;
  targetClient: RedisClient;
  migrationConfig: MigrationConfig;
}

/**
 * Transfer strategy implementation
 */
export class TransferStrategy extends BaseMigration<TransferConfig, SessionMigrationResult> {
  private validator: SessionValidator;
  private readonly SESSION_KEY_PREFIX = 'session:';
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours

  constructor(logger: StoreLogger) {
    super(logger);
    this.validator = new SessionValidator(logger);
  }

  protected createContext(config: TransferConfig, startTime: Date): MigrationContext {
    return {
      operation: 'migrate',
      startTime,
      options: {
        batchSize: config.migrationConfig.batchSize,
        preserveTTL: config.migrationConfig.preserveTTL,
      },
    };
  }

  protected async validate(config: TransferConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!config.sourceClient) {
      errors.push('Source Redis client is required');
    }

    if (!config.targetClient) {
      errors.push('Target Redis client is required');
    }

    if (!config.migrationConfig.batchSize || config.migrationConfig.batchSize <= 0) {
      errors.push('Invalid batch size');
    }

    // Validate source connection
    try {
      await config.sourceClient.ping();
    } catch (error) {
      errors.push(
        `Source Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Validate target connection
    try {
      await config.targetClient.ping();
    } catch (error) {
      errors.push(
        `Target Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  protected async preMigration(config: TransferConfig): Promise<void> {
    const sessionKeys = await config.sourceClient.keys(`${this.SESSION_KEY_PREFIX}*`);

    this.logger.info(
      {
        sessionCount: sessionKeys.length,
        batchSize: config.migrationConfig.batchSize,
        preserveTTL: config.migrationConfig.preserveTTL,
      },
      'Starting session transfer',
    );
  }

  protected async performMigration(config: TransferConfig): Promise<SessionMigrationResult> {
    const result: SessionMigrationResult = {
      success: false,
      migratedCount: 0,
      failedCount: 0,
      errors: [],
    };

    const sessionKeys = await config.sourceClient.keys(`${this.SESSION_KEY_PREFIX}*`);

    // Process sessions in batches
    await this.processBatch(
      sessionKeys,
      config.migrationConfig.batchSize,
      async (batch) => {
        const migrationResults = await Promise.allSettled(
          batch.map((key) =>
            this.migrateSession(
              key,
              config.sourceClient,
              config.targetClient,
              config.migrationConfig,
            ),
          ),
        );

        // Process results
        for (const [index, migrationResult] of migrationResults.entries()) {
          if (migrationResult.status === 'fulfilled') {
            if (migrationResult.value.success) {
              result.migratedCount++;
            } else {
              result.failedCount++;
              if (migrationResult.value.error) {
                result.errors.push(`${batch[index]}: ${migrationResult.value.error}`);
              }
            }
          } else {
            result.failedCount++;
            result.errors.push(`${batch[index]}: ${migrationResult.reason}`);
          }
        }
      },
      (processed, total) => {
        this.logger.info(
          {
            progress: `${processed}/${total}`,
            migrated: result.migratedCount,
            failed: result.failedCount,
          },
          'Migration progress',
        );
      },
    );

    result.success = result.failedCount === 0;
    return result;
  }

  protected async postMigration(
    _config: TransferConfig,
    result: SessionMigrationResult,
  ): Promise<void> {
    this.logger.info(
      {
        migratedCount: result.migratedCount,
        failedCount: result.failedCount,
        errorCount: result.errors.length,
      },
      'Transfer completed',
    );
  }

  protected createErrorResult(errors: string[]): SessionMigrationResult {
    return {
      success: false,
      migratedCount: 0,
      failedCount: 0,
      errors,
    };
  }

  /**
   * Migrate individual session
   */
  private async migrateSession(
    key: string,
    sourceClient: RedisClient,
    targetClient: RedisClient,
    config: MigrationConfig,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const data = await sourceClient.get(key);
      if (!data) {
        return { success: false, error: 'Session not found' };
      }

      // Validate session data
      if (!this.validator.validateSessionData(data)) {
        return { success: false, error: 'Invalid session data' };
      }

      // Calculate TTL
      let ttl = this.DEFAULT_TTL;
      if (config.preserveTTL) {
        const calculatedTTL = this.validator.calculateTTL(data);
        if (calculatedTTL > 0) {
          ttl = calculatedTTL;
        } else {
          // Session is expired
          this.logger.warn({ key }, 'Skipped expired session during migration');
          return { success: true }; // Consider expired sessions as successfully handled
        }
      }

      // Transfer session
      await targetClient.setex(key, ttl, data);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Quick transfer with default options
   */
  async quickTransfer(
    sourceClient: RedisClient,
    targetClient: RedisClient,
    batchSize = 100,
  ): Promise<SessionMigrationResult> {
    return this.execute({
      sourceClient,
      targetClient,
      migrationConfig: {
        batchSize,
        preserveTTL: true,
      },
    });
  }
}
