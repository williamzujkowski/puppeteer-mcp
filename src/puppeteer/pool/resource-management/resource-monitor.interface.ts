/**
 * Resource monitor interface - Strategy pattern
 * @module puppeteer/pool/resource-management/resource-monitor.interface
 * @nist si-4 "Information system monitoring"
 */

import type { SystemResources, BrowserResourceUsage } from './resource-types.js';

/**
 * Abstract resource monitor interface
 */
export interface IResourceMonitor<T = any> {
  /**
   * Start monitoring
   */
  start(): Promise<void>;

  /**
   * Stop monitoring
   */
  stop(): void;

  /**
   * Update resources
   */
  update(): Promise<void>;

  /**
   * Get current resource state
   */
  getResources(): T | null;

  /**
   * Check if monitoring is active
   */
  isActive(): boolean;
}

/**
 * System resource monitor interface
 */
export interface ISystemResourceMonitor extends IResourceMonitor<SystemResources> {
  /**
   * Get CPU usage percentage
   */
  getCpuUsage(): Promise<number>;

  /**
   * Get process count
   */
  getProcessCount(): Promise<number>;
}

/**
 * Browser resource monitor interface
 */
export interface IBrowserResourceMonitor
  extends IResourceMonitor<Map<string, BrowserResourceUsage>> {
  /**
   * Monitor specific browser
   */
  monitorBrowser(browserId: string, browser: any): Promise<BrowserResourceUsage>;

  /**
   * Get browser resource usage
   */
  getBrowserUsage(browserId: string): BrowserResourceUsage | undefined;

  /**
   * Remove browser from monitoring
   */
  removeBrowser(browserId: string): void;
}
