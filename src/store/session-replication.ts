/**
 * Session replication and synchronization features
 * @module store/session-replication
 * @nist sc-28 "Protection of information at rest"
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist au-3 "Audit logging for replication operations"
 */

import type { SessionStore } from './session-store.interface.js';
import type { Session, SessionData } from '../types/session.js';
import { pino } from 'pino';
import { logDataAccess } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * Replication event types
 */
export interface ReplicationEvents {
  'session:created': (session: Session) => void;
  'session:updated': (session: Session) => void;
  'session:deleted': (sessionId: string) => void;
  'session:touched': (sessionId: string) => void;
  'sync:started': () => void;
  'sync:completed': (stats: SyncStats) => void;
  'sync:failed': (error: Error) => void;
  'replica:connected': (replicaId: string) => void;
  'replica:disconnected': (replicaId: string) => void;
  'replica:error': (replicaId: string, error: Error) => void;
}

/**
 * Synchronization statistics
 */
export interface SyncStats {
  startTime: number;
  endTime: number;
  duration: number;
  syncedSessions: number;
  failedSessions: number;
  skippedSessions: number;
  conflicts: number;
  errors: Array<{
    sessionId: string;
    error: string;
  }>;
}

/**
 * Replication configuration
 */
export interface ReplicationConfig {
  /**
   * Replication mode
   */
  mode: 'master-slave' | 'master-master' | 'active-passive';
  
  /**
   * Sync interval in milliseconds
   */
  syncInterval: number;
  
  /**
   * Batch size for synchronization
   */
  batchSize: number;
  
  /**
   * Conflict resolution strategy
   */
  conflictResolution: 'last-write-wins' | 'oldest-wins' | 'manual';
  
  /**
   * Whether to sync deletions
   */
  syncDeletions: boolean;
  
  /**
   * Whether to sync expired sessions
   */
  syncExpired: boolean;
  
  /**
   * Maximum retry attempts for failed operations
   */
  maxRetries: number;
  
  /**
   * Retry delay in milliseconds
   */
  retryDelay: number;
}

/**
 * Replica store information
 */
export interface ReplicaInfo {
  id: string;
  store: SessionStore;
  isActive: boolean;
  lastSync: Date | null;
  syncErrors: number;
  config: Partial<ReplicationConfig>;
}

/**
 * Session replication manager
 */
export class SessionReplicationManager extends EventEmitter {
  private logger: pino.Logger;
  private primaryStore: SessionStore;
  private replicas: Map<string, ReplicaInfo> = new Map();
  private syncInterval?: NodeJS.Timeout;
  private config: ReplicationConfig;
  private isRunning = false;

  constructor(
    primaryStore: SessionStore,
    config: Partial<ReplicationConfig> = {},
    logger?: pino.Logger
  ) {
    super();
    this.logger = logger ?? pino({ level: 'info' });
    this.primaryStore = primaryStore;
    
    this.config = {
      mode: 'master-slave',
      syncInterval: 30000, // 30 seconds
      batchSize: 100,
      conflictResolution: 'last-write-wins',
      syncDeletions: true,
      syncExpired: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };

    this.setupEventHandlers();
  }

  /**
   * Set up event handlers for the primary store
   */
  private setupEventHandlers(): void {
    // Note: This assumes the stores emit events. In a real implementation,
    // you might need to wrap the stores or use a different approach.
    
    this.on('session:created', (session: Session) => {
      void this.replicateCreate(session);
    });

    this.on('session:updated', (session: Session) => {
      void this.replicateUpdate(session);
    });

    this.on('session:deleted', (sessionId: string) => {
      void this.replicateDelete(sessionId);
    });

    this.on('session:touched', (sessionId: string) => {
      void this.replicateTouch(sessionId);
    });
  }

  /**
   * Add a replica store
   */
  async addReplica(
    id: string,
    store: SessionStore,
    config: Partial<ReplicationConfig> = {}
  ): Promise<void> {
    if (this.replicas.has(id)) {
      throw new Error(`Replica with id ${id} already exists`);
    }

    const replicaInfo: ReplicaInfo = {
      id,
      store,
      isActive: true,
      lastSync: null,
      syncErrors: 0,
      config
    };

    this.replicas.set(id, replicaInfo);
    this.emit('replica:connected', id);
    
    this.logger.info({ replicaId: id }, 'Replica added');

    // Initial sync
    await this.syncReplica(id);
  }

  /**
   * Remove a replica store
   */
  async removeReplica(id: string): Promise<void> {
    const replica = this.replicas.get(id);
    if (!replica) {
      throw new Error(`Replica with id ${id} not found`);
    }

    this.replicas.delete(id);
    this.emit('replica:disconnected', id);
    
    this.logger.info({ replicaId: id }, 'Replica removed');
  }

  /**
   * Start replication
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Start periodic sync
    this.syncInterval = setInterval(() => {
      void this.syncAll();
    }, this.config.syncInterval);

    // Don't keep the process alive
    this.syncInterval.unref();

    this.logger.info('Session replication started');
  }

  /**
   * Stop replication
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    this.logger.info('Session replication stopped');
  }

  /**
   * Sync all replicas
   */
  async syncAll(): Promise<void> {
    const replicaIds = Array.from(this.replicas.keys());
    
    this.logger.debug({ replicaCount: replicaIds.length }, 'Starting sync for all replicas');

    await Promise.all(replicaIds.map(id => this.syncReplica(id)));
  }

  /**
   * Sync a specific replica
   */
  async syncReplica(replicaId: string): Promise<SyncStats> {
    const replica = this.replicas.get(replicaId);
    if (!replica) {
      throw new Error(`Replica with id ${replicaId} not found`);
    }

    const stats: SyncStats = {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      syncedSessions: 0,
      failedSessions: 0,
      skippedSessions: 0,
      conflicts: 0,
      errors: []
    };

    try {
      this.emit('sync:started');
      
      this.logger.debug({ replicaId }, 'Starting replica sync');

      // Get all sessions from primary store
      const primarySessions = await this.getAllSessions(this.primaryStore);
      
      // Process sessions in batches
      for (let i = 0; i < primarySessions.length; i += this.config.batchSize) {
        const batch = primarySessions.slice(i, i + this.config.batchSize);
        
        await this.processSyncBatch(replica, batch, stats);
      }

      replica.lastSync = new Date();
      replica.syncErrors = 0;
      replica.isActive = true;

      stats.endTime = Date.now();
      stats.duration = stats.endTime - stats.startTime;

      this.logger.info({
        replicaId,
        synced: stats.syncedSessions,
        failed: stats.failedSessions,
        skipped: stats.skippedSessions,
        conflicts: stats.conflicts,
        duration: stats.duration
      }, 'Replica sync completed');

      this.emit('sync:completed', stats);

      // Audit log
      await logDataAccess('WRITE', `session/sync/${replicaId}`, {
        action: 'sync',
        replicaId,
        stats
      });

      return stats;
    } catch (error) {
      replica.syncErrors++;
      replica.isActive = false;
      
      stats.endTime = Date.now();
      stats.duration = stats.endTime - stats.startTime;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ replicaId, error: errorMessage }, 'Replica sync failed');

      this.emit('replica:error', replicaId, error instanceof Error ? error : new Error(errorMessage));
      this.emit('sync:failed', error instanceof Error ? error : new Error(errorMessage));

      throw error;
    }
  }

  /**
   * Process a batch of sessions for synchronization
   */
  private async processSyncBatch(
    replica: ReplicaInfo,
    sessions: Session[],
    stats: SyncStats
  ): Promise<void> {
    for (const session of sessions) {
      try {
        // Skip expired sessions if configured
        if (!this.config.syncExpired && new Date(session.data.expiresAt) < new Date()) {
          stats.skippedSessions++;
          continue;
        }

        // Check if session exists in replica
        const replicaSession = await replica.store.get(session.id);
        
        if (replicaSession) {
          // Handle conflict resolution
          const shouldUpdate = await this.resolveConflict(session, replicaSession);
          
          if (shouldUpdate) {
            await replica.store.update(session.id, session.data);
            stats.syncedSessions++;
          } else {
            stats.conflicts++;
          }
        } else {
          // Create new session in replica
          await replica.store.create(session.data);
          stats.syncedSessions++;
        }
      } catch (error) {
        stats.failedSessions++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        stats.errors.push({
          sessionId: session.id,
          error: errorMessage
        });

        this.logger.error({
          replicaId: replica.id,
          sessionId: session.id,
          error: errorMessage
        }, 'Failed to sync session');
      }
    }
  }

  /**
   * Resolve conflicts between primary and replica sessions
   */
  private async resolveConflict(
    primarySession: Session,
    replicaSession: Session
  ): Promise<boolean> {
    switch (this.config.conflictResolution) {
      case 'last-write-wins':
        return new Date(primarySession.lastAccessedAt) > new Date(replicaSession.lastAccessedAt);
      
      case 'oldest-wins':
        return new Date(primarySession.data.createdAt) < new Date(replicaSession.data.createdAt);
      
      case 'manual':
        // In manual mode, we don't update automatically
        this.logger.warn({
          sessionId: primarySession.id,
          primaryLastAccessed: primarySession.lastAccessedAt,
          replicaLastAccessed: replicaSession.lastAccessedAt
        }, 'Manual conflict resolution required');
        return false;
      
      default:
        return true;
    }
  }

  /**
   * Replicate session creation to all replicas
   */
  private async replicateCreate(session: Session): Promise<void> {
    const replicaIds = Array.from(this.replicas.keys());
    
    await Promise.all(replicaIds.map(async (replicaId) => {
      const replica = this.replicas.get(replicaId);
      if (!replica?.isActive) {
        return;
      }

      try {
        await this.retryOperation(
          () => replica.store.create(session.data),
          this.config.maxRetries,
          this.config.retryDelay
        );
        
        this.logger.debug({ replicaId, sessionId: session.id }, 'Session created in replica');
      } catch (error) {
        this.handleReplicaError(replicaId, error);
      }
    }));
  }

  /**
   * Replicate session update to all replicas
   */
  private async replicateUpdate(session: Session): Promise<void> {
    const replicaIds = Array.from(this.replicas.keys());
    
    await Promise.all(replicaIds.map(async (replicaId) => {
      const replica = this.replicas.get(replicaId);
      if (!replica?.isActive) {
        return;
      }

      try {
        await this.retryOperation(
          () => replica.store.update(session.id, session.data),
          this.config.maxRetries,
          this.config.retryDelay
        );
        
        this.logger.debug({ replicaId, sessionId: session.id }, 'Session updated in replica');
      } catch (error) {
        this.handleReplicaError(replicaId, error);
      }
    }));
  }

  /**
   * Replicate session deletion to all replicas
   */
  private async replicateDelete(sessionId: string): Promise<void> {
    if (!this.config.syncDeletions) {
      return;
    }

    const replicaIds = Array.from(this.replicas.keys());
    
    await Promise.all(replicaIds.map(async (replicaId) => {
      const replica = this.replicas.get(replicaId);
      if (!replica?.isActive) {
        return;
      }

      try {
        await this.retryOperation(
          () => replica.store.delete(sessionId),
          this.config.maxRetries,
          this.config.retryDelay
        );
        
        this.logger.debug({ replicaId, sessionId }, 'Session deleted in replica');
      } catch (error) {
        this.handleReplicaError(replicaId, error);
      }
    }));
  }

  /**
   * Replicate session touch to all replicas
   */
  private async replicateTouch(sessionId: string): Promise<void> {
    const replicaIds = Array.from(this.replicas.keys());
    
    await Promise.all(replicaIds.map(async (replicaId) => {
      const replica = this.replicas.get(replicaId);
      if (!replica?.isActive) {
        return;
      }

      try {
        await this.retryOperation(
          () => replica.store.touch(sessionId),
          this.config.maxRetries,
          this.config.retryDelay
        );
        
        this.logger.debug({ replicaId, sessionId }, 'Session touched in replica');
      } catch (error) {
        this.handleReplicaError(replicaId, error);
      }
    }));
  }

  /**
   * Handle replica errors
   */
  private handleReplicaError(replicaId: string, error: unknown): void {
    const replica = this.replicas.get(replicaId);
    if (replica) {
      replica.syncErrors++;
      if (replica.syncErrors >= this.config.maxRetries) {
        replica.isActive = false;
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error({ replicaId, error: errorMessage }, 'Replica operation failed');
    
    this.emit('replica:error', replicaId, error instanceof Error ? error : new Error(errorMessage));
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Get all sessions from a store (utility method)
   */
  private async getAllSessions(store: SessionStore): Promise<Session[]> {
    // This is a simplified implementation. In a real scenario,
    // you might need to implement this differently based on the store type.
    const sessions: Session[] = [];
    
    // For in-memory store
    if (store.constructor.name === 'InMemorySessionStore') {
      const inMemoryStore = store as any;
      if (inMemoryStore.sessions && inMemoryStore.sessions instanceof Map) {
        for (const [, session] of inMemoryStore.sessions) {
          sessions.push(session);
        }
      }
    }
    
    // For Redis store
    else if (store.constructor.name === 'RedisSessionStore') {
      const redisStore = store as any;
      try {
        const { redis, client } = redisStore.getStore();
        if (redis) {
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
    }
    
    return sessions;
  }

  /**
   * Get replication status
   */
  getStatus(): {
    isRunning: boolean;
    config: ReplicationConfig;
    replicas: Array<{
      id: string;
      isActive: boolean;
      lastSync: Date | null;
      syncErrors: number;
    }>;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      replicas: Array.from(this.replicas.values()).map(replica => ({
        id: replica.id,
        isActive: replica.isActive,
        lastSync: replica.lastSync,
        syncErrors: replica.syncErrors
      }))
    };
  }

  /**
   * Get health status of all replicas
   */
  async getHealth(): Promise<{
    primary: { available: boolean; error?: string };
    replicas: Array<{
      id: string;
      available: boolean;
      lastSync: Date | null;
      syncErrors: number;
      error?: string;
    }>;
  }> {
    // Check primary store health
    let primaryHealth = { available: true };
    
    try {
      // Simple health check - try to create and delete a test session
      const testSessionData: SessionData = {
        userId: 'health-check',
        username: 'health-check',
        roles: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000).toISOString()
      };
      
      const testId = await this.primaryStore.create(testSessionData);
      await this.primaryStore.delete(testId);
    } catch (error) {
      primaryHealth = {
        available: false
      };
    }

    // Check replica health
    const replicasHealth = await Promise.all(
      Array.from(this.replicas.values()).map(async (replica) => {
        try {
          const testSessionData: SessionData = {
            userId: 'health-check',
            username: 'health-check',
            roles: [],
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 1000).toISOString()
          };
          
          const testId = await replica.store.create(testSessionData);
          await replica.store.delete(testId);
          
          return {
            id: replica.id,
            available: true,
            lastSync: replica.lastSync,
            syncErrors: replica.syncErrors
          };
        } catch (error) {
          return {
            id: replica.id,
            available: false,
            lastSync: replica.lastSync,
            syncErrors: replica.syncErrors,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    return {
      primary: primaryHealth,
      replicas: replicasHealth
    };
  }

  /**
   * Force sync all replicas
   */
  async forceSyncAll(): Promise<SyncStats[]> {
    const replicaIds = Array.from(this.replicas.keys());
    
    this.logger.info({ replicaCount: replicaIds.length }, 'Starting forced sync for all replicas');

    return Promise.all(replicaIds.map(id => this.syncReplica(id)));
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
    this.replicas.clear();
    this.logger.info('Session replication manager destroyed');
  }
}