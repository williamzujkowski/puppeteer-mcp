/**
 * Session migration module exports
 * @module store/migration
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

export { SessionMigration } from './session-migration.js';
export type {
  MigrationOptions,
  MigrationStats,
  RestoreOptions,
  RestoreStats,
  BackupOptions,
  ValidationOptions,
  ValidationResult,
  SessionValidationResult,
  RestoreCommand,
  RestoreStrategy,
} from './types.js';
export { StandardRestoreStrategy } from './migration-validator.js';
export { MigrationOrchestrator } from './migration-orchestrator.js';
export { SessionRestorer } from './session-restorer.js';
export { BatchProcessor } from './batch-processor.js';
export { MigrationValidator } from './migration-validator.js';
export { MigrationMetrics } from './migration-metrics.js';
export { MigrationLogger } from './migration-logger.js';
export { MigrationAuditLogger } from './migration-audit.js';
export { StatsInitializer } from './stats-initializer.js';
export * from './migration-utils.js';
