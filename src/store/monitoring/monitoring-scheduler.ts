/**
 * Scheduled monitoring tasks and intervals
 * @module store/monitoring/monitoring-scheduler
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { EventEmitter } from 'events';
import { pino } from 'pino';

/**
 * Scheduled task configuration
 */
export interface ScheduledTask {
  name: string;
  interval: number;
  immediate: boolean;
  enabled: boolean;
  handler: () => Promise<void>;
}

/**
 * Monitoring scheduler for periodic tasks
 */
export class MonitoringScheduler extends EventEmitter {
  private logger: pino.Logger;
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor(logger?: pino.Logger) {
    super();
    this.logger = logger ?? pino({ level: 'info' });
  }

  /**
   * Register a scheduled task
   */
  registerTask(task: ScheduledTask): void {
    this.tasks.set(task.name, task);

    if (this.isRunning && task.enabled) {
      this.startTask(task);
    }
  }

  /**
   * Start all scheduled tasks
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.startTask(task);
      }
    }

    this.logger.info('Monitoring scheduler started');
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    for (const [name, timer] of this.timers.entries()) {
      clearInterval(timer);
      this.timers.delete(name);
    }

    this.logger.info('Monitoring scheduler stopped');
  }

  /**
   * Start a specific task
   */
  private startTask(task: ScheduledTask): void {
    // Execute immediately if requested
    if (task.immediate) {
      void this.executeTask(task);
    }

    // Set up interval
    const timer = setInterval(() => {
      void this.executeTask(task);
    }, task.interval);

    // Don't keep the process alive
    timer.unref();

    this.timers.set(task.name, timer);
  }

  /**
   * Execute a task
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    try {
      await task.handler();
      this.emit('task:completed', { name: task.name });
    } catch (error) {
      this.logger.error({ error, task: task.name }, 'Scheduled task failed');
      this.emit('task:error', { name: task.name, error });
    }
  }

  /**
   * Enable/disable a task
   */
  setTaskEnabled(name: string, enabled: boolean): void {
    const task = this.tasks.get(name);
    if (!task) return;

    task.enabled = enabled;
    if (this.isRunning) {
      if (enabled) {
        this.startTask(task);
      } else {
        this.stopTask(name);
      }
    }
  }

  /**
   * Stop a specific task
   */
  private stopTask(name: string): void {
    const timer = this.timers.get(name);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(name);
    }
  }

  /**
   * Update task interval
   */
  updateTaskInterval(name: string, interval: number): void {
    const task = this.tasks.get(name);
    if (!task) {
      return;
    }

    task.interval = interval;

    // Restart task if running
    if (this.isRunning && task.enabled) {
      const timer = this.timers.get(name);
      if (timer) {
        clearInterval(timer);
        this.timers.delete(name);
      }
      this.startTask(task);
    }
  }

  /**
   * Get task status
   */
  getTaskStatus(name: string): {
    exists: boolean;
    enabled?: boolean;
    interval?: number;
    running?: boolean;
  } {
    const task = this.tasks.get(name);
    if (!task) {
      return { exists: false };
    }

    return {
      exists: true,
      enabled: task.enabled,
      interval: task.interval,
      running: this.timers.has(name),
    };
  }

  /**
   * Get all task statuses
   */
  getAllTaskStatuses(): Array<{
    name: string;
    enabled: boolean;
    interval: number;
    running: boolean;
  }> {
    return Array.from(this.tasks.entries()).map(([name, task]) => ({
      name,
      enabled: task.enabled,
      interval: task.interval,
      running: this.timers.has(name),
    }));
  }

  /**
   * Run a task immediately
   */
  async runTaskNow(name: string): Promise<void> {
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`Task ${name} not found`);
    }

    await this.executeTask(task);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.tasks.clear();
  }
}
