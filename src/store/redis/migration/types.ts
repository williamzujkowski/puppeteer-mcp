/**
 * Migration-specific types and interfaces
 * @module store/redis/migration/types
 * @nist cp-9 "Information system backup"
 * @nist cp-10 "Information system recovery and reconstitution"
 */

import type { RedisClient } from '../types.js';

/**
 * Migration operation result
 */
export interface MigrationResult {
  success: boolean;
  errors: string[];
}

/**
 * Backup operation result
 */
export interface BackupResult extends MigrationResult {
  sessionCount: number;
  backupSize: number;
  error?: string;
}

/**
 * Restore operation result
 */
export interface RestoreResult extends MigrationResult {
  restoredCount: number;
  skippedCount: number;
}

/**
 * Session migration result
 */
export interface SessionMigrationResult extends MigrationResult {
  migratedCount: number;
  failedCount: number;
}

/**
 * Backup validation result
 */
export interface BackupValidationResult {
  valid: boolean;
  version?: string;
  sessionCount?: number;
  timestamp?: string;
  errors: string[];
}

/**
 * Backup file format
 */
export interface BackupData {
  timestamp: string;
  version: string;
  sessionCount: number;
  preserveTTL: boolean;
  sessions: BackupSession[];
}

/**
 * Individual session backup entry
 */
export interface BackupSession {
  key: string;
  data: string;
  ttl?: number;
}

/**
 * Migration strategy interface
 */
export interface MigrationStrategy {
  name: string;
  validate(data: unknown): boolean;
  execute(
    source: RedisClient,
    target: RedisClient,
    options: MigrationOptions
  ): Promise<SessionMigrationResult>;
}

/**
 * Migration options
 */
export interface MigrationOptions {
  batchSize: number;
  preserveTTL: boolean;
  overwrite?: boolean;
  dryRun?: boolean;
  validateOnly?: boolean;
}

/**
 * Backup options
 */
export interface BackupOptions {
  preserveTTL?: boolean;
  compress?: boolean;
}

/**
 * Restore options
 */
export interface RestoreOptions {
  overwrite?: boolean;
  dryRun?: boolean;
  validateOnly?: boolean;
}

/**
 * Migration context for tracking
 */
export interface MigrationContext {
  operation: 'backup' | 'restore' | 'migrate';
  startTime: Date;
  options: MigrationOptions | BackupOptions | RestoreOptions;
}