/**
 * System resource monitor implementation
 * @module puppeteer/pool/resource-management/system-resource-monitor
 * @nist si-4 "Information system monitoring"
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { createLogger } from '../../../utils/logger.js';
import type { SystemResources } from './resource-types.js';
import type { ISystemResourceMonitor } from './resource-monitor.interface.js';

const logger = createLogger('system-resource-monitor');
const execAsync = promisify(exec);

/**
 * System resource monitor
 * @nist si-4 "Information system monitoring"
 */
export class SystemResourceMonitor implements ISystemResourceMonitor {
  private systemResources: SystemResources | null = null;
  private monitoringInterval?: NodeJS.Timeout;
  private intervalMs: number;
  private active = false;

  constructor(intervalMs = 10000) {
    this.intervalMs = intervalMs;
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.active) {
      logger.warn('System resource monitoring already active');
      return;
    }

    logger.info('Starting system resource monitoring');
    this.active = true;

    // Initial update
    await this.update();

    // Set up interval
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.update();
      } catch (error) {
        logger.error({ error }, 'Error updating system resources');
      }
    }, this.intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.active = false;
    logger.info('System resource monitoring stopped');
  }

  /**
   * Update system resources
   */
  async update(): Promise<void> {
    try {
      const os = await import('os');
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;
      const cpuUsagePercent = await this.getCpuUsage();
      const availableCpuCores = os.cpus().length;
      const loadAverage = os.loadavg();
      const uptime = os.uptime();
      const processCount = await this.getProcessCount();

      this.systemResources = {
        totalMemory,
        freeMemory,
        usedMemory,
        memoryUsagePercent,
        cpuUsagePercent,
        availableCpuCores,
        loadAverage,
        uptime,
        processCount,
      };

      logger.debug(
        {
          memoryUsagePercent: memoryUsagePercent.toFixed(1),
          cpuUsagePercent: cpuUsagePercent.toFixed(1),
          processCount,
        },
        'System resources updated'
      );
    } catch (error) {
      logger.error({ error }, 'Error updating system resources');
      throw error;
    }
  }

  /**
   * Get current resources
   */
  getResources(): SystemResources | null {
    return this.systemResources;
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Get CPU usage percentage
   */
  async getCpuUsage(): Promise<number> {
    try {
      const os = await import('os');
      const cpus = os.cpus();
      
      // Simple CPU usage calculation
      let totalIdle = 0;
      let totalTick = 0;
      
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      }

      return 100 - Math.round((totalIdle / totalTick) * 100);
    } catch (error) {
      logger.error({ error }, 'Error calculating CPU usage');
      return 0;
    }
  }

  /**
   * Get process count
   */
  async getProcessCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('ps aux | wc -l');
      return parseInt(stdout.trim(), 10) || 0;
    } catch (error) {
      logger.error({ error }, 'Error getting process count');
      return 0;
    }
  }
}