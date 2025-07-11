/**
 * Memory optimization strategy implementation
 * @module puppeteer/pool/resource-management/memory-optimization-strategy
 * @nist sc-3 "Security function isolation"
 */

import type { Page, Browser } from 'puppeteer';
import { createLogger } from '../../../utils/logger.js';
import type { MemoryOptimizationOptions } from './resource-types.js';
import type { IResourceOptimizationStrategy, OptimizationResult } from './resource-optimization-strategy.js';

const logger = createLogger('memory-optimization-strategy');

/**
 * Memory optimization strategy
 * @nist sc-3 "Security function isolation"
 */
export class MemoryOptimizationStrategy implements IResourceOptimizationStrategy {
  private config: MemoryOptimizationOptions;

  constructor(config: MemoryOptimizationOptions) {
    this.config = config;
  }

  /**
   * Get strategy name
   */
  getName(): string {
    return 'memory-optimization';
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.config.enablePageMemoryReduction || 
           this.config.enableImageOptimization || 
           this.config.enableJavaScriptOptimization || 
           this.config.enableCacheOptimization;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MemoryOptimizationOptions>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Memory optimization config updated');
  }

  /**
   * Apply optimizations to a page
   */
  async optimizePage(page: Page): Promise<OptimizationResult> {
    const optimizationsApplied: string[] = [];
    const errors: string[] = [];

    try {
      // Image optimization
      if (this.config.enableImageOptimization) {
        try {
          await page.setRequestInterception(true);
          
          page.on('request', (req) => {
            if (req.resourceType() === 'image') {
              // Block data URIs to save memory
              if (req.url().startsWith('data:')) {
                req.abort();
                return;
              }
              // Block large images
              const headers = req.headers();
              const contentLength = headers['content-length'];
              if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB
                req.abort();
                return;
              }
            }
            req.continue();
          });

          optimizationsApplied.push('image-optimization');
        } catch (error) {
          errors.push(`Image optimization failed: ${error}`);
          logger.debug({ error }, 'Failed to apply image optimization');
        }
      }

      // Cache optimization
      if (this.config.enableCacheOptimization) {
        try {
          await page.setCacheEnabled(false);
          optimizationsApplied.push('cache-disabled');
        } catch (error) {
          errors.push(`Cache optimization failed: ${error}`);
          logger.debug({ error }, 'Failed to disable cache');
        }
      }

      // JavaScript optimization
      if (this.config.enableJavaScriptOptimization) {
        try {
          // Set viewport to reduce rendering overhead
          await page.setViewport({ width: 1280, height: 720 });
          
          // Disable unnecessary features
          await page.evaluateOnNewDocument(() => {
            // Disable smooth scrolling
            document.documentElement.style.scrollBehavior = 'auto';
            
            // Disable web fonts to save memory
            const style = document.createElement('style');
            style.textContent = `
              * { font-family: sans-serif !important; }
            `;
            document.head.appendChild(style);
          });

          optimizationsApplied.push('javascript-optimization');
        } catch (error) {
          errors.push(`JavaScript optimization failed: ${error}`);
          logger.debug({ error }, 'Failed to apply JavaScript optimization');
        }
      }

      // Page memory reduction
      if (this.config.enablePageMemoryReduction) {
        try {
          // Set reduced viewport
          await page.setViewport({ 
            width: 1024, 
            height: 768,
            deviceScaleFactor: 1
          });

          // Disable unnecessary features
          await page.setBypassCSP(true);
          
          optimizationsApplied.push('page-memory-reduction');
        } catch (error) {
          errors.push(`Page memory reduction failed: ${error}`);
          logger.debug({ error }, 'Failed to apply page memory reduction');
        }
      }

    } catch (error) {
      logger.error({ error }, 'Error applying memory optimizations');
      errors.push(`General optimization error: ${error}`);
    }

    return {
      success: errors.length === 0,
      optimizationsApplied,
      errors,
    };
  }

  /**
   * Apply optimizations to a browser
   */
  async optimizeBrowser(browser: Browser): Promise<OptimizationResult> {
    const optimizationsApplied: string[] = [];
    const errors: string[] = [];

    try {
      // Apply page-level optimizations to all existing pages
      const pages = await browser.pages();
      
      for (const page of pages) {
        const result = await this.optimizePage(page);
        if (!result.success) {
          errors.push(...result.errors);
        }
      }

      // Trigger garbage collection if available
      if (this.config.enablePageMemoryReduction) {
        try {
          for (const page of pages) {
            await page.evaluate(() => {
              if ((window as any).gc) {
                (window as any).gc();
              }
            });
          }
          optimizationsApplied.push('garbage-collection');
        } catch (error) {
          errors.push(`Garbage collection failed: ${error}`);
          logger.debug({ error }, 'Failed to trigger garbage collection');
        }
      }

      // Close unused pages
      if (pages.length > this.config.maxPageMemoryMB / 50) { // Rough estimate: 50MB per page
        const pagesToClose = pages.length - Math.floor(this.config.maxPageMemoryMB / 50);
        for (let i = 0; i < pagesToClose && i < pages.length - 1; i++) {
          try {
            await pages[i]?.close();
            optimizationsApplied.push(`closed-page-${i}`);
          } catch (error) {
            errors.push(`Failed to close page ${i}: ${error}`);
          }
        }
      }

    } catch (error) {
      logger.error({ error }, 'Error optimizing browser');
      errors.push(`Browser optimization error: ${error}`);
    }

    return {
      success: errors.length === 0,
      optimizationsApplied,
      errors,
    };
  }
}