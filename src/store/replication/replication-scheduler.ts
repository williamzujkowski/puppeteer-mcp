/**
 * Scheduling logic for session replication
 * @module store/replication/replication-scheduler
 * @nist au-3 "Audit logging for replication operations"
 */

import type { Logger } from 'pino';
import { EventEmitter } from 'events';

/**
 * Manages replication scheduling
 */
export class ReplicationScheduler extends EventEmitter {
  private readonly logger: Logger;
  private syncInterval?: NodeJS.Timeout;
  private isRunning = false;
  private syncCallback?: () => Promise<void>;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Start the scheduler
   */
  start(interval: number, callback: () => Promise<void>): void {
    if (this.isRunning) {
      this.logger.warn('Scheduler already running');
      return;
    }

    this.syncCallback = callback;
    this.isRunning = true;
    
    // Start periodic sync
    this.syncInterval = setInterval(() => {
      this.runSync().catch(error => {
        this.logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Scheduled sync failed'
        );
        this.emit('sync:error', error);
      });
    }, interval);

    // Don't keep the process alive
    this.syncInterval.unref();

    this.logger.info({ interval }, 'Replication scheduler started');
    this.emit('scheduler:started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    this.syncCallback = undefined;

    this.logger.info('Replication scheduler stopped');
    this.emit('scheduler:stopped');
  }

  /**
   * Trigger immediate sync
   */
  async triggerSync(): Promise<void> {
    if (!this.isRunning || !this.syncCallback) {
      throw new Error('Scheduler is not running');
    }

    this.logger.debug('Manual sync triggered');
    await this.runSync();
  }

  /**
   * Run sync operation
   */
  private async runSync(): Promise<void> {
    if (!this.syncCallback) {
      return;
    }

    const startTime = Date.now();
    
    try {
      this.emit('sync:started');
      await this.syncCallback();
      
      const duration = Date.now() - startTime;
      this.logger.debug({ duration }, 'Scheduled sync completed');
      
      this.emit('sync:completed', { duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(
        { 
          error: error instanceof Error ? error.message : String(error),
          duration 
        },
        'Scheduled sync failed'
      );
      
      this.emit('sync:failed', error);
      throw error;
    }
  }

  /**
   * Update sync interval
   */
  updateInterval(newInterval: number): void {
    if (!this.isRunning) {
      throw new Error('Scheduler is not running');
    }

    const callback = this.syncCallback;
    if (!callback) {
      throw new Error('No sync callback defined');
    }

    this.stop();
    this.start(newInterval, callback);
    
    this.logger.info({ newInterval }, 'Sync interval updated');
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    nextSync: Date | null;
    interval: number | null;
  } {
    if (!this.isRunning || !this.syncInterval) {
      return {
        isRunning: false,
        nextSync: null,
        interval: null
      };
    }

    // Note: This is approximate since we can't get exact timer info
    const interval = (this.syncInterval as unknown as { _idleTimeout?: number })._idleTimeout ?? null;
    const nextSync = interval !== null ? new Date(Date.now() + interval) : null;

    return {
      isRunning: this.isRunning,
      nextSync,
      interval
    };
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}