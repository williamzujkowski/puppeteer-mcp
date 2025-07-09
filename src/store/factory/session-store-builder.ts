/**
 * Session store builder for constructing factory results
 * @module store/factory/session-store-builder
 * @nist cm-6 "Configuration settings"
 */

import type { SessionStore } from '../session-store.interface.js';
import type { SessionStoreMonitor } from '../session-monitoring.js';
import type { SessionReplicationManager } from '../session-replication.js';
import type { SessionMigration } from '../session-migration.js';
import type { SessionStoreFactoryConfig, SessionStoreFactoryResult } from './types.js';

/**
 * Session store builder for constructing the final result
 */
export class SessionStoreBuilder {
  private store?: SessionStore;
  private type?: 'memory' | 'redis';
  private monitor?: SessionStoreMonitor;
  private replication?: SessionReplicationManager;
  private migration?: SessionMigration;
  private metadata: Partial<SessionStoreFactoryResult['metadata']> = {};

  withStore(store: SessionStore, type: 'memory' | 'redis', fallbackReason?: string): this {
    this.store = store;
    this.type = type;
    this.metadata.fallbackReason = fallbackReason;
    return this;
  }

  withMonitoring(monitor: SessionStoreMonitor | undefined): this {
    this.monitor = monitor;
    return this;
  }

  withReplication(replication: SessionReplicationManager | undefined): this {
    this.replication = replication;
    return this;
  }

  withMigration(migration: SessionMigration | undefined): this {
    this.migration = migration;
    return this;
  }

  withMetadata(config: SessionStoreFactoryConfig, redisAvailable: boolean): this {
    this.metadata = {
      ...this.metadata,
      createdAt: new Date(),
      config,
      redisAvailable
    };
    return this;
  }

  build(): SessionStoreFactoryResult {
    if (!this.store || !this.type || !this.metadata.createdAt) {
      throw new Error('Builder not properly configured');
    }

    return {
      store: this.store,
      type: this.type,
      monitor: this.monitor,
      replication: this.replication,
      migration: this.migration,
      metadata: this.metadata as SessionStoreFactoryResult['metadata']
    };
  }
}