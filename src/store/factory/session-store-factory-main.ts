/**
 * Session store factory with automatic store selection - Main implementation
 * @module store/factory/session-store-factory-main
 * @nist cm-6 "Configuration settings"
 * @nist cm-7 "Least functionality"
 * @nist au-3 "Audit logging for store selection"
 */

import type {
  SessionStoreFactoryConfig,
  SessionStoreFactoryResult,
  MigrationStats,
  HealthStatus,
  BackupResult,
  RestoreStats,
} from './types.js';
import { StoreCreationCommand } from './store-creation-command.js';
import { StoreSwitchManager } from './store-switch-manager.js';
import { BackupRestoreManager } from './backup-restore-manager.js';
import { HealthStatusManager } from './health-status-manager.js';
import { logDataAccess } from '../../utils/logger.js';
import { pino } from 'pino';

/**
 * Session store factory class
 */
export class SessionStoreFactory {
  private logger: pino.Logger;
  private instances: Map<string, SessionStoreFactoryResult> = new Map();
  private storeSwitchManager: StoreSwitchManager;
  private backupRestoreManager: BackupRestoreManager;
  private healthStatusManager: HealthStatusManager;

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino({ level: 'info' });
    this.storeSwitchManager = new StoreSwitchManager(this.logger);
    this.backupRestoreManager = new BackupRestoreManager(this.logger);
    this.healthStatusManager = new HealthStatusManager();
  }

  /**
   * Create a session store with automatic selection
   */
  async create(
    instanceId: string = 'default',
    factoryConfig: SessionStoreFactoryConfig = {},
  ): Promise<SessionStoreFactoryResult> {
    const command = new StoreCreationCommand(
      instanceId,
      factoryConfig,
      this.logger,
      this.instances,
    );

    return command.execute();
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
      result,
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

    await this.cleanupInstance(instance);
    this.instances.delete(instanceId);
    await this.logDestroy(instanceId, instance);
  }

  /**
   * Destroy all session store instances
   */
  async destroyAll(): Promise<void> {
    const instanceIds = Array.from(this.instances.keys());

    await Promise.all(instanceIds.map((id) => this.destroy(id)));

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
    } = {},
  ): Promise<MigrationStats> {
    const { fromInstance, toInstance } = this.validateMigrationInstances(
      fromInstanceId,
      toInstanceId,
    );

    this.logger.info(
      {
        fromInstanceId,
        toInstanceId,
        fromType: fromInstance.type,
        toType: toInstance.type,
      },
      'Starting session migration',
    );

    const stats = await fromInstance.migration!.migrate(
      fromInstance.store,
      toInstance.store,
      options,
    );

    this.logger.info(
      {
        fromInstanceId,
        toInstanceId,
        ...stats,
      },
      'Session migration completed',
    );

    return stats;
  }

  /**
   * Get health status of all session stores
   */
  async getHealthStatus(): Promise<HealthStatus> {
    return this.healthStatusManager.getHealthStatus(this.instances);
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
    return this.healthStatusManager.getStatus(this.instances);
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
    } = {},
  ): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Session store instance '${instanceId}' not found`);
    }

    await this.storeSwitchManager.switchStoreType(instanceId, instance, newType, options);
  }

  /**
   * Create a backup of all session data
   */
  async createBackup(instanceId: string): Promise<BackupResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Session store instance '${instanceId}' not found`);
    }

    return this.backupRestoreManager.createBackup(instanceId, instance);
  }

  /**
   * Restore sessions from a backup
   */
  async restoreBackup(
    instanceId: string,
    backup: {
      data: Array<unknown>;
      sessionCount: number;
    },
    options: {
      overwrite?: boolean;
      skipExpired?: boolean;
    } = {},
  ): Promise<RestoreStats> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Session store instance '${instanceId}' not found`);
    }

    return this.backupRestoreManager.restoreBackup(instanceId, instance, backup, options);
  }

  /**
   * Clean up factory resources
   */
  async cleanup(): Promise<void> {
    await this.destroyAll();
    this.logger.info('Session store factory destroyed');
  }

  // Private helper methods

  private async cleanupInstance(instance: SessionStoreFactoryResult): Promise<void> {
    // Clean up monitoring
    if (instance.monitor) {
      await instance.monitor.destroy();
    }

    // Clean up replication
    if (instance.replication) {
      await instance.replication.destroy();
    }

    // Clean up store
    const storeName = instance.store.constructor.name;
    if (storeName === 'RedisSessionStore' || storeName === 'InMemorySessionStore') {
      await (instance.store as unknown as { destroy(): Promise<void> }).destroy();
    }
  }

  private async logDestroy(instanceId: string, instance: SessionStoreFactoryResult): Promise<void> {
    await logDataAccess('DELETE', `session-store/${instanceId}`, {
      action: 'destroy',
      instanceId,
      storeType: instance.type,
    });

    this.logger.info({ instanceId, storeType: instance.type }, 'Session store destroyed');
  }

  private validateMigrationInstances(
    fromInstanceId: string,
    toInstanceId: string,
  ): {
    fromInstance: SessionStoreFactoryResult;
    toInstance: SessionStoreFactoryResult;
  } {
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

    return { fromInstance, toInstance };
  }
}

/**
 * Create a default session store factory instance
 * Note: Create new instances in tests to avoid shared state
 */
export const createDefaultSessionStoreFactory = (): SessionStoreFactory => {
  return new SessionStoreFactory();
};
