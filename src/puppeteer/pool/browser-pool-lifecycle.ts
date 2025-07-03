/**
 * Browser Pool Lifecycle Methods
 * @module puppeteer/pool/browser-pool-lifecycle
 */

import type { Browser } from 'puppeteer';
import { EventEmitter } from 'events';
import type { BrowserInstance, BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { BrowserHealthMonitor } from './browser-health.js';
import { BrowserQueue } from './browser-queue.js';
import { BrowserPoolMaintenance } from './browser-pool-maintenance.js';
import {
  createAndAcquireBrowser,
  queueAcquisition,
  launchNewBrowser,
} from './browser-pool-acquisition.js';
import { setupQueueHandlers } from './browser-pool-event-setup.js';
import { initializePool } from './browser-pool-init.js';
import { shutdownPool } from './browser-pool-shutdown.js';
import { DEFAULT_OPTIONS } from './browser-pool-config.js';
import { findIdleBrowser } from './browser-pool-operations.js';
import { activateBrowserForSession } from './browser-pool-private-methods.js';

/**
 * Initialize browser pool components
 * @nist ac-3 "Access enforcement"
 */
export function initializeBrowserPool(
  eventEmitter: EventEmitter,
  options: Partial<BrowserPoolOptions>,
  findIdleBrowser: () => InternalBrowserInstance | null,
  performMaintenance: () => Promise<void>
): {
  options: BrowserPoolOptions;
  browsers: Map<string, InternalBrowserInstance>;
  healthMonitor: BrowserHealthMonitor;
  queue: BrowserQueue;
  maintenance: BrowserPoolMaintenance;
} {
  const fullOptions = { ...DEFAULT_OPTIONS, ...options } as BrowserPoolOptions;
  const browsers = new Map<string, InternalBrowserInstance>();
  const healthMonitor = new BrowserHealthMonitor();
  const queue = new BrowserQueue();
  const maintenance = new BrowserPoolMaintenance();

  // Start maintenance cycle
  maintenance.startMaintenance(performMaintenance, 60000);

  // Set up queue event handling
  setupQueueHandlers(eventEmitter, queue, findIdleBrowser);

  return { options: fullOptions, browsers, healthMonitor, queue, maintenance };
}

/**
 * Initialize the pool with browsers
 * @nist ac-3 "Access enforcement"
 */
export async function initializePoolWithBrowsers(
  eventEmitter: EventEmitter,
  maxBrowsers: number,
  launchBrowser: () => Promise<{ browser: Browser; instance: InternalBrowserInstance }>
): Promise<void> {
  // Note: First parameter type mismatch - initializePool expects BrowserPool but we have EventEmitter
  // Cast to any to maintain compatibility
  await initializePool(eventEmitter as any, maxBrowsers, launchBrowser);
}

/**
 * Shutdown browser pool
 * @nist ac-12 "Session termination"
 */
export async function shutdownBrowserPool(
  browsers: Map<string, InternalBrowserInstance>,
  healthMonitor: BrowserHealthMonitor,
  queue: BrowserQueue,
  maintenance: BrowserPoolMaintenance
): Promise<void> {
  maintenance.setShuttingDown(true);
  maintenance.stopMaintenance();
  await shutdownPool(browsers, healthMonitor, queue);
}

/**
 * Parameters for createAndAcquireNewBrowser
 */
export interface CreateAndAcquireNewBrowserParams {
  sessionId: string;
  options: BrowserPoolOptions;
  browsers: Map<string, InternalBrowserInstance>;
  healthMonitor: BrowserHealthMonitor;
  handleUnhealthyBrowser: (browserId: string) => Promise<void>;
  emitEvent: (event: string, data: any) => void;
}

/**
 * Create and acquire a new browser
 */
export async function createAndAcquireNewBrowser(
  params: CreateAndAcquireNewBrowserParams
): Promise<BrowserInstance> {
  const { sessionId, options, browsers, healthMonitor, handleUnhealthyBrowser, emitEvent } = params;
  
  const instance = await createAndAcquireBrowser({
    sessionId,
    options,
    browsers,
    healthMonitor,
    onHealthCheckFailed: (browserId: string) => {
      void handleUnhealthyBrowser(browserId);
    }
  });
  
  emitEvent('browser:acquired', { browserId: instance.id, sessionId });
  return instance;
}

/**
 * Queue a browser acquisition request
 */
export function queueBrowserAcquisition(
  sessionId: string,
  queue: BrowserQueue,
  acquisitionTimeout: number
): Promise<BrowserInstance> {
  return queueAcquisition(sessionId, queue, acquisitionTimeout);
}

/**
 * Parameters for launchBrowser
 */
export interface LaunchBrowserParams {
  options: BrowserPoolOptions;
  browsers: Map<string, InternalBrowserInstance>;
  healthMonitor: BrowserHealthMonitor;
  handleUnhealthyBrowser: (browserId: string) => Promise<void>;
  emitEvent: (event: string, data: any) => void;
}

/**
 * Launch a new browser
 */
export async function launchBrowser(
  params: LaunchBrowserParams
): Promise<{ browser: Browser; instance: InternalBrowserInstance }> {
  const { options, browsers, healthMonitor, handleUnhealthyBrowser, emitEvent } = params;
  
  const result = await launchNewBrowser(
    options,
    browsers,
    healthMonitor,
    (browserId: string) => {
      void handleUnhealthyBrowser(browserId);
    }
  );
  
  emitEvent('browser:created', { browserId: result.instance.id });
  return result;
}


/**
 * Create BrowserPool helper methods
 */
export function createBrowserPoolHelpers(
  browsers: Map<string, InternalBrowserInstance>,
  options: BrowserPoolOptions,
  emit: (event: string, data: any) => void
): {
  findIdleBrowser: () => InternalBrowserInstance | null;
  activateBrowser: (instance: InternalBrowserInstance, sessionId: string) => InternalBrowserInstance;
  canCreateNewBrowser: () => boolean;
} {
  return {
    findIdleBrowser: () => findIdleBrowser(browsers),
    activateBrowser: (instance: InternalBrowserInstance, sessionId: string) => {
      return activateBrowserForSession(
        instance,
        sessionId,
        (browserId, sid) => emit('browser:acquired', { browserId, sessionId: sid })
      );
    },
    canCreateNewBrowser: () => browsers.size < options.maxBrowsers,
  };
}