/**
 * Error tracking storage operations
 * @module core/errors/tracking/storage-operations
 * @nist au-3 "Content of Audit Records"
 */

import { Logger } from 'pino';
import { ErrorTrackingStorage, ErrorTrackingEntry, ErrorTrackingEvent } from './types.js';
import { EventEmitter } from 'events';

/**
 * Handles storage operations for error tracking
 */
export class StorageOperations {
  constructor(
    private storage: ErrorTrackingStorage,
    private logger: Logger,
    private eventEmitter: EventEmitter,
  ) {}

  /**
   * Store error tracking entry
   */
  async storeEntry(entry: ErrorTrackingEntry): Promise<void> {
    await this.storage.store(entry);
    this.eventEmitter.emit(ErrorTrackingEvent.ERROR_OCCURRED, entry);
  }

  /**
   * Mark an error as resolved
   */
  async resolveError(
    entryId: string,
    resolutionTime?: number,
    successfulRetry = false,
  ): Promise<void> {
    const resolvedAt = new Date();
    const updates: Partial<ErrorTrackingEntry> = {
      resolved: true,
      resolvedAt,
      resolutionTime,
      successfulRetry,
    };

    try {
      await this.storage.updateEntry(entryId, updates);

      const entry = await this.storage.get(entryId);
      if (entry) {
        this.eventEmitter.emit(ErrorTrackingEvent.ERROR_RESOLVED, entry);
      }
    } catch (error) {
      this.logger.error(
        {
          error,
          entryId,
        },
        'Failed to resolve error',
      );
    }
  }

  /**
   * Record a retry attempt
   */
  async recordRetryAttempt(entryId: string): Promise<void> {
    try {
      const entry = await this.storage.get(entryId);
      if (entry) {
        await this.storage.updateEntry(entryId, {
          retryAttempts: entry.retryAttempts + 1,
          lastRetryAt: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(
        {
          error,
          entryId,
        },
        'Failed to record retry attempt',
      );
    }
  }
}
