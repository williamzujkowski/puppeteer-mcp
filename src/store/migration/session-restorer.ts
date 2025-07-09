/**
 * Session restoration functionality
 * @module store/migration/session-restorer
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { pino } from 'pino';
import type { SessionStore } from '../session-store.interface.js';
import type { Session } from '../../types/session.js';
import type { 
  RestoreOptions, 
  RestoreStats, 
  RestoreStrategy, 
  RestoreCommand, 
  SessionValidationResult
} from './types.js';
import { StandardRestoreStrategy } from './migration-validator.js';
import { MigrationMetrics } from './migration-metrics.js';

/**
 * Session restore manager
 */
export class SessionRestorer {
  private logger: pino.Logger;
  private metrics: MigrationMetrics;

  constructor(logger: pino.Logger) {
    this.logger = logger;
    this.metrics = new MigrationMetrics(logger);
  }

  /**
   * Restore sessions from a backup using advanced patterns
   */
  async restore(
    store: SessionStore,
    sessions: Session[],
    options: RestoreOptions = {}
  ): Promise<RestoreStats> {
    this.metrics.logRestoreStart(sessions.length);

    const restoreConfig = this.buildRestoreConfiguration(options);
    const stats = this.metrics.initializeRestoreStats();
    const strategy = new StandardRestoreStrategy(this.logger);

    await this.processSessionsForRestore({
      sessions,
      store,
      config: restoreConfig,
      strategy,
      stats
    });

    await this.logRestoreCompletion(store, stats);

    return stats;
  }

  /**
   * Build restore configuration with defaults
   */
  private buildRestoreConfiguration(options: RestoreOptions): Required<RestoreOptions> {
    return {
      overwrite: options.overwrite ?? false,
      skipExpired: options.skipExpired ?? true,
      onProgress: options.onProgress ?? ((): void => {})
    };
  }

  /**
   * Process all sessions for restore operation
   */
  private async processSessionsForRestore(context: RestoreProcessingContext): Promise<void> {
    const { sessions, store, config, strategy, stats } = context;

    let processed = 0;
    for (const session of sessions) {
      if (session === null || session === undefined) {
        processed++;
        continue;
      }
      
      await this.processSingleSessionRestore({
        session,
        store,
        config,
        strategy,
        stats
      });
      
      processed++;
      config.onProgress(processed, sessions.length);
    }
  }

  /**
   * Process a single session restore operation
   */
  private async processSingleSessionRestore(context: SingleSessionRestoreContext): Promise<void> {
    const { session, store, config, strategy, stats } = context;

    try {
      const validation = await strategy.validate(session, store, config);
      
      if (validation.shouldSkip) {
        this.metrics.recordRestoreSkip(stats);
        return;
      }

      const command = this.createRestoreCommand(session, validation);
      await strategy.execute(command, store);
      this.metrics.recordRestoreSuccess(stats);
    } catch (error) {
      this.metrics.recordRestoreError(stats, session.id, error);
    }
  }

  /**
   * Create restore command based on validation result
   */
  private createRestoreCommand(session: Session, validation: SessionValidationResult): RestoreCommand {
    return {
      session,
      operation: validation.exists ? 'update' : 'create',
      reason: validation.reason
    };
  }

  /**
   * Log restore completion and audit trail
   */
  private async logRestoreCompletion(store: SessionStore, stats: RestoreStats): Promise<void> {
    this.metrics.recordRestoreCompletion(stats);
    await this.metrics.logRestoreAudit(store, stats);
  }
}

/**
 * Context for restore processing
 */
interface RestoreProcessingContext {
  sessions: Session[];
  store: SessionStore;
  config: Required<RestoreOptions>;
  strategy: RestoreStrategy;
  stats: RestoreStats;
}

/**
 * Context for single session restore
 */
interface SingleSessionRestoreContext {
  session: Session;
  store: SessionStore;
  config: Required<RestoreOptions>;
  strategy: RestoreStrategy;
  stats: RestoreStats;
}