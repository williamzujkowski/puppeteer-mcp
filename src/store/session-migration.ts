/**
 * Session migration utilities for moving between different stores
 * @module store/session-migration
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { SessionStore } from './session-store.interface.js';
import type { Session } from '../types/session.js';
import { pino } from 'pino';
import { logDataAccess } from '../utils/logger.js';

/**
 * Migration statistics
 */
export interface MigrationStats {
  totalSessions: number;
  migratedSessions: number;
  failedSessions: number;
  skippedSessions: number;
  duration: number;
  errors: Array<{
    sessionId: string;
    error: string;
  }>;
}

/**
 * Migration options
 */
export interface MigrationOptions {
  /**
   * Whether to skip sessions that already exist in the target store
   */
  skipExisting?: boolean;
  
  /**
   * Whether to delete sessions from source store after successful migration
   */
  deleteAfterMigration?: boolean;
  
  /**
   * Batch size for processing sessions
   */
  batchSize?: number;
  
  /**
   * Whether to continue migration on individual session errors
   */
  continueOnError?: boolean;
  
  /**
   * Filter function to determine which sessions to migrate
   */
  filter?: (session: Session) => boolean;
  
  /**
   * Progress callback function
   */
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Session migration utility class
 */
export class SessionMigration {
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino({ level: 'info' });
  }

  /**
   * Migrate sessions from one store to another
   */
  async migrate(
    sourceStore: SessionStore,
    targetStore: SessionStore,
    options: MigrationOptions = {}
  ): Promise<MigrationStats> {
    const {
      skipExisting = false,
      deleteAfterMigration = false,
      batchSize = 100,
      continueOnError = true,
      filter,
      onProgress
    } = options;

    const startTime = Date.now();
    const stats: MigrationStats = {
      totalSessions: 0,
      migratedSessions: 0,
      failedSessions: 0,
      skippedSessions: 0,
      duration: 0,
      errors: []
    };

    this.logger.info('Starting session migration');

    try {
      // Get all sessions from source store
      const allSessions = await this.getAllSessions(sourceStore);
      stats.totalSessions = allSessions.length;

      if (stats.totalSessions === 0) {
        this.logger.info('No sessions to migrate');
        stats.duration = Date.now() - startTime;
        return stats;
      }

      // Filter sessions if filter function is provided
      const sessionsToMigrate = filter ? allSessions.filter(filter) : allSessions;
      
      this.logger.info({ 
        total: stats.totalSessions, 
        toMigrate: sessionsToMigrate.length 
      }, 'Sessions ready for migration');

      // Process sessions in batches
      for (let i = 0; i < sessionsToMigrate.length; i += batchSize) {
        const batch = sessionsToMigrate.slice(i, i + batchSize);
        
        await this.processBatch(
          batch,
          sourceStore,
          targetStore,
          {
            skipExisting,
            deleteAfterMigration,
            continueOnError
          },
          stats
        );

        // Report progress
        if (onProgress) {
          onProgress(i + batch.length, sessionsToMigrate.length);
        }
      }

      stats.duration = Date.now() - startTime;

      this.logger.info({
        migrated: stats.migratedSessions,
        failed: stats.failedSessions,
        skipped: stats.skippedSessions,
        duration: stats.duration
      }, 'Session migration completed');

      // Audit log
      await logDataAccess('WRITE', 'session/migration', {
        action: 'migrate',
        sourceStore: sourceStore.constructor.name,
        targetStore: targetStore.constructor.name,
        stats
      });

      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ error: errorMessage }, 'Session migration failed');
      
      stats.duration = Date.now() - startTime;
      stats.errors.push({
        sessionId: 'migration',
        error: errorMessage
      });

      throw error;
    }
  }

  /**
   * Process a batch of sessions
   */
  private async processBatch(
    sessions: Session[],
    sourceStore: SessionStore,
    targetStore: SessionStore,
    options: {
      skipExisting: boolean;
      deleteAfterMigration: boolean;
      continueOnError: boolean;
    },
    stats: MigrationStats
  ): Promise<void> {
    const { skipExisting, deleteAfterMigration, continueOnError } = options;

    for (const session of sessions) {
      try {
        // Check if session exists in target store
        if (skipExisting && await targetStore.exists(session.id)) {
          stats.skippedSessions++;
          this.logger.debug({ sessionId: session.id }, 'Session already exists in target store, skipping');
          continue;
        }

        // Check if session is expired
        if (new Date(session.data.expiresAt) < new Date()) {
          stats.skippedSessions++;
          this.logger.debug({ sessionId: session.id }, 'Session expired, skipping');
          continue;
        }

        // Migrate session
        await targetStore.create(session.data);
        stats.migratedSessions++;
        
        this.logger.debug({ sessionId: session.id }, 'Session migrated successfully');

        // Delete from source store if requested
        if (deleteAfterMigration) {
          await sourceStore.delete(session.id);
          this.logger.debug({ sessionId: session.id }, 'Session deleted from source store');
        }
      } catch (error) {
        stats.failedSessions++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        stats.errors.push({
          sessionId: session.id,
          error: errorMessage
        });

        this.logger.error({ 
          sessionId: session.id, 
          error: errorMessage 
        }, 'Failed to migrate session');

        if (!continueOnError) {
          throw error;
        }
      }
    }
  }

  /**
   * Get all sessions from a store
   * This is a utility method since SessionStore interface doesn't have a getAll method
   */
  private async getAllSessions(store: SessionStore): Promise<Session[]> {
    // Since we don't have a direct getAll method, we'll need to implement this
    // differently based on the store type. For now, we'll use a workaround
    // that attempts to get sessions by examining the store internals.
    
    if (store.constructor.name === 'InMemorySessionStore') {
      // For in-memory store, we can access the sessions directly
      const inMemoryStore = store as any;
      const sessions: Session[] = [];
      
      if (inMemoryStore.sessions && inMemoryStore.sessions instanceof Map) {
        for (const [, session] of inMemoryStore.sessions) {
          sessions.push(session);
        }
      }
      
      return sessions;
    } else if (store.constructor.name === 'RedisSessionStore') {
      // For Redis store, we need to scan for keys
      const redisStore = store as any;
      const sessions: Session[] = [];
      
      try {
        // Get the Redis client from the store
        const { redis, client } = redisStore.getStore();
        
        if (redis) {
          // Scan for all session keys
          const sessionKeys = await client.keys(`${redisStore.SESSION_KEY_PREFIX}*`);
          
          for (const key of sessionKeys) {
            const sessionId = key.replace(redisStore.SESSION_KEY_PREFIX, '');
            const session = await store.get(sessionId);
            
            if (session) {
              sessions.push(session);
            }
          }
        }
      } catch (error) {
        this.logger.error({ error }, 'Failed to get sessions from Redis store');
      }
      
      return sessions;
    }
    
    // For unknown store types, return empty array
    this.logger.warn({ storeType: store.constructor.name }, 'Unknown store type, cannot migrate');
    return [];
  }

  /**
   * Validate that two stores contain the same sessions
   */
  async validateMigration(
    sourceStore: SessionStore,
    targetStore: SessionStore,
    options: { checkExpired?: boolean } = {}
  ): Promise<{
    valid: boolean;
    sourceSessions: number;
    targetSessions: number;
    missingSessions: string[];
    extraSessions: string[];
  }> {
    const { checkExpired = false } = options;
    
    this.logger.info('Validating migration');

    const sourceSessions = await this.getAllSessions(sourceStore);
    const targetSessions = await this.getAllSessions(targetStore);
    
    // Filter out expired sessions if requested
    const activeSourceSessions = checkExpired 
      ? sourceSessions.filter(s => new Date(s.data.expiresAt) >= new Date())
      : sourceSessions;
    
    const activeTargetSessions = checkExpired
      ? targetSessions.filter(s => new Date(s.data.expiresAt) >= new Date())
      : targetSessions;

    const sourceIds = new Set(activeSourceSessions.map(s => s.id));
    const targetIds = new Set(activeTargetSessions.map(s => s.id));

    const missingSessions = Array.from(sourceIds).filter(id => !targetIds.has(id));
    const extraSessions = Array.from(targetIds).filter(id => !sourceIds.has(id));

    const valid = missingSessions.length === 0 && extraSessions.length === 0;

    const result = {
      valid,
      sourceSessions: activeSourceSessions.length,
      targetSessions: activeTargetSessions.length,
      missingSessions,
      extraSessions
    };

    this.logger.info(result, 'Migration validation completed');

    return result;
  }

  /**
   * Create a backup of all sessions from a store
   */
  async backup(
    store: SessionStore,
    options: {
      includeExpired?: boolean;
      filter?: (session: Session) => boolean;
    } = {}
  ): Promise<Session[]> {
    const { includeExpired = false, filter } = options;
    
    this.logger.info('Creating session backup');

    const allSessions = await this.getAllSessions(store);
    
    let sessionsToBackup = allSessions;
    
    // Filter out expired sessions if requested
    if (!includeExpired) {
      sessionsToBackup = sessionsToBackup.filter(s => new Date(s.data.expiresAt) >= new Date());
    }
    
    // Apply custom filter if provided
    if (filter) {
      sessionsToBackup = sessionsToBackup.filter(filter);
    }

    this.logger.info({ 
      total: allSessions.length, 
      backup: sessionsToBackup.length 
    }, 'Session backup completed');

    // Audit log
    await logDataAccess('READ', 'session/backup', {
      action: 'backup',
      sourceStore: store.constructor.name,
      sessionCount: sessionsToBackup.length
    });

    return sessionsToBackup;
  }

  /**
   * Restore sessions from a backup
   */
  async restore(
    store: SessionStore,
    sessions: Session[],
    options: {
      overwrite?: boolean;
      skipExpired?: boolean;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<{
    restored: number;
    skipped: number;
    failed: number;
    errors: Array<{ sessionId: string; error: string }>;
  }> {
    const { overwrite = false, skipExpired = true, onProgress } = options;
    
    this.logger.info({ sessionCount: sessions.length }, 'Restoring sessions from backup');

    const stats = {
      restored: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ sessionId: string; error: string }>
    };

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      
      try {
        // Skip expired sessions if requested
        if (skipExpired && session?.data?.expiresAt && new Date(session.data.expiresAt) < new Date()) {
          stats.skipped++;
          continue;
        }

        // Check if session exists
        const exists = session?.id ? await store.exists(session.id) : false;
        
        if (exists && !overwrite) {
          stats.skipped++;
          continue;
        }

        // Restore session
        if (session?.id && session?.data) {
          if (exists) {
            await store.update(session.id, session.data);
          } else {
            await store.create(session.data);
          }
        }
        
        stats.restored++;
      } catch (error) {
        stats.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        stats.errors.push({
          sessionId: session.id,
          error: errorMessage
        });

        this.logger.error({ 
          sessionId: session.id, 
          error: errorMessage 
        }, 'Failed to restore session');
      }

      // Report progress
      if (onProgress) {
        onProgress(i + 1, sessions.length);
      }
    }

    this.logger.info(stats, 'Session restore completed');

    // Audit log
    await logDataAccess('WRITE', 'session/restore', {
      action: 'restore',
      targetStore: store.constructor.name,
      stats
    });

    return stats;
  }
}