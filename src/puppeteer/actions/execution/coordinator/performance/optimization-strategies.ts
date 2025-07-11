/**
 * Performance optimization strategies
 * @module puppeteer/actions/execution/coordinator/performance/optimization-strategies
 * @nist sc-5 "Denial of service protection"
 */

import type { Page } from 'puppeteer';
import type { BrowserAction } from '../../../../interfaces/action-executor.interface.js';

/**
 * Performance optimization strategy interface
 */
export interface OptimizationStrategy {
  name: string;
  enabled: boolean;
  apply(page: Page, action: BrowserAction): Promise<void>;
  cleanup(page: Page): Promise<void>;
}

/**
 * Navigation optimization strategy
 */
export class NavigationOptimizationStrategy implements OptimizationStrategy {
  name = 'NavigationOptimization';
  enabled = true;

  async apply(page: Page): Promise<void> {
    // Wait for network idle for better performance
    await page.setDefaultNavigationTimeout(30000);
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }
}

/**
 * Screenshot optimization strategy
 */
export class ScreenshotOptimizationStrategy implements OptimizationStrategy {
  name = 'ScreenshotOptimization';
  enabled = true;

  async apply(page: Page): Promise<void> {
    // Optimize viewport for screenshots
    const viewport = page.viewport();
    if (viewport && (viewport.width > 1920 || viewport.height > 1080)) {
      await page.setViewport({ width: 1920, height: 1080 });
    }
  }

  async cleanup(): Promise<void> {
    // Viewport reset handled elsewhere
  }
}

/**
 * Extraction optimization strategy
 */
export class ExtractionOptimizationStrategy implements OptimizationStrategy {
  name = 'ExtractionOptimization';
  enabled = true;

  async apply(page: Page): Promise<void> {
    // Disable animations for faster extraction
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });
  }

  async cleanup(): Promise<void> {
    // Style removal handled by page navigation
  }
}

/**
 * Resource blocking optimization strategy
 */
export class ResourceBlockingStrategy implements OptimizationStrategy {
  name = 'ResourceBlocking';
  enabled = true;

  private readonly blockPatterns: RegExp[] = [
    /\.mp4$/i,
    /\.avi$/i,
    /\.mov$/i,
    /\.wmv$/i,
    /\.flv$/i,
    /\.webm$/i,
    /fonts\.googleapis\.com/,
    /\.woff2?$/i,
    /\.ttf$/i,
    /\.otf$/i,
  ];

  async apply(page: Page, action: BrowserAction): Promise<void> {
    const blockList = this.getResourceBlockList(action);

    if (blockList.length === 0) {
      return;
    }

    await page.setRequestInterception(true);

    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();

      // Check if resource should be blocked
      const shouldBlock =
        blockList.includes(resourceType) || this.blockPatterns.some((pattern) => pattern.test(url));

      if (shouldBlock) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Mark that interception is active
    await page.evaluate(() => {
      (window as any).__performanceOptimizations = {
        ...(window as any).__performanceOptimizations,
        requestInterception: true,
      };
    });
  }

  async cleanup(page: Page): Promise<void> {
    // Check if request interception is active
    const hasInterception = await page.evaluate(() => {
      return (window as any).__performanceOptimizations?.requestInterception ?? false;
    });

    if (hasInterception) {
      await page.setRequestInterception(false);
    }
  }

  private getResourceBlockList(action: BrowserAction): string[] {
    const baseBlockList = ['media', 'font'];

    if (action.type === 'getText' || action.type === 'content') {
      return [...baseBlockList, 'image', 'stylesheet'];
    }

    if (
      action.type === 'navigate' &&
      'waitFor' in action &&
      action.waitFor === 'domcontentloaded'
    ) {
      return [...baseBlockList, 'image'];
    }

    return baseBlockList;
  }
}

/**
 * Factory for creating optimization strategies
 */
export class OptimizationStrategyFactory {
  private static strategies = new Map<string, () => OptimizationStrategy>([
    ['navigate', () => new NavigationOptimizationStrategy()],
    ['screenshot', () => new ScreenshotOptimizationStrategy()],
    ['extractContent', () => new ExtractionOptimizationStrategy()],
    ['extractText', () => new ExtractionOptimizationStrategy()],
  ]);

  /**
   * Create strategy for action type
   * @param actionType - Action type
   * @returns Optimization strategy or null
   */
  static createStrategy(actionType: string): OptimizationStrategy | null {
    const factory = this.strategies.get(actionType);
    return factory ? factory() : null;
  }

  /**
   * Register custom strategy factory
   * @param actionType - Action type
   * @param factory - Strategy factory function
   */
  static registerStrategy(actionType: string, factory: () => OptimizationStrategy): void {
    this.strategies.set(actionType, factory);
  }

  /**
   * Get resource blocking strategy
   * @returns Resource blocking strategy
   */
  static getResourceBlockingStrategy(): ResourceBlockingStrategy {
    return new ResourceBlockingStrategy();
  }
}
