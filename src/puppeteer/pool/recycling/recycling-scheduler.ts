/**
 * Scheduling and timing logic for browser recycling
 * @module puppeteer/pool/recycling/recycling-scheduler
 * @nist ac-12 "Session termination"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../utils/logger.js';
import type { RecyclingConfig } from './types.js';

const logger = createLogger('recycling-scheduler');

/**
 * Recycling scheduler events
 */
export interface RecyclingSchedulerEvents {
  'scheduled-maintenance-trigger': [];
  'cooldown-expired': [];
  'scheduler-started': [];
  'scheduler-stopped': [];
}

/**
 * Recycling scheduler
 * @nist ac-12 "Session termination"
 */
export class RecyclingScheduler extends EventEmitter {
  private maintenanceTimer?: NodeJS.Timeout;
  private cooldownTimer?: NodeJS.Timeout;
  private lastRecyclingAction: Date;
  private config: RecyclingConfig;

  constructor(config: RecyclingConfig) {
    super();
    this.config = config;
    this.lastRecyclingAction = new Date(0);
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Recycling scheduler disabled');
      return;
    }

    logger.info(
      {
        maintenanceEnabled: this.config.scheduledMaintenanceEnabled,
        maintenanceInterval: this.config.maintenanceInterval,
        maintenanceWindow: {
          start: this.config.maintenanceWindowStart,
          end: this.config.maintenanceWindowEnd,
        },
      },
      'Starting recycling scheduler',
    );

    // Start scheduled maintenance if enabled
    if (this.config.scheduledMaintenanceEnabled) {
      this.startScheduledMaintenance();
    }

    this.emit('scheduler-started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = undefined;
    }

    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = undefined;
    }

    logger.info('Recycling scheduler stopped');
    this.emit('scheduler-stopped');
  }

  /**
   * Check if recycling is in cooldown period
   */
  isInCooldown(): boolean {
    const now = new Date();
    const timeSinceLastAction = now.getTime() - this.lastRecyclingAction.getTime();
    return timeSinceLastAction < this.config.recyclingCooldownMs;
  }

  /**
   * Get time remaining in cooldown period
   */
  getCooldownRemaining(): number {
    const now = new Date();
    const timeSinceLastAction = now.getTime() - this.lastRecyclingAction.getTime();
    const remaining = this.config.recyclingCooldownMs - timeSinceLastAction;
    return Math.max(0, remaining);
  }

  /**
   * Update last recycling action time
   */
  updateLastRecyclingTime(): void {
    this.lastRecyclingAction = new Date();
    this.startCooldownTimer();
  }

  /**
   * Check if in maintenance window
   */
  isInMaintenanceWindow(): boolean {
    const now = new Date();
    const currentHour = now.getHours();

    // Handle wrap-around (e.g., 22:00 to 02:00)
    if (this.config.maintenanceWindowStart > this.config.maintenanceWindowEnd) {
      return (
        currentHour >= this.config.maintenanceWindowStart ||
        currentHour <= this.config.maintenanceWindowEnd
      );
    }

    return (
      currentHour >= this.config.maintenanceWindowStart &&
      currentHour <= this.config.maintenanceWindowEnd
    );
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: RecyclingConfig): void {
    const wasEnabled = this.config.enabled;
    this.config = newConfig;

    // Restart if enabling state changed
    if (wasEnabled !== newConfig.enabled) {
      this.stop();
      if (newConfig.enabled) {
        this.start();
      }
    }
  }

  /**
   * Start scheduled maintenance timer
   * @private
   */
  private startScheduledMaintenance(): void {
    // Check every minute for maintenance window
    const checkInterval = 60 * 1000; // 1 minute

    this.maintenanceTimer = setInterval(() => {
      if (this.isInMaintenanceWindow()) {
        logger.info(
          {
            currentHour: new Date().getHours(),
            maintenanceWindow: {
              start: this.config.maintenanceWindowStart,
              end: this.config.maintenanceWindowEnd,
            },
          },
          'Maintenance window active, triggering scheduled maintenance',
        );
        this.emit('scheduled-maintenance-trigger');
      }
    }, checkInterval);
  }

  /**
   * Start cooldown timer
   * @private
   */
  private startCooldownTimer(): void {
    // Clear existing timer
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }

    // Set new timer
    this.cooldownTimer = setTimeout(() => {
      logger.debug('Recycling cooldown period expired');
      this.emit('cooldown-expired');
      this.cooldownTimer = undefined;
    }, this.config.recyclingCooldownMs);
  }
}
