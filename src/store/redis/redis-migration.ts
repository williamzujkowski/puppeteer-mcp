/**
 * Redis data migration and backup utilities
 * @module store/redis/redis-migration
 * @nist cp-9 "Information system backup"
 * @nist cp-10 "Information system recovery and reconstitution"
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { Session } from '../../types/session.js';
import type { RedisClient, StoreLogger, MigrationConfig } from './types.js';
import { SessionOperations } from './session-operations.js';

/**
 * Redis migration and backup utilities
 */
export class RedisMigrationManager {
  private logger: StoreLogger;
  private sessionOps: SessionOperations;
  private readonly SESSION_KEY_PREFIX = 'session:';

  constructor(logger: StoreLogger) {
    this.logger = logger;
    this.sessionOps = new SessionOperations(logger);
  }

  /**
   * Backup all sessions to file
   */
  async backupSessions(
    client: RedisClient,
    backupPath: string,
    options: { preserveTTL?: boolean; compress?: boolean } = {}
  ): Promise<{
    success: boolean;
    sessionCount: number;
    backupSize: number;
    error?: string;
  }> {
    try {
      // Ensure backup directory exists
      await mkdir(dirname(backupPath), { recursive: true });

      const sessionKeys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
      const backup: Array<{
        key: string;
        data: string;
        ttl?: number;
      }> = [];

      this.logger.info({ sessionCount: sessionKeys.length }, 'Starting session backup');

      for (const key of sessionKeys) {
        const data = await client.get(key);
        if (data) {
          const backupEntry: any = { key, data };
          
          if (options.preserveTTL) {
            // Note: This would require additional Redis commands to get TTL
            // For now, we'll calculate from session data
            try {
              const session = JSON.parse(data);
              if (session.data?.expiresAt) {
                const ttl = Math.max(0, Math.ceil(
                  (new Date(session.data.expiresAt).getTime() - Date.now()) / 1000
                ));
                backupEntry.ttl = ttl;
              }
            } catch (error) {
              this.logger.warn({ key, error }, 'Failed to calculate TTL for session');
            }
          }
          
          backup.push(backupEntry);
        }
      }

      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        sessionCount: backup.length,
        preserveTTL: options.preserveTTL || false,
        sessions: backup
      };

      const serializedData = JSON.stringify(backupData, null, 2);
      await writeFile(backupPath, serializedData, 'utf8');

      const stats = {
        success: true,
        sessionCount: backup.length,
        backupSize: Buffer.byteLength(serializedData, 'utf8')
      };

      this.logger.info(stats, 'Session backup completed successfully');
      return stats;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ error, backupPath }, 'Session backup failed');
      
      return {
        success: false,
        sessionCount: 0,
        backupSize: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Restore sessions from backup file
   */
  async restoreSessions(
    client: RedisClient,
    backupPath: string,
    options: { 
      overwrite?: boolean; 
      dryRun?: boolean;
      validateOnly?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    restoredCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    const result = {
      success: false,
      restoredCount: 0,
      skippedCount: 0,
      errors: [] as string[]
    };

    try {
      const backupData = await readFile(backupPath, 'utf8');
      const backup = JSON.parse(backupData);

      if (!backup.sessions || !Array.isArray(backup.sessions)) {
        throw new Error('Invalid backup format');
      }

      this.logger.info({ 
        sessionCount: backup.sessions.length,
        dryRun: options.dryRun,
        validateOnly: options.validateOnly 
      }, 'Starting session restore');

      for (const sessionBackup of backup.sessions) {
        try {
          const { key, data, ttl } = sessionBackup;
          
          // Validate session data
          if (!this.validateSessionData(data)) {
            result.errors.push(`Invalid session data for key: ${key}`);
            continue;
          }

          if (options.validateOnly) {
            result.restoredCount++;
            continue;
          }

          // Check if session already exists
          if (!options.overwrite) {
            const exists = await client.exists(key);
            if (exists) {
              result.skippedCount++;
              continue;
            }
          }

          if (!options.dryRun) {
            if (ttl && ttl > 0) {
              await client.setex(key, ttl, data);
            } else {
              // Default TTL if not preserved or expired
              const defaultTTL = 24 * 60 * 60; // 24 hours
              await client.setex(key, defaultTTL, data);
            }
          }

          result.restoredCount++;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to restore session: ${errorMessage}`);
        }
      }

      result.success = result.errors.length === 0;
      
      this.logger.info(result, 'Session restore completed');
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Restore failed: ${errorMessage}`);
      this.logger.error({ error, backupPath }, 'Session restore failed');
      return result;
    }
  }

  /**
   * Migrate sessions between Redis instances
   */
  async migrateSessions(
    sourceClient: RedisClient,
    targetClient: RedisClient,
    config: MigrationConfig
  ): Promise<{
    success: boolean;
    migratedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const result = {
      success: false,
      migratedCount: 0,
      failedCount: 0,
      errors: [] as string[]
    };

    try {
      const sessionKeys = await sourceClient.keys(`${this.SESSION_KEY_PREFIX}*`);
      
      this.logger.info({ 
        sessionCount: sessionKeys.length,
        batchSize: config.batchSize 
      }, 'Starting session migration');

      // Process in batches
      for (let i = 0; i < sessionKeys.length; i += config.batchSize) {
        const batch = sessionKeys.slice(i, i + config.batchSize);
        
        for (const key of batch) {
          try {
            const data = await sourceClient.get(key);
            if (!data) {
              continue;
            }

            let ttl = 0;
            if (config.preserveTTL) {
              // Calculate TTL from session data
              try {
                const session = JSON.parse(data);
                if (session.data?.expiresAt) {
                  ttl = Math.max(0, Math.ceil(
                    (new Date(session.data.expiresAt).getTime() - Date.now()) / 1000
                  ));
                }
              } catch (error) {
                this.logger.warn({ key, error }, 'Failed to calculate TTL during migration');
                ttl = 24 * 60 * 60; // Default 24 hours
              }
            } else {
              ttl = 24 * 60 * 60; // Default 24 hours
            }

            if (ttl > 0) {
              await targetClient.setex(key, ttl, data);
              result.migratedCount++;
            } else {
              this.logger.warn({ key }, 'Skipped expired session during migration');
            }

          } catch (error) {
            result.failedCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Failed to migrate ${key}: ${errorMessage}`);
          }
        }

        // Log progress
        if (i % (config.batchSize * 10) === 0) {
          this.logger.info({ 
            progress: `${i + batch.length}/${sessionKeys.length}`,
            migrated: result.migratedCount,
            failed: result.failedCount 
          }, 'Migration progress');
        }
      }

      result.success = result.failedCount === 0;
      this.logger.info(result, 'Session migration completed');
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Migration failed: ${errorMessage}`);
      this.logger.error({ error }, 'Session migration failed');
      return result;
    }
  }

  /**
   * Validate backup file format
   */
  async validateBackup(backupPath: string): Promise<{
    valid: boolean;
    version?: string;
    sessionCount?: number;
    timestamp?: string;
    errors: string[];
  }> {
    const result = {
      valid: false,
      errors: [] as string[]
    };

    try {
      const backupData = await readFile(backupPath, 'utf8');
      const backup = JSON.parse(backupData);

      // Check required fields
      if (!backup.timestamp) {
        result.errors.push('Missing timestamp');
      }

      if (!backup.version) {
        result.errors.push('Missing version');
      }

      if (!backup.sessions || !Array.isArray(backup.sessions)) {
        result.errors.push('Invalid or missing sessions array');
      } else {
        // Validate sample sessions
        let validSessions = 0;
        for (let i = 0; i < Math.min(10, backup.sessions.length); i++) {
          const session = backup.sessions[i];
          if (this.validateSessionData(session.data)) {
            validSessions++;
          }
        }

        if (validSessions === 0 && backup.sessions.length > 0) {
          result.errors.push('No valid sessions found in sample');
        }
      }

      result.valid = result.errors.length === 0;
      
      if (result.valid) {
        return {
          ...result,
          version: backup.version,
          sessionCount: backup.sessionCount || backup.sessions.length,
          timestamp: backup.timestamp
        };
      }

      return result;

    } catch (error) {
      result.errors.push(`Backup validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Validate session data format
   */
  private validateSessionData(data: string): boolean {
    try {
      const session = JSON.parse(data);
      return Boolean(
        session &&
        typeof session.id === 'string' &&
        session.data &&
        typeof session.data.userId === 'string' &&
        typeof session.lastAccessedAt === 'string'
      );
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired sessions before backup/migration
   */
  async cleanupExpiredSessions(client: RedisClient): Promise<number> {
    try {
      const sessionKeys = await client.keys(`${this.SESSION_KEY_PREFIX}*`);
      let cleanedCount = 0;

      for (const key of sessionKeys) {
        const data = await client.get(key);
        if (data) {
          try {
            const session = JSON.parse(data);
            if (session.data?.expiresAt && new Date(session.data.expiresAt) < new Date()) {
              await client.del(key);
              cleanedCount++;
            }
          } catch (error) {
            this.logger.warn({ key, error }, 'Failed to parse session during cleanup');
          }
        }
      }

      this.logger.info({ cleanedCount }, 'Expired sessions cleaned up');
      return cleanedCount;

    } catch (error) {
      this.logger.error({ error }, 'Failed to cleanup expired sessions');
      return 0;
    }
  }
}