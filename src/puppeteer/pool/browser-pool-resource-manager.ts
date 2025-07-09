/**
 * Advanced resource management for browser pool optimization
 * @module puppeteer/pool/browser-pool-resource-manager
 * @nist si-4 "Information system monitoring"
 * @nist sc-2 "Application partitioning"
 * @nist sc-3 "Security function isolation"
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import type { Browser } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';

const logger = createLogger('browser-pool-resource-manager');
const execAsync = promisify(exec);

/**
 * System resource information
 */
export interface SystemResources {
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  availableCpuCores: number;
  loadAverage: number[];
  uptime: number;
  processCount: number;
}

/**
 * Browser resource usage
 */
export interface BrowserResourceUsage {
  browserId: string;
  pid: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
    percent: number;
  };
  openHandles: number;
  threadCount: number;
  connectionCount: number;
  timestamp: Date;
}

/**
 * Resource monitoring thresholds
 */
export interface ResourceThresholds {
  memoryWarning: number;
  memoryCritical: number;
  cpuWarning: number;
  cpuCritical: number;
  connectionWarning: number;
  connectionCritical: number;
  handleWarning: number;
  handleCritical: number;
}

/**
 * Resource monitoring configuration
 */
export interface ResourceMonitoringConfig {
  enabled: boolean;
  intervalMs: number;
  thresholds: ResourceThresholds;
  enableSystemMonitoring: boolean;
  enableBrowserMonitoring: boolean;
  enableGarbageCollection: boolean;
  gcTriggerThreshold: number;
  enableMemoryOptimization: boolean;
  enableCpuOptimization: boolean;
}

/**
 * Resource alert
 */
export interface ResourceAlert {
  type: 'memory' | 'cpu' | 'connection' | 'handle' | 'system';
  level: 'warning' | 'critical';
  message: string;
  browserId?: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  impact: 'low' | 'medium' | 'high';
  suggestedAction: string;
}

/**
 * Memory optimization options
 */
export interface MemoryOptimizationOptions {
  enablePageMemoryReduction: boolean;
  enableImageOptimization: boolean;
  enableJavaScriptOptimization: boolean;
  enableCacheOptimization: boolean;
  maxPageMemoryMB: number;
  maxBrowserMemoryMB: number;
}

/**
 * CPU optimization options
 */
export interface CpuOptimizationOptions {
  enableRequestThrottling: boolean;
  maxConcurrentRequests: number;
  enableResourceBlocking: boolean;
  blockedResourceTypes: string[];
  enableAnimationDisabling: boolean;
  maxCpuUsagePercent: number;
}

/**
 * Advanced resource manager for browser pool
 * @nist si-4 "Information system monitoring"
 * @nist sc-2 "Application partitioning"
 */
export class BrowserPoolResourceManager extends EventEmitter {
  private config: ResourceMonitoringConfig;
  private monitoringInterval?: NodeJS.Timeout;
  private systemResources: SystemResources | null = null;
  private browserResources: Map<string, BrowserResourceUsage> = new Map();
  private resourceHistory: Map<string, BrowserResourceUsage[]> = new Map();
  private activeAlerts: Map<string, ResourceAlert> = new Map();
  private memoryOptimization: MemoryOptimizationOptions;
  private cpuOptimization: CpuOptimizationOptions;
  private readonly maxHistorySize = 100;

  constructor(
    config: Partial<ResourceMonitoringConfig> = {},
    memoryOptimization: Partial<MemoryOptimizationOptions> = {},
    cpuOptimization: Partial<CpuOptimizationOptions> = {}
  ) {
    super();
    this.config = {
      enabled: true,
      intervalMs: 10000, // 10 seconds
      thresholds: {
        memoryWarning: 1024 * 1024 * 500, // 500MB
        memoryCritical: 1024 * 1024 * 1000, // 1GB
        cpuWarning: 70,
        cpuCritical: 90,
        connectionWarning: 100,
        connectionCritical: 200,
        handleWarning: 1000,
        handleCritical: 2000,
      },
      enableSystemMonitoring: true,
      enableBrowserMonitoring: true,
      enableGarbageCollection: true,
      gcTriggerThreshold: 80,
      enableMemoryOptimization: true,
      enableCpuOptimization: true,
      ...config,
    };

    this.memoryOptimization = {
      enablePageMemoryReduction: true,
      enableImageOptimization: true,
      enableJavaScriptOptimization: true,
      enableCacheOptimization: true,
      maxPageMemoryMB: 100,
      maxBrowserMemoryMB: 500,
      ...memoryOptimization,
    };

    this.cpuOptimization = {
      enableRequestThrottling: true,
      maxConcurrentRequests: 10,
      enableResourceBlocking: true,
      blockedResourceTypes: ['image', 'stylesheet', 'font', 'media'],
      enableAnimationDisabling: true,
      maxCpuUsagePercent: 80,
      ...cpuOptimization,
    };
  }

  /**
   * Start resource monitoring
   * @nist si-4 "Information system monitoring"
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Resource monitoring disabled');
      return;
    }

    logger.info(
      {
        config: this.config,
        memoryOptimization: this.memoryOptimization,
        cpuOptimization: this.cpuOptimization,
      },
      'Starting resource monitoring'
    );

    // Initial system resource check
    if (this.config.enableSystemMonitoring) {
      await this.updateSystemResources();
    }

    // Start monitoring interval
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorResources();
      } catch (error) {
        logger.error({ error }, 'Error during resource monitoring');
      }
    }, this.config.intervalMs);

    this.emit('monitoring-started');
  }

  /**
   * Stop resource monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Resource monitoring stopped');
    this.emit('monitoring-stopped');
  }

  /**
   * Get current system resources
   */
  getSystemResources(): SystemResources | null {
    return this.systemResources;
  }

  /**
   * Get browser resource usage
   */
  getBrowserResources(browserId?: string): Map<string, BrowserResourceUsage> | BrowserResourceUsage | undefined {
    if (browserId) {
      return this.browserResources.get(browserId);
    }
    return this.browserResources;
  }

  /**
   * Get resource history for a browser
   */
  getResourceHistory(browserId: string): BrowserResourceUsage[] {
    return this.resourceHistory.get(browserId) || [];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Map<string, ResourceAlert> {
    return new Map(this.activeAlerts);
  }

  /**
   * Optimize browser for resource usage
   * @nist sc-3 "Security function isolation"
   */
  async optimizeBrowser(browser: Browser, instance: BrowserInstance): Promise<void> {
    if (!this.config.enableMemoryOptimization && !this.config.enableCpuOptimization) {
      return;
    }

    logger.debug({ browserId: instance.id }, 'Optimizing browser for resource usage');

    try {
      // Get all pages
      const pages = await browser.pages();

      for (const page of pages) {
        // Apply memory optimizations
        if (this.config.enableMemoryOptimization) {
          await this.applyMemoryOptimizations(page);
        }

        // Apply CPU optimizations
        if (this.config.enableCpuOptimization) {
          await this.applyCpuOptimizations(page);
        }
      }

      // Trigger garbage collection if enabled
      if (this.config.enableGarbageCollection) {
        await this.triggerGarbageCollection(browser);
      }

      this.emit('browser-optimized', { browserId: instance.id });
    } catch (error) {
      logger.error(
        { browserId: instance.id, error },
        'Error optimizing browser'
      );
      throw error;
    }
  }

  /**
   * Check if browser should be recycled based on resource usage
   * @nist sc-2 "Application partitioning"
   */
  shouldRecycleBrowser(browserId: string): {
    shouldRecycle: boolean;
    reason: string;
    priority: 'low' | 'medium' | 'high';
  } {
    const usage = this.browserResources.get(browserId);
    if (!usage) {
      return { shouldRecycle: false, reason: 'No resource data available', priority: 'low' };
    }

    const { memoryUsage, cpuUsage, openHandles, connectionCount } = usage;

    // Check memory usage
    if (memoryUsage.rss > this.config.thresholds.memoryCritical) {
      return {
        shouldRecycle: true,
        reason: `Critical memory usage: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        priority: 'high',
      };
    }

    // Check CPU usage
    if (cpuUsage.percent > this.config.thresholds.cpuCritical) {
      return {
        shouldRecycle: true,
        reason: `Critical CPU usage: ${cpuUsage.percent}%`,
        priority: 'high',
      };
    }

    // Check handle count
    if (openHandles > this.config.thresholds.handleCritical) {
      return {
        shouldRecycle: true,
        reason: `Critical handle count: ${openHandles}`,
        priority: 'medium',
      };
    }

    // Check connection count
    if (connectionCount > this.config.thresholds.connectionCritical) {
      return {
        shouldRecycle: true,
        reason: `Critical connection count: ${connectionCount}`,
        priority: 'medium',
      };
    }

    // Check warning thresholds
    if (memoryUsage.rss > this.config.thresholds.memoryWarning) {
      return {
        shouldRecycle: true,
        reason: `High memory usage: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        priority: 'low',
      };
    }

    return { shouldRecycle: false, reason: 'Resource usage within acceptable limits', priority: 'low' };
  }

  /**
   * Update configuration
   * @nist cm-7 "Least functionality"
   */
  updateConfig(
    config: Partial<ResourceMonitoringConfig>,
    memoryOptimization?: Partial<MemoryOptimizationOptions>,
    cpuOptimization?: Partial<CpuOptimizationOptions>
  ): void {
    this.config = { ...this.config, ...config };
    
    if (memoryOptimization) {
      this.memoryOptimization = { ...this.memoryOptimization, ...memoryOptimization };
    }
    
    if (cpuOptimization) {
      this.cpuOptimization = { ...this.cpuOptimization, ...cpuOptimization };
    }

    logger.info('Resource manager configuration updated');
    this.emit('config-updated', { config: this.config });
  }

  /**
   * Monitor resources
   * @private
   */
  private async monitorResources(): Promise<void> {
    // Update system resources
    if (this.config.enableSystemMonitoring) {
      await this.updateSystemResources();
    }

    // Check system-level alerts
    await this.checkSystemAlerts();

    this.emit('resources-monitored', {
      systemResources: this.systemResources,
      browserCount: this.browserResources.size,
      alertCount: this.activeAlerts.size,
    });
  }

  /**
   * Monitor browser resources
   * @private
   */
  async monitorBrowserResources(browsers: Map<string, InternalBrowserInstance>): Promise<void> {
    if (!this.config.enableBrowserMonitoring) {
      return;
    }

    const promises = Array.from(browsers.values()).map(async (instance) => {
      try {
        const usage = await this.getBrowserResourceUsage(instance.browser, instance.id);
        this.browserResources.set(instance.id, usage);
        this.addToResourceHistory(instance.id, usage);
        await this.checkBrowserAlerts(instance.id, usage);
      } catch (error) {
        logger.error(
          { browserId: instance.id, error },
          'Error monitoring browser resources'
        );
      }
    });

    await Promise.all(promises);
  }

  /**
   * Update system resources
   * @private
   */
  private async updateSystemResources(): Promise<void> {
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
    } catch (error) {
      logger.error({ error }, 'Error updating system resources');
    }
  }

  /**
   * Get CPU usage percentage
   * @private
   */
  private async getCpuUsage(): Promise<number> {
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
    } catch {
      return 0;
    }
  }

  /**
   * Get process count
   * @private
   */
  private async getProcessCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('ps aux | wc -l');
      return parseInt(stdout.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get browser resource usage
   * @private
   */
  private async getBrowserResourceUsage(browser: Browser, browserId: string): Promise<BrowserResourceUsage> {
    const process = browser.process();
    const pid = process?.pid || 0;

    const memoryUsage = {
      rss: 0,
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
    };

    const cpuUsage = {
      user: 0,
      system: 0,
      percent: 0,
    };

    let openHandles = 0;
    let threadCount = 0;
    let connectionCount = 0;

    try {
      // Get process memory and CPU usage
      if (pid > 0) {
        const { stdout } = await execAsync(`ps -p ${pid} -o rss,pcpu,nlwp | tail -1`);
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 3) {
          memoryUsage.rss = parseInt(parts[0], 10) * 1024; // Convert KB to bytes
          cpuUsage.percent = parseFloat(parts[1]);
          threadCount = parseInt(parts[2], 10);
        }
      }

      // Get connection count from browser
      const pages = await browser.pages();
      connectionCount = pages.length;

      // Estimate open handles (simplified)
      openHandles = connectionCount * 50; // Rough estimate

    } catch (error) {
      logger.debug({ browserId, error }, 'Error getting detailed browser resource usage');
    }

    return {
      browserId,
      pid,
      memoryUsage,
      cpuUsage,
      openHandles,
      threadCount,
      connectionCount,
      timestamp: new Date(),
    };
  }

  /**
   * Add to resource history
   * @private
   */
  private addToResourceHistory(browserId: string, usage: BrowserResourceUsage): void {
    let history = this.resourceHistory.get(browserId) || [];
    history.push(usage);

    // Maintain maximum history size
    if (history.length > this.maxHistorySize) {
      history = history.slice(-this.maxHistorySize);
    }

    this.resourceHistory.set(browserId, history);
  }

  /**
   * Check system-level alerts
   * @private
   */
  private async checkSystemAlerts(): Promise<void> {
    if (!this.systemResources) return;

    const { memoryUsagePercent, cpuUsagePercent } = this.systemResources;

    // Check memory alerts
    if (memoryUsagePercent > 90) {
      await this.createAlert({
        type: 'memory',
        level: 'critical',
        message: `Critical system memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        currentValue: memoryUsagePercent,
        threshold: 90,
        timestamp: new Date(),
        impact: 'high',
        suggestedAction: 'Scale down browser pool or restart high-memory browsers',
      });
    } else if (memoryUsagePercent > 80) {
      await this.createAlert({
        type: 'memory',
        level: 'warning',
        message: `High system memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        currentValue: memoryUsagePercent,
        threshold: 80,
        timestamp: new Date(),
        impact: 'medium',
        suggestedAction: 'Monitor closely and consider scaling down',
      });
    }

    // Check CPU alerts
    if (cpuUsagePercent > 90) {
      await this.createAlert({
        type: 'cpu',
        level: 'critical',
        message: `Critical system CPU usage: ${cpuUsagePercent.toFixed(1)}%`,
        currentValue: cpuUsagePercent,
        threshold: 90,
        timestamp: new Date(),
        impact: 'high',
        suggestedAction: 'Scale down browser pool or optimize browser processes',
      });
    }
  }

  /**
   * Check browser-specific alerts
   * @private
   */
  private async checkBrowserAlerts(browserId: string, usage: BrowserResourceUsage): Promise<void> {
    const { memoryUsage, cpuUsage, openHandles, connectionCount } = usage;

    // Memory alerts
    if (memoryUsage.rss > this.config.thresholds.memoryCritical) {
      await this.createAlert({
        type: 'memory',
        level: 'critical',
        message: `Critical browser memory usage: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        browserId,
        currentValue: memoryUsage.rss,
        threshold: this.config.thresholds.memoryCritical,
        timestamp: new Date(),
        impact: 'high',
        suggestedAction: 'Recycle browser immediately',
      });
    }

    // CPU alerts
    if (cpuUsage.percent > this.config.thresholds.cpuCritical) {
      await this.createAlert({
        type: 'cpu',
        level: 'critical',
        message: `Critical browser CPU usage: ${cpuUsage.percent}%`,
        browserId,
        currentValue: cpuUsage.percent,
        threshold: this.config.thresholds.cpuCritical,
        timestamp: new Date(),
        impact: 'high',
        suggestedAction: 'Recycle browser and optimize page operations',
      });
    }

    // Handle alerts
    if (openHandles > this.config.thresholds.handleCritical) {
      await this.createAlert({
        type: 'handle',
        level: 'critical',
        message: `Critical browser handle count: ${openHandles}`,
        browserId,
        currentValue: openHandles,
        threshold: this.config.thresholds.handleCritical,
        timestamp: new Date(),
        impact: 'medium',
        suggestedAction: 'Recycle browser to free handles',
      });
    }
  }

  /**
   * Create or update alert
   * @private
   */
  private async createAlert(alert: ResourceAlert): Promise<void> {
    const alertKey = `${alert.type}-${alert.browserId || 'system'}`;
    const existing = this.activeAlerts.get(alertKey);

    if (!existing || existing.level !== alert.level) {
      this.activeAlerts.set(alertKey, alert);
      
      logger.warn(
        {
          alert,
          isNew: !existing,
        },
        'Resource alert created'
      );

      this.emit('resource-alert', alert);
    }
  }

  /**
   * Apply memory optimizations to a page
   * @private
   */
  private async applyMemoryOptimizations(page: any): Promise<void> {
    try {
      if (this.memoryOptimization.enableImageOptimization) {
        await page.setRequestInterception(true);
        page.on('request', (req: any) => {
          if (req.resourceType() === 'image' && req.url().includes('data:')) {
            req.abort();
          } else {
            req.continue();
          }
        });
      }

      if (this.memoryOptimization.enableCacheOptimization) {
        await page.setCacheEnabled(false);
      }

      if (this.memoryOptimization.enableJavaScriptOptimization) {
        await page.setJavaScriptEnabled(false);
      }
    } catch (error) {
      logger.debug({ error }, 'Error applying memory optimizations');
    }
  }

  /**
   * Apply CPU optimizations to a page
   * @private
   */
  private async applyCpuOptimizations(page: any): Promise<void> {
    try {
      if (this.cpuOptimization.enableResourceBlocking) {
        await page.setRequestInterception(true);
        page.on('request', (req: any) => {
          if (this.cpuOptimization.blockedResourceTypes.includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });
      }

      if (this.cpuOptimization.enableAnimationDisabling) {
        await page.evaluateOnNewDocument(() => {
          // Disable animations
          const style = document.createElement('style');
          style.textContent = `
            *, *::before, *::after {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `;
          document.head.appendChild(style);
        });
      }
    } catch (error) {
      logger.debug({ error }, 'Error applying CPU optimizations');
    }
  }

  /**
   * Trigger garbage collection
   * @private
   */
  private async triggerGarbageCollection(browser: Browser): Promise<void> {
    try {
      const pages = await browser.pages();
      for (const page of pages) {
        await page.evaluate(() => {
          if (window.gc) {
            window.gc();
          }
        });
      }
    } catch (error) {
      logger.debug({ error }, 'Error triggering garbage collection');
    }
  }
}

/**
 * Default resource monitoring configuration
 */
export const DEFAULT_RESOURCE_CONFIG: ResourceMonitoringConfig = {
  enabled: true,
  intervalMs: 10000,
  thresholds: {
    memoryWarning: 1024 * 1024 * 500, // 500MB
    memoryCritical: 1024 * 1024 * 1000, // 1GB
    cpuWarning: 70,
    cpuCritical: 90,
    connectionWarning: 100,
    connectionCritical: 200,
    handleWarning: 1000,
    handleCritical: 2000,
  },
  enableSystemMonitoring: true,
  enableBrowserMonitoring: true,
  enableGarbageCollection: true,
  gcTriggerThreshold: 80,
  enableMemoryOptimization: true,
  enableCpuOptimization: true,
};