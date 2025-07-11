/**
 * Statistics initialization utilities
 * @module store/migration/stats-initializer
 * @nist au-3 "Audit logging for data migration"
 * @nist sc-28 "Protection of information at rest"
 */

import type { MigrationStats, RestoreStats } from './types.js';

/**
 * Statistics initializer utility class
 */
export class StatsInitializer {
  /**
   * Initialize migration statistics
   */
  static initializeMigrationStats(): MigrationStats {
    return {
      totalSessions: 0,
      migratedSessions: 0,
      failedSessions: 0,
      skippedSessions: 0,
      duration: 0,
      errors: [],
    };
  }

  /**
   * Initialize restore statistics
   */
  static initializeRestoreStats(): RestoreStats {
    return {
      restored: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  }
}
