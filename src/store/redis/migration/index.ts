/**
 * Redis migration module exports
 * @module store/redis/migration
 * @nist cp-9 "Information system backup"
 * @nist cp-10 "Information system recovery and reconstitution"
 */

// Core exports
export { MigrationManager } from './migration-manager.js';
export { MigrationFactory, MigrationType } from './migration-factory.js';

// Strategy exports
export { BackupStrategy } from './backup-strategy.js';
export { RestoreStrategy } from './restore-strategy.js';
export { TransferStrategy } from './transfer-strategy.js';

// Service exports
export { CleanupService } from './cleanup-service.js';
export { ValidationService } from './validation-service.js';
export { SessionValidator } from './session-validator.js';

// Base class export
export { BaseMigration } from './base-migration.js';

// Type exports
export type {
  MigrationResult,
  BackupResult,
  RestoreResult,
  SessionMigrationResult,
  BackupValidationResult,
  BackupData,
  BackupSession,
  MigrationStrategy,
  MigrationOptions,
  BackupOptions,
  RestoreOptions,
  MigrationContext,
} from './types.js';

export type { BackupConfig } from './backup-strategy.js';

export type { RestoreConfig } from './restore-strategy.js';

export type { TransferConfig } from './transfer-strategy.js';

export type { CleanupResult, CleanupOptions } from './cleanup-service.js';

export type { ValidationOptions } from './validation-service.js';
