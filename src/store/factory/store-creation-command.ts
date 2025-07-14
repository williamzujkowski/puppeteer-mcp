/**
 * Store creation command encapsulating the creation workflow
 * @module store/factory/store-creation-command
 * @nist cm-6 "Configuration settings"
 * @nist au-3 "Audit logging for store creation"
 */

import type { SessionStore } from '../session-store.interface.js';
import type {
  SessionStoreFactoryConfig,
  SessionStoreFactoryResult,
  ExtractedConfiguration,
} from './types.js';
import type { StoreSelectionResult } from './store-selection-strategies.js';
import { StoreSelectionStrategyFactory } from './store-selection-strategies.js';
import { SessionStoreBuilder } from './session-store-builder.js';
import { ComponentFactoryManager } from './component-factory-manager.js';
import { ConfigurationExtractor } from './configuration-extractor.js';
import { isRedisAvailable } from '../../utils/redis-client.js';
import { logDataAccess } from '../../utils/logger.js';
import type { pino } from 'pino';

/**
 * Store creation command encapsulating the creation workflow
 */
export class StoreCreationCommand {
  private configExtractor: ConfigurationExtractor;
  private componentFactory: ComponentFactoryManager;

  constructor(
    private instanceId: string,
    private factoryConfig: SessionStoreFactoryConfig,
    private logger: pino.Logger,
    private instances: Map<string, SessionStoreFactoryResult>,
  ) {
    this.configExtractor = new ConfigurationExtractor(logger);
    this.componentFactory = new ComponentFactoryManager();
  }

  async execute(): Promise<SessionStoreFactoryResult> {
    this.validateInstance();
    const config = this.configExtractor.extract(this.factoryConfig);
    const storeResult = this.selectAndCreateStore(config);
    const builder = this.createBuilder(storeResult, config);
    await this.addComponents(builder, storeResult.store, config);
    const result = builder.build();
    await this.finalizeCreation(result, config);
    return result;
  }

  private validateInstance(): void {
    if (this.instances.has(this.instanceId)) {
      throw new Error(`Session store instance '${this.instanceId}' already exists`);
    }
  }

  private selectAndCreateStore(config: ExtractedConfiguration): StoreSelectionResult {
    const strategy = StoreSelectionStrategyFactory.create(config.preferredStore);
    return strategy.selectStore(isRedisAvailable(), config.logger);
  }

  private createBuilder(
    storeResult: StoreSelectionResult,
    _config: ExtractedConfiguration,
  ): SessionStoreBuilder {
    return new SessionStoreBuilder()
      .withStore(storeResult.store, storeResult.type, storeResult.fallbackReason)
      .withMetadata(this.factoryConfig, isRedisAvailable());
  }

  private async addComponents(
    builder: SessionStoreBuilder,
    store: SessionStore,
    config: ExtractedConfiguration,
  ): Promise<void> {
    const monitor = await this.componentFactory.createMonitoring(
      store,
      config.enableMonitoring,
      config.monitoringConfig,
      config.logger,
    );

    const replication = this.componentFactory.createReplication(
      store,
      config.enableReplication,
      config.replicationConfig,
      config.logger,
    );

    const migration = this.componentFactory.createMigration(config.enableMigration, config.logger);

    builder.withMonitoring(monitor).withReplication(replication).withMigration(migration);
  }

  private async finalizeCreation(
    result: SessionStoreFactoryResult,
    config: ExtractedConfiguration,
  ): Promise<void> {
    this.instances.set(this.instanceId, result);
    await this.logCreation(result, config);
  }

  private async logCreation(
    result: SessionStoreFactoryResult,
    extractedConfig: ExtractedConfiguration,
  ): Promise<void> {
    await logDataAccess('WRITE', `session-store/${this.instanceId}`, {
      action: 'create',
      instanceId: this.instanceId,
      storeType: result.type,
      redisAvailable: result.metadata.redisAvailable,
      fallbackReason: result.metadata.fallbackReason,
      enableMonitoring: extractedConfig.enableMonitoring,
      enableReplication: extractedConfig.enableReplication,
      enableMigration: extractedConfig.enableMigration,
    });

    this.logger.debug(
      {
        instanceId: this.instanceId,
        storeType: result.type,
        redisAvailable: result.metadata.redisAvailable,
        fallbackReason: result.metadata.fallbackReason,
        enableMonitoring: extractedConfig.enableMonitoring,
        enableReplication: extractedConfig.enableReplication,
        enableMigration: extractedConfig.enableMigration,
      },
      'Session store created',
    );
  }
}
