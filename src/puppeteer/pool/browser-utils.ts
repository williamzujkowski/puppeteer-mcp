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

  logger.debug(
    {
      executablePath: launchOptions.executablePath,
      headless: launchOptions.headless,
      args: launchOptions.args?.slice(0, 5), // Log first 5 args to avoid clutter
      isCI: process.env.CI === 'true',
    },
    'Launching browser with options',
  );

  // Add timeout for CI environments
  const launchTimeout = process.env.CI === 'true' ? 60000 : 30000;
  
  let browser: Browser;
  try {
    browser = await puppeteer.launch({
      ...launchOptions,
      timeout: launchTimeout,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const diagnosticInfo = {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      launchOptions: {
        executablePath: launchOptions.executablePath,
        headless: launchOptions.headless,
        argsCount: launchOptions.args?.length || 0,
        timeout: launchTimeout,
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        CI: process.env.CI,
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
        PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD,
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
      },
    };
    
    logger.error(diagnosticInfo, 'Failed to launch browser - diagnostic information');
    
    // Enhance error message for better debugging
    const enhancedError = new Error(
      `Failed to launch browser: ${errorMessage}\n` +
      `Platform: ${process.platform}, CI: ${process.env.CI === 'true'}\n` +
      `Executable: ${launchOptions.executablePath || 'default'}\n` +
      `Timeout: ${launchTimeout}ms`
    );
    enhancedError.stack = error instanceof Error ? error.stack : undefined;
    throw enhancedError;
  }

  // Instrument browser if telemetry is enabled
  if (isTelemetryInitialized()) {
    browser = instrumentBrowser(browser);
  }

  // Verify browser is working
  let version: string;
  try {
    version = await browser.version();
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Browser launched but failed version check',
    );
    await browser.close();
    throw error;
  }

  const instance: BrowserInstance = {
    id: `browser-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    browser,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    useCount: 0,
    pageCount: 0,
  };

  logger.info(
    {
      browserId: instance.id,
      version,
      executablePath: launchOptions.executablePath,
    },
    'Browser launched successfully',
  );

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
