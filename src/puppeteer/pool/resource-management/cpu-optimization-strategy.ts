/**
 * CPU optimization strategy implementation
 * @module puppeteer/pool/resource-management/cpu-optimization-strategy
 * @nist sc-3 "Security function isolation"
 */

import type { Page, Browser } from 'puppeteer';
import { createLogger } from '../../../utils/logger.js';
import type { CpuOptimizationOptions } from './resource-types.js';
import type { IResourceOptimizationStrategy, OptimizationResult } from './resource-optimization-strategy.js';

const logger = createLogger('cpu-optimization-strategy');

/**
 * CPU optimization strategy
 * @nist sc-3 "Security function isolation"
 */
export class CpuOptimizationStrategy implements IResourceOptimizationStrategy {
  private config: CpuOptimizationOptions;

  constructor(config: CpuOptimizationOptions) {
    this.config = config;
  }

  /**
   * Get strategy name
   */
  getName(): string {
    return 'cpu-optimization';
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.config.enableRequestThrottling || 
           this.config.enableResourceBlocking || 
           this.config.enableAnimationDisabling;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CpuOptimizationOptions>): void {
    this.config = { ...this.config, ...config };
    logger.debug('CPU optimization config updated');
  }

  /**
   * Apply optimizations to a page
   */
  async optimizePage(page: Page): Promise<OptimizationResult> {
    const optimizationsApplied: string[] = [];
    const errors: string[] = [];

    try {
      // Resource blocking
      if (this.config.enableResourceBlocking && this.config.blockedResourceTypes.length > 0) {
        try {
          await page.setRequestInterception(true);
          
          const blockedTypes = new Set(this.config.blockedResourceTypes);
          
          page.on('request', (req) => {
            if (blockedTypes.has(req.resourceType())) {
              req.abort();
            } else {
              req.continue();
            }
          });

          optimizationsApplied.push('resource-blocking');
          logger.debug({ blockedTypes: this.config.blockedResourceTypes }, 'Applied resource blocking');
        } catch (error) {
          errors.push(`Resource blocking failed: ${error}`);
          logger.debug({ error }, 'Failed to apply resource blocking');
        }
      }

      // Animation disabling
      if (this.config.enableAnimationDisabling) {
        try {
          await page.evaluateOnNewDocument(() => {
            // Disable all animations and transitions
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

            // Disable video autoplay
            document.addEventListener('DOMContentLoaded', () => {
              const videos = document.querySelectorAll('video');
              videos.forEach(video => {
                video.pause();
                video.preload = 'none';
              });
            });

            // Reduce timer precision to save CPU
            const originalSetTimeout = window.setTimeout;
            const originalSetInterval = window.setInterval;
            
            (window as any).setTimeout = function(fn: any, delay: any) {
              // Round delays to nearest 100ms to reduce timer precision
              return originalSetTimeout(fn, Math.max(100, Math.round(delay / 100) * 100));
            };
            
            (window as any).setInterval = function(fn: any, delay: any) {
              // Minimum interval of 100ms
              return originalSetInterval(fn, Math.max(100, delay));
            };
          });

          optimizationsApplied.push('animation-disabling');
        } catch (error) {
          errors.push(`Animation disabling failed: ${error}`);
          logger.debug({ error }, 'Failed to disable animations');
        }
      }

      // Request throttling
      if (this.config.enableRequestThrottling) {
        try {
          // Throttle network to reduce CPU usage
          await page.setCacheEnabled(true); // Enable cache to reduce requests
          
          // Set CPU throttling
          const client = await page.target().createCDPSession();
          await client.send('Emulation.setCPUThrottlingRate', { rate: 2 }); // 2x slowdown
          
          optimizationsApplied.push('request-throttling');
        } catch (error) {
          errors.push(`Request throttling failed: ${error}`);
          logger.debug({ error }, 'Failed to apply request throttling');
        }
      }

      // Additional CPU optimizations
      try {
        // Disable web fonts
        await page.evaluateOnNewDocument(() => {
          const style = document.createElement('style');
          style.textContent = `
            @font-face { font-family: 'disable-all'; }
            * { font-family: sans-serif !important; }
          `;
          document.head.appendChild(style);
        });

        // Reduce render frequency
        await page.evaluateOnNewDocument(() => {
          // Override requestAnimationFrame to reduce frequency
          const originalRAF = window.requestAnimationFrame;
          let lastTime = 0;
          (window as any).requestAnimationFrame = function(callback: any) {
            const now = Date.now();
            if (now - lastTime < 50) { // Max 20fps
              return originalRAF(() => (window as any).requestAnimationFrame(callback));
            }
            lastTime = now;
            return originalRAF(callback);
          };
        });

        optimizationsApplied.push('render-optimization');
      } catch (error) {
        errors.push(`Additional CPU optimizations failed: ${error}`);
        logger.debug({ error }, 'Failed to apply additional CPU optimizations');
      }

    } catch (error) {
      logger.error({ error }, 'Error applying CPU optimizations');
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
      
      // Limit concurrent pages if needed
      if (this.config.maxConcurrentRequests && pages.length > this.config.maxConcurrentRequests) {
        const pagesToClose = pages.length - this.config.maxConcurrentRequests;
        for (let i = 0; i < pagesToClose; i++) {
          try {
            await pages[i]?.close();
            optimizationsApplied.push(`closed-excess-page-${i}`);
          } catch (error) {
            errors.push(`Failed to close excess page ${i}: ${error}`);
          }
        }
      }

      // Apply optimizations to remaining pages
      const remainingPages = await browser.pages();
      for (const page of remainingPages) {
        const result = await this.optimizePage(page);
        if (!result.success) {
          errors.push(...result.errors);
        }
      }

      optimizationsApplied.push('browser-cpu-optimization');

    } catch (error) {
      logger.error({ error }, 'Error optimizing browser for CPU');
      errors.push(`Browser CPU optimization error: ${error}`);
    }

    return {
      success: errors.length === 0,
      optimizationsApplied,
      errors,
    };
  }
}