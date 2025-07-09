/**
 * Error tracking cleanup operations
 * @module core/errors/tracking/cleanup-manager
 * @nist au-3 "Content of Audit Records"
 */

import { Logger } from 'pino';
import { ErrorTrackingStorage } from './types.js';

/**
 * Manages cleanup operations for error tracking
 */
export class CleanupManager {
  private cleanupInterval: NodeJS.Timeout;
  private readonly DEFAULT_MAX_AGE = 7 * 24 * 60; // 7 days in minutes
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

  constructor(
    private storage: ErrorTrackingStorage,
    private logger: Logger,
  ) {
    this.cleanupInterval = setInterval(() => void this.performCleanup(), this.CLEANUP_INTERVAL);
  }

  /**
   * Perform cleanup of old entries
   */
  async performCleanup(maxAge = this.DEFAULT_MAX_AGE): Promise<void> {
    try {
      await this.storage.cleanup(maxAge);
      this.logger.debug('Error tracking cleanup completed');
    } catch (error) {
      this.logger.error(
        {
          error,
        },
        'Error tracking cleanup failed',
      );
    }
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval !== undefined) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Restart the cleanup interval
   */
  restart(): void {
    this.stop();
    this.cleanupInterval = setInterval(() => void this.performCleanup(), this.CLEANUP_INTERVAL);
  }
}
