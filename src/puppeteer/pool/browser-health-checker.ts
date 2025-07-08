/**
 * Browser Health Checker for Puppeteer Pool
 * @module puppeteer/pool/browser-health-checker
 * @nist si-4 "Information system monitoring"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { Browser, LaunchOptions } from 'puppeteer';
import * as puppeteer from 'puppeteer';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('browser-health-checker');

/**
 * Health check configuration options
 */
export interface HealthCheckOptions {
  /** Maximum memory usage in MB before considering unhealthy */
  maxMemoryMB: number;

  /** Maximum number of pages before considering unhealthy */
  maxPageCount: number;

  /** Timeout for responsiveness check in ms */
  responseTimeout: number;

  /** Health check interval in ms */
  checkInterval: number;

  /** Enable automatic recovery of unhealthy browsers */
  enableAutoRecovery?: boolean;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Overall health status */
  isHealthy: boolean;

  /** Connection status */
  connectionHealthy: boolean;

  /** Memory usage status */
  memoryHealthy: boolean;

  /** Page count status */
  pageCountHealthy: boolean;

  /** Responsiveness status */
  responsive: boolean;

  /** Reason for unhealthy status */
  reason?: string;

  /** Health metrics */
  metrics: {
    memoryUsageMB: number;
    pageCount: number;
    useCount: number;
    uptime: number;
    lastChecked: Date;
  };
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  /** Whether recovery was performed */
  recovered: boolean;

  /** New browser instance if recovered */
  newBrowser?: Browser;

  /** Health check result */
  health: HealthCheckResult;

  /** Error if recovery failed */
  error?: Error;
}

/**
 * Browser health checker implementation
 * @nist si-4 "Information system monitoring"
 */
export class BrowserHealthChecker {
  private config: HealthCheckOptions;

  constructor(options: HealthCheckOptions) {
    this.config = this.validateConfig(options);
  }

  /**
   * Check health of a browser instance
   * @nist si-4 "Information system monitoring"
   */
  async checkHealth(instance: BrowserInstance): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      isHealthy: true,
      connectionHealthy: true,
      memoryHealthy: true,
      pageCountHealthy: true,
      responsive: true,
      metrics: {
        memoryUsageMB: 0,
        pageCount: 0,
        useCount: instance.useCount,
        uptime: Date.now() - instance.createdAt.getTime(),
        lastChecked: new Date(),
      },
    };

    try {
      // Check connection
      if (!instance.browser.isConnected()) {
        result.connectionHealthy = false;
        result.isHealthy = false;
        result.reason = 'Browser disconnected';
        return result;
      }

      // Check process
      const process = instance.browser.process();
      if (!process) {
        result.connectionHealthy = false;
        result.isHealthy = false;
        result.reason = 'Browser process not found';
        return result;
      }

      // Check responsiveness
      const responsive = await this.checkResponsiveness(instance.browser);
      if (!responsive) {
        result.responsive = false;
        result.isHealthy = false;
        result.reason = 'Browser unresponsive';
      }

      // Check memory usage
      const memoryUsage = await this.checkMemoryUsage(instance.browser);
      result.metrics.memoryUsageMB = memoryUsage;

      if (memoryUsage > this.config.maxMemoryMB) {
        result.memoryHealthy = false;
        result.isHealthy = false;
        result.reason = `Excessive memory usage: ${memoryUsage.toFixed(2)}MB`;
      }

      // Check page count
      const pages = await instance.browser.pages();
      result.metrics.pageCount = pages.length;

      if (pages.length > this.config.maxPageCount) {
        result.pageCountHealthy = false;
        result.isHealthy = false;
        result.reason = `Too many pages: ${pages.length}`;
      }

      const duration = Date.now() - startTime;
      logger.debug(
        {
          browserId: instance.id,
          result,
          duration,
        },
        'Health check completed',
      );

      return result;
    } catch (error) {
      logger.error(
        {
          browserId: instance.id,
          error,
        },
        'Health check failed',
      );

      result.isHealthy = false;
      result.reason = error instanceof Error ? error.message : 'Unknown error';
      return result;
    }
  }

  /**
   * Check responsiveness of browser
   */
  private async checkResponsiveness(browser: Browser): Promise<boolean> {
    try {
      const pages = await browser.pages();
      if (pages.length === 0) {
        return true; // No pages to check
      }

      const page = pages[0];
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), this.config.responseTimeout);
      });

      const evalPromise = page?.evaluate(() => 1 + 1).then(() => true) ?? Promise.resolve(false);

      return await Promise.race([evalPromise, timeoutPromise]);
    } catch (error) {
      logger.debug({ error }, 'Responsiveness check failed');
      return false;
    }
  }

  /**
   * Check memory usage of browser
   */
  private async checkMemoryUsage(browser: Browser): Promise<number> {
    try {
      const pages = await browser.pages();
      if (pages.length === 0) {
        return 0;
      }

      const page = pages[0];
      if (!page) {
        return 0;
      }
      const metrics = await page.metrics();
      const memoryMB = (metrics.JSHeapUsedSize ?? 0) / (1024 * 1024);

      return memoryMB;
    } catch (error) {
      logger.debug({ error }, 'Memory check failed');
      return 0;
    }
  }

  /**
   * Restart an unhealthy browser
   * @nist ac-12 "Session termination"
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  async restartBrowser(instance: BrowserInstance, launchOptions: LaunchOptions): Promise<Browser> {
    logger.info(
      {
        browserId: instance.id,
        pid: instance.pid,
      },
      'Restarting unhealthy browser',
    );

    try {
      // Close the old browser
      await instance.browser.close();
    } catch (error) {
      logger.error(
        {
          browserId: instance.id,
          error,
        },
        'Failed to close unhealthy browser',
      );
    }

    // Launch new browser
    const newBrowser = await puppeteer.launch(launchOptions);

    logger.info(
      {
        browserId: instance.id,
        newPid: newBrowser.process()?.pid,
      },
      'Browser restarted successfully',
    );

    return newBrowser;
  }

  /**
   * Check multiple browser instances
   */
  async checkMultiple(instances: BrowserInstance[]): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    await Promise.all(
      instances.map(async (instance) => {
        const result = await this.checkHealth(instance);
        results.set(instance.id, result);
      }),
    );

    return results;
  }

  /**
   * Check and recover if needed
   * @nist si-4 "Information system monitoring"
   * @nist si-7 "Software, firmware, and information integrity"
   */
  async checkAndRecover(
    instance: BrowserInstance,
    launchOptions: LaunchOptions,
  ): Promise<RecoveryResult> {
    const health = await this.checkHealth(instance);

    if (health.isHealthy === false && this.config.enableAutoRecovery === true) {
      try {
        const newBrowser = await this.restartBrowser(instance, launchOptions);

        return {
          recovered: true,
          newBrowser,
          health,
        };
      } catch (error) {
        logger.error(
          {
            browserId: instance.id,
            error,
          },
          'Failed to recover unhealthy browser',
        );

        return {
          recovered: false,
          health,
          error: error as Error,
        };
      }
    }

    return {
      recovered: false,
      health,
    };
  }

  /**
   * Update configuration
   * @nist cm-7 "Least functionality"
   */
  updateConfig(updates: Partial<HealthCheckOptions>): void {
    const newConfig = { ...this.config, ...updates };
    this.config = this.validateConfig(newConfig);

    logger.info(
      {
        ...updates,
      },
      'Health checker configuration updated',
    );
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: HealthCheckOptions): HealthCheckOptions {
    if (config.maxMemoryMB <= 0) {
      throw new Error('Invalid configuration: maxMemoryMB must be positive');
    }

    if (config.maxPageCount <= 0) {
      throw new Error('Invalid configuration: maxPageCount must be positive');
    }

    if (config.responseTimeout <= 0) {
      throw new Error('Invalid configuration: responseTimeout must be positive');
    }

    if (config.checkInterval <= 0) {
      throw new Error('Invalid configuration: checkInterval must be positive');
    }

    return config;
  }
}
