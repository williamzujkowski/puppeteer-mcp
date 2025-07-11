/**
 * Types and interfaces for session migration
 * @module store/migration/types
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { SessionStore } from '../session-store.interface.js';
import type { Session } from '../../types/session.js';

/**
 * Migration statistics
 */
export interface MigrationStats {
  totalSessions: number;
  migratedSessions: number;
  failedSessions: number;
  skippedSessions: number;
  duration: number;
  errors: Array<{
    sessionId: string;
    error: string;
  }>;
}

/**
 * Migration options
 */
export interface MigrationOptions {
  /**
   * Whether to skip sessions that already exist in the target store
   */
  skipExisting?: boolean;

  /**
   * Whether to delete sessions from source store after successful migration
   */
  deleteAfterMigration?: boolean;

  /**
   * Batch size for processing sessions
   */
  batchSize?: number;

  /**
   * Whether to continue migration on individual session errors
   */
  continueOnError?: boolean;

  /**
   * Filter function to determine which sessions to migrate
   */
  filter?: (session: Session) => boolean;

  /**
   * Progress callback function
   */
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Restore options
 */
export interface RestoreOptions {
  overwrite?: boolean;
  skipExpired?: boolean;
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Restore statistics
 */
export interface RestoreStats {
  restored: number;
  skipped: number;
  failed: number;
  errors: Array<{ sessionId: string; error: string }>;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  isValid: boolean;
  isExpired: boolean;
  exists: boolean;
  shouldSkip: boolean;
  reason?: string;
}

/**
 * Restore operation command
 */
export interface RestoreCommand {
  session: Session;
  operation: 'create' | 'update' | 'skip';
  reason?: string;
}

/**
 * Restore strategy interface
 */
export interface RestoreStrategy {
  validate(
    session: Session,
    store: SessionStore,
    options: RestoreOptions,
  ): Promise<SessionValidationResult>;
  execute(command: RestoreCommand, store: SessionStore): Promise<void>;
}

/**
 * Batch processing options
 */
export interface BatchProcessingOptions {
  skipExisting: boolean;
  deleteAfterMigration: boolean;
  continueOnError: boolean;
}

/**
 * Migration context for orchestrator
 */
export interface MigrationContext {
  sourceStore: SessionStore;
  targetStore: SessionStore;
  options: MigrationOptions;
  startTime: number;
  stats: MigrationStats;
}

/**
 * Backup options
 */
export interface BackupOptions {
  includeExpired?: boolean;
  filter?: (session: Session) => boolean;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  checkExpired?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  sourceSessions: number;
  targetSessions: number;
  missingSessions: string[];
  extraSessions: string[];
}
