/**
 * Session store factory with automatic store selection
 * @module store/session-store-factory
 * @nist cm-6 "Configuration settings"
 * @nist cm-7 "Least functionality"
 * @nist au-3 "Audit logging for store selection"
 */

import type { SessionStore } from './session-store.interface.js';
import { InMemorySessionStore } from './in-memory-session-store.js';
import { RedisSessionStore } from './redis-session-store.js';
import { SessionMigration } from './session-migration.js';
import { SessionStoreMonitor } from './session-monitoring.js';
import { SessionReplicationManager } from './session-replication.js';
import { config } from '../core/config.js';
import { isRedisAvailable } from '../utils/redis-client.js';
import { pino } from 'pino';
import { logDataAccess } from '../utils/logger.js';

/**
 * Session store factory configuration
 */
export interface SessionStoreFactoryConfig {
  /**
   * Preferred store type
   */
  preferredStore?: 'memory' | 'redis' | 'auto';
  
  /**
   * Enable monitoring
   */
  enableMonitoring?: boolean;
  
  /**
   * Enable replication
   */
  enableReplication?: boolean;
  
  /**
   * Enable migration utilities
   */
  enableMigration?: boolean;
  
  /**
   * Logger instance
   */
  logger?: pino.Logger;
  
  /**
   * Monitoring configuration
   */
  monitoringConfig?: {
    healthCheckInterval?: number;
    metricsRetentionPeriod?: number;
    alertThresholds?: {
      maxLatency?: number;
      maxErrorRate?: number;
    };
  };
  
  /**
   * Replication configuration
   */
  replicationConfig?: {
    mode?: 'master-slave' | 'master-master' | 'active-passive';
    syncInterval?: number;
    conflictResolution?: 'last-write-wins' | 'oldest-wins' | 'manual';
  };
}

/**
 * Session store factory result
 */
export interface SessionStoreFactoryResult {
  store: SessionStore;
  type: 'memory' | 'redis';
  monitor?: SessionStoreMonitor;
  replication?: SessionReplicationManager;
  migration?: SessionMigration;
  metadata: {
    createdAt: Date;
    config: SessionStoreFactoryConfig;
    redisAvailable: boolean;
    fallbackReason?: string;
  };
}

/**
 * Session store factory class
 */
export class SessionStoreFactory {
  private logger: pino.Logger;
  private instances: Map<string, SessionStoreFactoryResult> = new Map();

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino({ level: 'info' });
  }

  /**
   * Create a session store with automatic selection
   */
  async create(
    instanceId: string = 'default',
    factoryConfig: SessionStoreFactoryConfig = {}
  ): Promise<SessionStoreFactoryResult> {
    // Check if instance already exists
    if (this.instances.has(instanceId)) {
      throw new Error(`Session store instance '${instanceId}' already exists`);
    }

    const {
      preferredStore = config.SESSION_STORE_TYPE,
      enableMonitoring = config.SESSION_STORE_MONITORING_ENABLED,
      enableReplication = config.SESSION_STORE_REPLICATION_ENABLED,
      enableMigration = config.SESSION_STORE_MIGRATION_ENABLED,
      logger = this.logger,
      monitoringConfig = {},
      replicationConfig = {}
    } = factoryConfig;

    const redisAvailable = isRedisAvailable();
    let selectedStore: SessionStore;
    let storeType: 'memory' | 'redis';
    let fallbackReason: string | undefined;

    // Determine which store to use
    if (preferredStore === 'redis' && redisAvailable) {
      selectedStore = new RedisSessionStore(logger);
      storeType = 'redis';
      this.logger.info('Using Redis session store');
    } else if (preferredStore === 'memory') {
      selectedStore = new InMemorySessionStore(logger);
      storeType = 'memory';
      this.logger.info('Using in-memory session store');
    } else if (preferredStore === 'auto') {
      if (redisAvailable) {
        selectedStore = new RedisSessionStore(logger);
        storeType = 'redis';
        this.logger.info('Auto-selected Redis session store');
      } else {
        selectedStore = new InMemorySessionStore(logger);
        storeType = 'memory';
        fallbackReason = 'Redis not available';
        this.logger.info('Auto-selected in-memory session store (Redis not available)');
      }
    } else {
      // Fallback to in-memory if Redis is requested but not available
      selectedStore = new InMemorySessionStore(logger);
      storeType = 'memory';
      fallbackReason = `Requested ${preferredStore} store but Redis not available`;
      this.logger.warn(`Falling back to in-memory store: ${fallbackReason}`);
    }

    // Create monitoring if enabled
    let monitor: SessionStoreMonitor | undefined;
    if (enableMonitoring) {
      monitor = new SessionStoreMonitor(selectedStore, {
        healthCheckInterval: monitoringConfig.healthCheckInterval,
        metricsRetentionPeriod: monitoringConfig.metricsRetentionPeriod,
        alertThresholds: monitoringConfig.alertThresholds ? {
          maxLatency: monitoringConfig.alertThresholds.maxLatency || 1000,
          maxErrorRate: monitoringConfig.alertThresholds.maxErrorRate || 0.05,
          maxFallbackTime: 300000,
          minAvailability: 0.99
        } : undefined,
        enableDetailedMetrics: true,
        enableAlerting: true
      }, logger);

      await monitor.start();
      this.logger.info('Session store monitoring enabled');
    }

    // Create replication if enabled
    let replication: SessionReplicationManager | undefined;
    if (enableReplication) {
      replication = new SessionReplicationManager(selectedStore, {
        mode: replicationConfig.mode,
        syncInterval: replicationConfig.syncInterval,
        conflictResolution: replicationConfig.conflictResolution,
        syncDeletions: true,
        syncExpired: false,
        maxRetries: config.REDIS_MAX_RETRIES,
        retryDelay: config.REDIS_RETRY_DELAY
      }, logger);

      this.logger.info('Session store replication enabled');
    }

    // Create migration utilities if enabled
    let migration: SessionMigration | undefined;
    if (enableMigration) {
      migration = new SessionMigration(logger);
      this.logger.info('Session store migration utilities enabled');
    }

    const result: SessionStoreFactoryResult = {
      store: selectedStore,
      type: storeType,
      monitor,
      replication,
      migration,
      metadata: {
        createdAt: new Date(),
        config: factoryConfig,
        redisAvailable,
        fallbackReason
      }
    };

    // Store instance
    this.instances.set(instanceId, result);

    // Audit log
    await logDataAccess('WRITE', `session-store/${instanceId}`, {
      action: 'create',
      instanceId,
      storeType,
      redisAvailable,
      fallbackReason,
      enableMonitoring,
      enableReplication,
      enableMigration
    });

    this.logger.info({
      instanceId,
      storeType,
      redisAvailable,
      fallbackReason,
      enableMonitoring,
      enableReplication,
      enableMigration
    }, 'Session store created');

    return result;
  }

  /**
   * Get an existing session store instance
   */
  get(instanceId: string = 'default'): SessionStoreFactoryResult | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * List all session store instances
   */
  list(): Array<{ instanceId: string; result: SessionStoreFactoryResult }> {
    return Array.from(this.instances.entries()).map(([instanceId, result]) => ({
      instanceId,
      result
    }));
  }

  /**
   * Destroy a session store instance
   */
  async destroy(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Session store instance '${instanceId}' not found`);
    }

    // Clean up monitoring
    if (instance.monitor) {
      await instance.monitor.destroy();
    }

    // Clean up replication
    if (instance.replication) {
      await instance.replication.destroy();
    }

    // Clean up store
    if (instance.store.constructor.name === 'RedisSessionStore') {
      await (instance.store as any).destroy();
    } else if (instance.store.constructor.name === 'InMemorySessionStore') {
      await (instance.store as any).destroy();
    }

    // Remove from instances
    this.instances.delete(instanceId);

    // Audit log
    await logDataAccess('DELETE', `session-store/${instanceId}`, {
      action: 'destroy',
      instanceId,
      storeType: instance.type
    });

    this.logger.info({ instanceId, storeType: instance.type }, 'Session store destroyed');
  }

  /**
   * Destroy all session store instances
   */
  async destroyAll(): Promise<void> {
    const instanceIds = Array.from(this.instances.keys());
    
    await Promise.all(instanceIds.map(id => this.destroy(id)));
    
    this.logger.info({ count: instanceIds.length }, 'All session stores destroyed');
  }

  /**
   * Migrate sessions between stores
   */
  async migrate(
    fromInstanceId: string,
    toInstanceId: string,
    options: {
      skipExisting?: boolean;
      deleteAfterMigration?: boolean;
      batchSize?: number;
      continueOnError?: boolean;
    } = {}
  ): Promise<{
    totalSessions: number;
    migratedSessions: number;
    failedSessions: number;
    skippedSessions: number;
    duration: number;
  }> {
    const fromInstance = this.instances.get(fromInstanceId);
    const toInstance = this.instances.get(toInstanceId);

    if (!fromInstance) {
      throw new Error(`Source session store '${fromInstanceId}' not found`);
    }

    if (!toInstance) {
      throw new Error(`Target session store '${toInstanceId}' not found`);
    }

    if (!fromInstance.migration) {
      throw new Error(`Migration not enabled for source store '${fromInstanceId}'`);
    }

    this.logger.info({
      fromInstanceId,
      toInstanceId,
      fromType: fromInstance.type,
      toType: toInstance.type
    }, 'Starting session migration');

    const stats = await fromInstance.migration.migrate(
      fromInstance.store,
      toInstance.store,
      options
    );

    this.logger.info({
      fromInstanceId,
      toInstanceId,
      ...stats
    }, 'Session migration completed');

    return stats;
  }

  /**
   * Get health status of all session stores
   */
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    instances: Array<{
      instanceId: string;
      type: 'memory' | 'redis';
      status: 'healthy' | 'degraded' | 'unhealthy';
      monitor?: any;
      replication?: any;
    }>;
  }> {
    const instances = await Promise.all(
      Array.from(this.instances.entries()).map(async ([instanceId, instance]) => {
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        let monitorHealth;
        let replicationHealth;

        // Get monitoring health
        if (instance.monitor) {
          const healthCheck = await instance.monitor.performHealthCheck();
          monitorHealth = healthCheck;
          status = healthCheck.status;
        }

        // Get replication health
        if (instance.replication) {
          replicationHealth = await instance.replication.getHealth();
          
          // Adjust status based on replication health
          if (!replicationHealth.primary.available) {
            status = 'unhealthy';
          } else if (replicationHealth.replicas.some(r => !r.available)) {
            if (status === 'healthy') {
              status = 'degraded';
            }
          }
        }

        return {
          instanceId,
          type: instance.type,
          status,
          monitor: monitorHealth,
          replication: replicationHealth
        };
      })
    );

    // Determine overall status
    const unhealthyCount = instances.filter(i => i.status === 'unhealthy').length;
    const degradedCount = instances.filter(i => i.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      instances
    };
  }

  /**
   * Get factory status
   */
  getStatus(): {
    instanceCount: number;
    redisAvailable: boolean;
    config: {
      defaultStoreType: string;
      monitoringEnabled: boolean;
      replicationEnabled: boolean;
      migrationEnabled: boolean;
    };
    instances: Array<{
      instanceId: string;
      type: 'memory' | 'redis';
      createdAt: Date;
      enabledFeatures: string[];
    }>;
  } {
    const instances = Array.from(this.instances.entries()).map(([instanceId, instance]) => ({
      instanceId,
      type: instance.type,
      createdAt: instance.metadata.createdAt,
      enabledFeatures: [
        instance.monitor ? 'monitoring' : null,
        instance.replication ? 'replication' : null,
        instance.migration ? 'migration' : null
      ].filter(Boolean) as string[]
    }));

    return {
      instanceCount: this.instances.size,
      redisAvailable: isRedisAvailable(),
      config: {
        defaultStoreType: config.SESSION_STORE_TYPE,
        monitoringEnabled: config.SESSION_STORE_MONITORING_ENABLED,
        replicationEnabled: config.SESSION_STORE_REPLICATION_ENABLED,
        migrationEnabled: config.SESSION_STORE_MIGRATION_ENABLED
      },
      instances
    };
  }

  /**
   * Switch store type for an instance
   */
  async switchStoreType(
    instanceId: string,
    newType: 'memory' | 'redis',
    options: {
      migrateData?: boolean;
      skipExisting?: boolean;
      deleteAfterMigration?: boolean;
    } = {}
  ): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Session store instance '${instanceId}' not found`);
    }

    if (instance.type === newType) {
      this.logger.info({ instanceId, type: newType }, 'Store type already matches, no action needed');
      return;
    }

    if (newType === 'redis' && !isRedisAvailable()) {
      throw new Error('Cannot switch to Redis store: Redis not available');
    }

    this.logger.info({
      instanceId,
      fromType: instance.type,
      toType: newType
    }, 'Switching store type');

    // Create new store
    const newStore = newType === 'redis' 
      ? new RedisSessionStore(this.logger)
      : new InMemorySessionStore(this.logger);

    // Migrate data if requested
    if (options.migrateData && instance.migration) {
      await instance.migration.migrate(instance.store, newStore, {
        skipExisting: options.skipExisting,
        deleteAfterMigration: options.deleteAfterMigration
      });
    }

    // Clean up old store
    if (instance.store.constructor.name === 'RedisSessionStore') {
      await (instance.store as any).destroy();
    } else if (instance.store.constructor.name === 'InMemorySessionStore') {
      await (instance.store as any).destroy();
    }

    // Update instance
    instance.store = newStore;
    instance.type = newType;

    // Update monitoring if enabled
    if (instance.monitor) {
      await instance.monitor.destroy();
      instance.monitor = new SessionStoreMonitor(newStore, {
        healthCheckInterval: 30000,
        metricsRetentionPeriod: 24 * 60 * 60 * 1000,
        enableDetailedMetrics: true,
        enableAlerting: true
      }, this.logger);
      await instance.monitor.start();
    }

    // Update replication if enabled
    if (instance.replication) {
      await instance.replication.destroy();
      instance.replication = new SessionReplicationManager(newStore, {
        maxRetries: config.REDIS_MAX_RETRIES,
        retryDelay: config.REDIS_RETRY_DELAY
      }, this.logger);
    }

    // Audit log
    await logDataAccess('WRITE', `session-store/${instanceId}`, {
      action: 'switch-type',
      instanceId,
      fromType: instance.type === 'redis' ? 'memory' : 'redis',
      toType: newType,
      migrateData: options.migrateData
    });

    this.logger.info({
      instanceId,
      newType,
      migrateData: options.migrateData
    }, 'Store type switched successfully');
  }

  /**
   * Create a backup of all session data
   */
  async createBackup(instanceId: string): Promise<{
    instanceId: string;
    storeType: 'memory' | 'redis';
    sessionCount: number;
    createdAt: Date;
    data: Array<any>;
  }> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Session store instance '${instanceId}' not found`);
    }

    if (!instance.migration) {
      throw new Error(`Migration not enabled for store '${instanceId}'`);
    }

    const sessions = await instance.migration.backup(instance.store);

    const backup = {
      instanceId,
      storeType: instance.type,
      sessionCount: sessions.length,
      createdAt: new Date(),
      data: sessions
    };

    this.logger.info({
      instanceId,
      storeType: instance.type,
      sessionCount: sessions.length
    }, 'Session backup created');

    return backup;
  }

  /**
   * Restore sessions from a backup
   */
  async restoreBackup(
    instanceId: string,
    backup: {
      data: Array<any>;
      sessionCount: number;
    },
    options: {
      overwrite?: boolean;
      skipExpired?: boolean;
    } = {}
  ): Promise<{
    restored: number;
    skipped: number;
    failed: number;
  }> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Session store instance '${instanceId}' not found`);
    }

    if (!instance.migration) {
      throw new Error(`Migration not enabled for store '${instanceId}'`);
    }

    const stats = await instance.migration.restore(instance.store, backup.data, options);

    this.logger.info({
      instanceId,
      ...stats
    }, 'Session backup restored');

    return stats;
  }

  /**
   * Clean up factory resources
   */
  async cleanup(): Promise<void> {
    await this.destroyAll();
    this.logger.info('Session store factory destroyed');
  }
}

/**
 * Create a default session store factory instance
 * Note: Create new instances in tests to avoid shared state
 */
export const createDefaultSessionStoreFactory = (): SessionStoreFactory => {
  return new SessionStoreFactory();
};