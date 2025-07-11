/**
 * Browser utility functions
 * @module puppeteer/pool/browser-utils
 */

import { Browser, LaunchOptions } from 'puppeteer';
import * as puppeteer from 'puppeteer';
import type { BrowserInstance, BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { createLogger } from '../../utils/logger.js';
import { instrumentBrowser, isTelemetryInitialized } from '../../telemetry-stub.js';

const logger = createLogger('browser-utils');

/**
 * Launch a new browser instance
 */
export async function launchBrowser(
  options: BrowserPoolOptions,
): Promise<{ browser: Browser; instance: BrowserInstance }> {
  const launchOptions: LaunchOptions = {
    ...options.launchOptions,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  };

  let browser = await puppeteer.launch(launchOptions);
  
  // Instrument browser if telemetry is enabled
  if (isTelemetryInitialized()) {
    browser = instrumentBrowser(browser);
  }

  // Verify browser is working
  const version = await browser.version();

  const instance: BrowserInstance = {
    id: `browser-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    browser,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    useCount: 0,
    pageCount: 0,
  };

  logger.debug({ browserId: instance.id, version }, 'Browser launched successfully');

  return { browser, instance };
}

/**
 * Check if browser has been idle too long
 */
export function isIdleTooLong(instance: InternalBrowserInstance, maxIdleTimeMs: number): boolean {
  if (instance.state !== 'idle') {
    return false;
  }

  return Date.now() - instance.lastUsedAt.getTime() > maxIdleTimeMs;
}

/**
 * Check if browser needs restart
 */
export function needsRestart(instance: InternalBrowserInstance): boolean {
  return instance.errorCount > 3 || instance.useCount > 100;
}

/**
 * Close browser
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  try {
    await browser.close();
  } catch (error) {
    // Browser might already be closed
    logger.debug({ error }, 'Error closing browser - might already be closed');
  }
}

/**
 * Restart browser
 */
export async function restartBrowser(
  _instance: InternalBrowserInstance,
  options: BrowserPoolOptions,
): Promise<Browser> {
  const { browser } = await launchBrowser(options);
  return browser;
}
