/**
 * Page manager factory and utilities
 * @module puppeteer/pages/page-manager-factory
 */

import { AppError } from '../../core/errors/app-error.js';
import type { BrowserPool } from '../interfaces/browser-pool.interface.js';
import { PageManager } from './page-manager.js';

// Singleton factory
let pageManagerInstance: PageManager | null = null;

/**
 * Get page manager instance
 * @param browserPool - Browser pool instance (required on first call)
 * @returns Page manager instance
 */
export function getPageManager(browserPool?: BrowserPool): PageManager {
  if (!pageManagerInstance) {
    if (!browserPool) {
      throw new AppError('Browser pool required for page manager initialization', 500);
    }
    pageManagerInstance = new PageManager(browserPool);
  }
  return pageManagerInstance;
}

/**
 * Reset page manager instance (for testing)
 */
export function resetPageManager(): void {
  pageManagerInstance = null;
}
