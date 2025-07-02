/**
 * Browser Lifecycle Management
 * @module puppeteer/pool/browser-lifecycle
 * @nist ac-3 "Access enforcement"
 * @nist ac-12 "Session termination"
 */

import puppeteer, { type Browser, type LaunchOptions } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance, BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';

const logger = createLogger('browser-lifecycle');

/**
 * Launch a new browser instance
 * @nist ac-3 "Access enforcement"
 */
export async function launchBrowser(
  options: BrowserPoolOptions
): Promise<{ browser: Browser; instance: BrowserInstance }> {
  const browserId = uuidv4();
  const startTime = Date.now();

  logger.info({ browserId }, 'Launching new browser');

  try {
    const launchOptions: LaunchOptions = {
      ...options.launchOptions,
      headless: options.launchOptions?.headless ?? true,
      args: options.launchOptions?.args ?? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--deterministic-fetch',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
      ],
      defaultViewport: options.launchOptions?.defaultViewport ?? {
        width: 1920,
        height: 1080,
      },
      timeout: options.launchOptions?.timeout ?? 30000,
    };

    const browser = await puppeteer.launch(launchOptions);

    // Verify browser is working
    const version = await browser.version();
    
    const instance: BrowserInstance = {
      id: browserId,
      browser,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 0,
      pageCount: 0,
    };

    const launchTime = Date.now() - startTime;

    logger.info({
      browserId,
      version,
      launchTime,
    }, 'Browser launched successfully');

    return { browser, instance };

  } catch (error) {
    const launchTime = Date.now() - startTime;
    
    logger.error({
      browserId,
      error: error instanceof Error ? error.message : 'Unknown error',
      launchTime,
    }, 'Failed to launch browser');

    throw error;
  }
}

/**
 * Close a browser instance
 * @nist ac-12 "Session termination"
 */
export async function closeBrowser(
  browser: Browser,
  instance: BrowserInstance
): Promise<void> {
  const startTime = Date.now();

  logger.info({ browserId: instance.id }, 'Closing browser');

  try {
    // Close all pages first
    const pages = await browser.pages();
    await Promise.allSettled(
      pages.map(page => page.close().catch(() => {
        // Ignore page close errors
      }))
    );

    // Close browser
    await browser.close();

    const closeTime = Date.now() - startTime;

    logger.info({
      browserId: instance.id,
      closeTime,
      pagesClosed: pages.length,
    }, 'Browser closed successfully');

  } catch (error) {
    logger.error({
      browserId: instance.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Error closing browser');

    // Try to kill the process if close failed
    try {
      const process = browser.process();
      if (process) {
        process.kill('SIGKILL');
      }
    } catch (killError) {
      logger.error({
        browserId: instance.id,
        error: killError instanceof Error ? killError.message : 'Unknown error',
      }, 'Failed to kill browser process');
    }
  }
}

/**
 * Restart a browser instance
 * @nist ac-12 "Session termination"
 * @nist ac-3 "Access enforcement"
 */
export async function restartBrowser(
  browser: Browser,
  instance: BrowserInstance,
  options: BrowserPoolOptions
): Promise<{ browser: Browser; instance: BrowserInstance }> {
  logger.info({ browserId: instance.id }, 'Restarting browser');

  // Close existing browser
  await closeBrowser(browser, instance);

  // Launch new browser
  const result = await launchBrowser(options);

  // Preserve some state
  result.instance.useCount = instance.useCount;

  return result;
}

/**
 * Clean up idle browser
 * @nist ac-12 "Session termination"
 */
export function isIdleTooLong(
  instance: BrowserInstance,
  maxIdleTime: number
): boolean {
  // Check if the browser has been idle for too long
  const idleTime = Date.now() - instance.lastUsedAt.getTime();
  return idleTime > maxIdleTime;
}

/**
 * Check if browser needs restart
 */
export function needsRestart(
  instance: BrowserInstance,
  maxUses: number = 100,
  maxAge: number = 24 * 60 * 60 * 1000 // 24 hours
): boolean {
  // Too many uses
  if (instance.useCount >= maxUses) {
    logger.warn({
      browserId: instance.id,
      useCount: instance.useCount,
      maxUses,
    }, 'Browser needs restart due to usage');
    return true;
  }

  // Too old
  const age = Date.now() - instance.createdAt.getTime();
  if (age > maxAge) {
    logger.warn({
      browserId: instance.id,
      age,
      maxAge,
    }, 'Browser needs restart due to age');
    return true;
  }

  return false;
}