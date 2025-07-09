/**
 * Session store factory with automatic store selection
 * @module store/session-store-factory
 * @nist cm-6 "Configuration settings"
 * @nist cm-7 "Least functionality"
 * @nist au-3 "Audit logging for store selection"
 */

// Re-export everything from the factory module for backward compatibility
export {
  SessionStoreFactory,
  createDefaultSessionStoreFactory,
  type SessionStoreFactoryConfig,
  type SessionStoreFactoryResult,
  type ExtractedConfiguration,
  type MigrationStats,
  type HealthStatus,
  type BackupResult,
  type RestoreStats
} from './factory/index.js';

