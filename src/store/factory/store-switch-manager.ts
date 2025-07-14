/**
 * Store switching manager for handling store type changes
 * @module store/factory/store-switch-manager
 * @nist cm-6 "Configuration settings"
 * @nist au-3 "Audit logging for store switching"
 */

import type { SessionStore } from '../session-store.interface.js';
import type { SessionStoreFactoryResult } from './types.js';
import { InMemorySessionStore } from '../in-memory-session-store.js';
import { RedisSessionStore } from '../redis-session-store.js';
import { SessionStoreMonitor } from '../session-monitoring.js';
import { SessionReplicationManager } from '../session-replication.js';
import { isRedisAvailable } from '../../utils/redis-client.js';
import { logDataAccess } from '../../utils/logger.js';
import { config } from '../../core/config.js';
import type { pino } from 'pino';

/**
 * Options for store switching
 */
export interface StoreSwitchOptions {
  migrateData?: boolean;
  skipExisting?: boolean;
  deleteAfterMigration?: boolean;
}

/**
 * Store switching manager for handling store type changes
 */
export class StoreSwitchManager {
  constructor(private logger: pino.Logger) {}

  /**
   * Switch store type for an instance
   */
  async switchStoreType(
    instanceId: string,
    instance: SessionStoreFactoryResult,
    newType: 'memory' | 'redis',
    options: StoreSwitchOptions = {},
  ): Promise<void> {
    this.validateSwitchRequest(instanceId, instance, newType);

    const newStore = this.createNewStore(newType);
    await this.migrateDataIfRequested(instance, newStore, options);
    await this.cleanupOldStore(instance.store);
    this.updateInstanceStore(instance, newStore, newType);
    await this.updateComponents(instance, newStore);
    await this.logSwitch(instanceId, instance.type, newType, options);
  }

  private validateSwitchRequest(
    instanceId: string,
    instance: SessionStoreFactoryResult,
    newType: 'memory' | 'redis',
  ): void {
    if (instance.type === newType) {
      this.logger.debug(
        { instanceId, type: newType },
        'Store type already matches, no action needed',
      );
      return;
    }

    if (newType === 'redis' && !isRedisAvailable()) {
      throw new Error('Cannot switch to Redis store: Redis not available');
    }

    this.logger.debug(
      {
        instanceId,
        fromType: instance.type,
        toType: newType,
      },
      'Switching store type',
    );
  }

  private createNewStore(newType: 'memory' | 'redis'): SessionStore {
    return newType === 'redis'
      ? new RedisSessionStore(this.logger)
      : new InMemorySessionStore(this.logger);
  }

  private async migrateDataIfRequested(
    instance: SessionStoreFactoryResult,
    newStore: SessionStore,
    options: StoreSwitchOptions,
  ): Promise<void> {
    if (options.migrateData && instance.migration) {
      await instance.migration.migrate(instance.store, newStore, {
        skipExisting: options.skipExisting,
        deleteAfterMigration: options.deleteAfterMigration,
      });
    }
  }

  private async cleanupOldStore(store: SessionStore): Promise<void> {
    const storeName = store.constructor.name;
    if (storeName === 'RedisSessionStore' || storeName === 'InMemorySessionStore') {
      await (store as unknown as { destroy(): Promise<void> }).destroy();
    }
  }

  private updateInstanceStore(
    instance: SessionStoreFactoryResult,
    newStore: SessionStore,
    newType: 'memory' | 'redis',
  ): void {
    instance.store = newStore;
    instance.type = newType;
  }

  private async updateComponents(
    instance: SessionStoreFactoryResult,
    newStore: SessionStore,
  ): Promise<void> {
    await this.updateMonitoring(instance, newStore);
    await this.updateReplication(instance, newStore);
  }

  private async updateMonitoring(
    instance: SessionStoreFactoryResult,
    newStore: SessionStore,
  ): Promise<void> {
    if (!instance.monitor) {
      return;
    }

    await instance.monitor.destroy();
    instance.monitor = new SessionStoreMonitor(
      newStore,
      {
        healthCheckInterval: 30000,
        metricsRetentionPeriod: 24 * 60 * 60 * 1000,
        enableDetailedMetrics: true,
        enableAlerting: true,
      },
      this.logger,
    );
    await instance.monitor.start();
  }

  private async updateReplication(
    instance: SessionStoreFactoryResult,
    newStore: SessionStore,
  ): Promise<void> {
    if (!instance.replication) {
      return;
    }

    await instance.replication.destroy();
    instance.replication = new SessionReplicationManager(
      newStore,
      {
        maxRetries: config.REDIS_MAX_RETRIES,
        retryDelay: config.REDIS_RETRY_DELAY,
      },
      this.logger,
    );
  }

  private async logSwitch(
    instanceId: string,
    fromType: 'memory' | 'redis',
    toType: 'memory' | 'redis',
    options: StoreSwitchOptions,
  ): Promise<void> {
    await logDataAccess('WRITE', `session-store/${instanceId}`, {
      action: 'switch-type',
      instanceId,
      fromType,
      toType,
      migrateData: options.migrateData,
    });

    this.logger.debug(
      {
        instanceId,
        newType: toType,
        migrateData: options.migrateData,
      },
      'Store type switched successfully',
    );
  }
}
