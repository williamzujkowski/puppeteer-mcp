/**
 * Session store factory module exports
 * @module store/factory
 * @nist cm-6 "Configuration settings"
 */

export {
  SessionStoreFactory,
  createDefaultSessionStoreFactory,
} from './session-store-factory-main.js';
export type {
  SessionStoreFactoryConfig,
  SessionStoreFactoryResult,
  ExtractedConfiguration,
  MigrationStats,
  HealthStatus,
  BackupResult,
  RestoreStats,
} from './types.js';
export { SessionStoreBuilder } from './session-store-builder.js';
export {
  type StoreSelectionStrategy,
  type StoreSelectionResult,
  RedisSelectionStrategy,
  MemorySelectionStrategy,
  AutoSelectionStrategy,
  StoreSelectionStrategyFactory,
} from './store-selection-strategies.js';
export { ComponentFactoryManager } from './component-factory-manager.js';
export { ConfigurationExtractor } from './configuration-extractor.js';
export { StoreCreationCommand } from './store-creation-command.js';
export { StoreSwitchManager, type StoreSwitchOptions } from './store-switch-manager.js';
export { BackupRestoreManager } from './backup-restore-manager.js';
export { HealthStatusManager } from './health-status-manager.js';
