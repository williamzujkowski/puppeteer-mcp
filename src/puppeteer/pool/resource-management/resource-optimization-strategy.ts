/**
 * Resource optimization strategy interface
 * @module puppeteer/pool/resource-management/resource-optimization-strategy
 * @nist sc-3 "Security function isolation"
 */

import type { Page, Browser } from 'puppeteer';

/**
 * Optimization result
 */
export interface OptimizationResult {
  success: boolean;
  optimizationsApplied: string[];
  errors: string[];
}

/**
 * Resource optimization strategy interface
 */
export interface IResourceOptimizationStrategy {
  /**
   * Apply optimizations to a page
   */
  optimizePage(page: Page): Promise<OptimizationResult>;

  /**
   * Apply optimizations to a browser
   */
  optimizeBrowser(browser: Browser): Promise<OptimizationResult>;

  /**
   * Get strategy name
   */
  getName(): string;

  /**
   * Check if strategy is enabled
   */
  isEnabled(): boolean;

  /**
   * Update configuration
   */
  updateConfig(config: any): void;
}