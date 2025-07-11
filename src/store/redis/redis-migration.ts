/**
 * Redis data migration and backup utilities
 * @module store/redis/redis-migration
 * @nist cp-9 "Information system backup"
 * @nist cp-10 "Information system recovery and reconstitution"
 *
 * This file maintains backward compatibility by re-exporting the modularized migration components.
 * The implementation has been refactored into focused modules under ./migration/
 */

import type { StoreLogger } from './types.js';
import { MigrationManager } from './migration/index.js';

/**
 * Redis migration and backup utilities
 *
 * @deprecated Use MigrationManager directly from './migration/index.js'
 * This class is maintained for backward compatibility
 */
export class RedisMigrationManager extends MigrationManager {
  constructor(logger: StoreLogger) {
    super(logger);
  }
}

// Re-export all types and classes for backward compatibility
export {
  MigrationManager,
  MigrationFactory,
  MigrationType,
  BackupStrategy,
  RestoreStrategy,
  TransferStrategy,
  CleanupService,
  ValidationService,
  SessionValidator,
  BaseMigration,
} from './migration/index.js';

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
  BackupConfig,
  RestoreConfig,
  TransferConfig,
  CleanupResult,
  CleanupOptions,
  ValidationOptions,
} from './migration/index.js';
