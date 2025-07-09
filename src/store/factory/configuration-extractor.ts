/**
 * Configuration extractor for processing factory configuration
 * @module store/factory/configuration-extractor
 * @nist cm-6 "Configuration settings"
 */

import type { SessionStoreFactoryConfig, ExtractedConfiguration } from './types.js';
import { config } from '../../core/config.js';
import type { pino } from 'pino';

/**
 * Configuration extractor for processing factory configuration
 */
export class ConfigurationExtractor {
  constructor(private defaultLogger: pino.Logger) {}

  extract(factoryConfig: SessionStoreFactoryConfig): ExtractedConfiguration {
    return {
      preferredStore: factoryConfig.preferredStore ?? config.SESSION_STORE_TYPE,
      enableMonitoring: factoryConfig.enableMonitoring ?? config.SESSION_STORE_MONITORING_ENABLED,
      enableReplication: factoryConfig.enableReplication ?? config.SESSION_STORE_REPLICATION_ENABLED,
      enableMigration: factoryConfig.enableMigration ?? config.SESSION_STORE_MIGRATION_ENABLED,
      logger: factoryConfig.logger ?? this.defaultLogger,
      monitoringConfig: factoryConfig.monitoringConfig ?? {},
      replicationConfig: factoryConfig.replicationConfig ?? {}
    };
  }
}