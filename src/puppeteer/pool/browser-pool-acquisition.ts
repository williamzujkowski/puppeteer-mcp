/**
 * Browser pool acquisition logic
 * @module puppeteer/pool/browser-pool-acquisition
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import type { Browser } from 'puppeteer';
import type { BrowserInstance, BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { launchBrowser } from './browser-utils.js';
import { BrowserHealthMonitor } from './browser-health.js';
import { BrowserQueue } from './browser-queue.js';

/**
 * Parameters for createAndAcquireBrowser
 */
export interface CreateAndAcquireBrowserParams {
  sessionId: string;
  options: BrowserPoolOptions;
  browsers: Map<string, InternalBrowserInstance>;
  healthMonitor: BrowserHealthMonitor;
  onHealthCheckFailed: (browserId: string) => void;
}

/**
 * Create and acquire a new browser
 */
export async function createAndAcquireBrowser(
  params: CreateAndAcquireBrowserParams,
): Promise<BrowserInstance> {
  const { sessionId, options, browsers, healthMonitor, onHealthCheckFailed } = params;

  const { instance } = await launchNewBrowser(
    options,
    browsers,
    healthMonitor,
    onHealthCheckFailed,
  );

  // Activate for session
  instance.state = 'active';
  instance.sessionId = sessionId;
  instance.lastUsedAt = new Date();

  return instance;
}

/**
 * Queue a browser acquisition request
 */
export function queueAcquisition(
  sessionId: string,
  queue: BrowserQueue,
  acquisitionTimeout: number,
): Promise<BrowserInstance> {
  return new Promise((resolve, reject) => {
    queue.enqueue({
      sessionId,
      priority: 0, // Default priority
      timeout: acquisitionTimeout,
      resolve,
      reject,
    });
  });
}

/**
 * Launch a new browser
 */
export async function launchNewBrowser(
  options: BrowserPoolOptions,
  browsers: Map<string, InternalBrowserInstance>,
  healthMonitor: BrowserHealthMonitor,
  onHealthCheckFailed: (browserId: string) => void,
): Promise<{ browser: Browser; instance: InternalBrowserInstance }> {
  // In CI, add retry logic for browser launch
  let result;
  if (process.env.CI === 'true') {
    let retries = 3;
    let lastError: Error | null = null;
    while (retries > 0) {
      try {
        result = await launchBrowser(options);
        break; // Success
      } catch (error) {
        lastError = error as Error;
        retries--;
        if (retries > 0) {
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
    if (!result) {
      throw lastError || new Error('Failed to launch browser after retries');
    }
  } else {
    result = await launchBrowser(options);
  }

  // Create internal instance with additional state
  const internalInstance: InternalBrowserInstance = {
    ...result.instance,
    state: 'idle',
    sessionId: null,
    errorCount: 0,
  };

  // Store instance
  browsers.set(internalInstance.id, internalInstance);

  // Start health monitoring
  healthMonitor.startMonitoring({
    browserId: internalInstance.id,
    browser: result.browser,
    instance: internalInstance,
    onUnhealthy: () => onHealthCheckFailed(internalInstance.id),
    intervalMs: options.healthCheckInterval,
  });

  return { browser: result.browser, instance: internalInstance };
}
