/**
 * Component factory manager for creating monitoring, replication, and migration components
 * @module store/factory/component-factory-manager
 * @nist cm-6 "Configuration settings"
 */

import type { SessionStore } from '../session-store.interface.js';
import { SessionStoreMonitor } from '../session-monitoring.js';
import { SessionReplicationManager } from '../session-replication.js';
import { SessionMigration } from '../session-migration.js';
import type { SessionStoreFactoryConfig } from './types.js';
import { config } from '../../core/config.js';
import type { pino } from 'pino';

/**
 * Component factory manager for creating monitoring, replication, and migration components
 */
export class ComponentFactoryManager {
  /**
   * Create monitoring component if enabled
   */
  async createMonitoring(
    store: SessionStore,
    enabled: boolean,
    monitoringConfig: NonNullable<SessionStoreFactoryConfig['monitoringConfig']>,
    logger: pino.Logger,
  ): Promise<SessionStoreMonitor | undefined> {
    if (!enabled) {
      return undefined;
    }

    const monitor = new SessionStoreMonitor(
      store,
      {
        healthCheckInterval: monitoringConfig.healthCheckInterval,
        metricsRetentionPeriod: monitoringConfig.metricsRetentionPeriod,
        alertThresholds: monitoringConfig.alertThresholds
          ? {
              maxLatency: monitoringConfig.alertThresholds.maxLatency ?? 1000,
              maxErrorRate: monitoringConfig.alertThresholds.maxErrorRate ?? 0.05,
              maxFallbackTime: 300000,
              minAvailability: 0.99,
            }
          : undefined,
        enableDetailedMetrics: true,
        enableAlerting: true,
      },
      logger,
    );

    await monitor.start();
    logger.info('Session store monitoring enabled');
    return monitor;
  }

  /**
   * Create replication component if enabled
   */
  createReplication(
    store: SessionStore,
    enabled: boolean,
    replicationConfig: NonNullable<SessionStoreFactoryConfig['replicationConfig']>,
    logger: pino.Logger,
  ): SessionReplicationManager | undefined {
    if (!enabled) {
      return undefined;
    }

    const replication = new SessionReplicationManager(
      store,
      {
        mode: replicationConfig.mode,
        syncInterval: replicationConfig.syncInterval,
        conflictResolution: replicationConfig.conflictResolution,
        syncDeletions: true,
        syncExpired: false,
        maxRetries: config.REDIS_MAX_RETRIES,
        retryDelay: config.REDIS_RETRY_DELAY,
      },
      logger,
    );

    logger.info('Session store replication enabled');
    return replication;
  }

  /**
   * Create migration component if enabled
   */
  createMigration(enabled: boolean, logger: pino.Logger): SessionMigration | undefined {
    if (!enabled) {
      return undefined;
    }

    logger.info('Session store migration utilities enabled');
    return new SessionMigration(logger);
  }
}
