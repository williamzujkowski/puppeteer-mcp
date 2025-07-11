/**
 * Session migration utilities for moving between different stores
 * @module store/session-migration
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 * @deprecated Use the modular implementation in ./migration/ instead
 */

// Re-export from the new modular implementation
export { SessionMigration } from './migration/index.js';
export type {
  MigrationOptions,
  MigrationStats,
  RestoreOptions,
  RestoreStats,
  SessionValidationResult,
  RestoreCommand,
  RestoreStrategy,
} from './migration/index.js';
