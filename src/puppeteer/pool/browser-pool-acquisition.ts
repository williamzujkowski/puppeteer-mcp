/**
 * Browser pool acquisition logic
 * @module puppeteer/pool/browser-pool-acquisition
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import type { Browser } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../core/errors/app-error.js';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance, BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { launchBrowser } from './browser-lifecycle.js';
import { BrowserHealthMonitor } from './browser-health.js';
import { BrowserQueue } from './browser-queue.js';

const logger = createLogger('browser-pool-acquisition');

/**
 * Create and acquire a new browser
 */
export async function createAndAcquireBrowser(
  sessionId: string,
  options: BrowserPoolOptions,
  browsers: Map<string, InternalBrowserInstance>,
  healthMonitor: BrowserHealthMonitor,
  onHealthCheckFailed: (browserId: string) => void
): Promise<BrowserInstance> {
  const { browser, instance } = await launchNewBrowser(
    options,
    browsers,
    healthMonitor,
    onHealthCheckFailed
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
  acquisitionTimeout: number
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
  onHealthCheckFailed: (browserId: string) => void
): Promise<{ browser: Browser; instance: InternalBrowserInstance }> {
  const result = await launchBrowser(options);
  
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
  healthMonitor.startMonitoring(
    internalInstance.id,
    result.browser,
    internalInstance,
    () => onHealthCheckFailed(internalInstance.id),
    options.healthCheckInterval
  );

  return { browser: result.browser, instance: internalInstance };
}