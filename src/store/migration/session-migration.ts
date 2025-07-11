/**
 * Main session migration class - coordinates all migration operations
 * @module store/migration/session-migration
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { pino } from 'pino';
import type { SessionStore } from '../session-store.interface.js';
import type { Session } from '../../types/session.js';
import type {
  MigrationOptions,
  MigrationStats,
  RestoreOptions,
  RestoreStats,
  BackupOptions,
  ValidationOptions,
  ValidationResult,
} from './types.js';
import { MigrationOrchestrator } from './migration-orchestrator.js';
import { SessionRestorer } from './session-restorer.js';
import { pino as createLogger } from 'pino';

/**
 * Session migration utility class
 */
export class SessionMigration {
  private logger: pino.Logger;
  private orchestrator: MigrationOrchestrator;
  private restorer: SessionRestorer;

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? createLogger({ level: 'info' });
    this.orchestrator = new MigrationOrchestrator(this.logger);
    this.restorer = new SessionRestorer(this.logger);
  }

  /**
   * Migrate sessions from one store to another
   */
  async migrate(
    sourceStore: SessionStore,
    targetStore: SessionStore,
    options: MigrationOptions = {},
  ): Promise<MigrationStats> {
    return this.orchestrator.migrate(sourceStore, targetStore, options);
  }

  /**
   * Validate that two stores contain the same sessions
   */
  async validateMigration(
    sourceStore: SessionStore,
    targetStore: SessionStore,
    options: ValidationOptions = {},
  ): Promise<ValidationResult> {
    const validator = this.orchestrator.getValidator();
    return validator.validateMigration(sourceStore, targetStore, options);
  }

  /**
   * Create a backup of all sessions from a store
   */
  async backup(store: SessionStore, options: BackupOptions = {}): Promise<Session[]> {
    return this.orchestrator.backup(store, options);
  }

  /**
   * Restore sessions from a backup
   */
  async restore(
    store: SessionStore,
    sessions: Session[],
    options: RestoreOptions = {},
  ): Promise<RestoreStats> {
    return this.restorer.restore(store, sessions, options);
  }
}
