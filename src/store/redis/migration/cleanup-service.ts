/**
 * Cleanup service for expired sessions
 * @module store/redis/migration/cleanup-service
 * @nist ac-2 "Account management for session cleanup"
 * @nist au-11 "Audit record retention"
 */

import type { RedisClient, StoreLogger } from '../types.js';
import { SessionValidator } from './session-validator.js';

/**
 * Cleanup operation result
 */
export interface CleanupResult {
  success: boolean;
  cleanedCount: number;
  scannedCount: number;
  errors: string[];
}

/**
 * Cleanup options
 */
export interface CleanupOptions {
  batchSize?: number;
  dryRun?: boolean;
}

/**
 * Service for cleaning up expired sessions
 */
export class CleanupService {
  private logger: StoreLogger;
  private validator: SessionValidator;
  private readonly SESSION_KEY_PREFIX = 'session:';

  constructor(logger: StoreLogger) {
    this.logger = logger;
    this.validator = new SessionValidator(logger);
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(
    client: RedisClient,
    options: CleanupOptions = {},
  ): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: false,
      cleanedCount: 0,
      scannedCount: 0,
      errors: [],
    };

    try {
      const sessionKeys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
      result.scannedCount = sessionKeys.length;

      this.logger.info(
        {
          sessionCount: sessionKeys.length,
          dryRun: options.dryRun,
        },
        'Starting expired session cleanup',
      );

      const batchSize = options.batchSize ?? 100;
      const keysToDelete: string[] = [];

      // Process in batches
      for (let i = 0; i < sessionKeys.length; i += batchSize) {
        const batch = sessionKeys.slice(i, i + batchSize);

        for (const key of batch) {
          try {
            const shouldDelete = await this.shouldDeleteSession(client, key);
            if (shouldDelete) {
              keysToDelete.push(key);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Failed to check session ${key}: ${errorMessage}`);
          }
        }

        // Delete batch if not dry run
        if (keysToDelete.length > 0 && !options.dryRun) {
          try {
            const deletedCount = await client.del(...keysToDelete);
            result.cleanedCount += deletedCount;
            keysToDelete.length = 0; // Clear array
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Failed to delete batch: ${errorMessage}`);
          }
        } else if (options.dryRun) {
          result.cleanedCount += keysToDelete.length;
          keysToDelete.length = 0;
        }

        // Log progress
        if (i % (batchSize * 10) === 0 && i > 0) {
          this.logger.info(
            {
              progress: `${i + batch.length}/${sessionKeys.length}`,
              cleaned: result.cleanedCount,
            },
            'Cleanup progress',
          );
        }
      }

      result.success = result.errors.length === 0;

      this.logger.info(
        {
          cleanedCount: result.cleanedCount,
          scannedCount: result.scannedCount,
          errorCount: result.errors.length,
        },
        'Expired session cleanup completed',
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Cleanup failed: ${errorMessage}`);
      this.logger.error({ error }, 'Failed to cleanup expired sessions');
      return result;
    }
  }

  /**
   * Check if session should be deleted
   */
  private async shouldDeleteSession(client: RedisClient, key: string): Promise<boolean> {
    const data = await client.get(key);
    if (!data) {
      return true; // Delete empty keys
    }

    // Check if session data is valid
    if (!this.validator.validateSessionData(data)) {
      this.logger.warn({ key }, 'Invalid session data found during cleanup');
      return true; // Delete invalid sessions
    }

    // Check if session is expired
    return this.validator.isSessionExpired(data);
  }

  /**
   * Get statistics about sessions
   */
  async getSessionStatistics(client: RedisClient): Promise<{
    total: number;
    expired: number;
    invalid: number;
    valid: number;
  }> {
    const stats = {
      total: 0,
      expired: 0,
      invalid: 0,
      valid: 0,
    };

    try {
      const sessionKeys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
      stats.total = sessionKeys.length;

      // Sample sessions for statistics
      const sampleSize = Math.min(100, sessionKeys.length);
      const sampledKeys = sessionKeys.slice(0, sampleSize);

      for (const key of sampledKeys) {
        const data = await client.get(key);
        if (!data) {
          stats.invalid++;
        } else if (!this.validator.validateSessionData(data)) {
          stats.invalid++;
        } else if (this.validator.isSessionExpired(data)) {
          stats.expired++;
        } else {
          stats.valid++;
        }
      }

      // Extrapolate from sample
      if (sampleSize < stats.total) {
        const ratio = stats.total / sampleSize;
        stats.expired = Math.round(stats.expired * ratio);
        stats.invalid = Math.round(stats.invalid * ratio);
        stats.valid = Math.round(stats.valid * ratio);
      }

      return stats;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get session statistics');
      return stats;
    }
  }
}
