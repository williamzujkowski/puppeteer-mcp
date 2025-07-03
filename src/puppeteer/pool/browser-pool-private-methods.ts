/**
 * Browser pool private methods
 * @module puppeteer/pool/browser-pool-private-methods
 */

import type { Browser } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import {
  BrowserPoolMaintenance,
  type InternalBrowserInstance,
} from './browser-pool-maintenance.js';
import { BrowserHealthMonitor } from './browser-health.js';

const logger = createLogger('browser-pool-private-methods');

/**
 * Activate a browser for a session
 */
export function activateBrowserForSession(
  instance: InternalBrowserInstance,
  sessionId: string,
  onActivated: (browserId: string, sessionId: string) => void,
): InternalBrowserInstance {
  instance.state = 'active';
  instance.sessionId = sessionId;
  instance.lastUsedAt = new Date();

  logger.debug(
    {
      browserId: instance.id,
      sessionId,
    },
    'Browser activated for session',
  );

  onActivated(instance.id, sessionId);

  return instance;
}

/**
 * Handle removal of browser
 */
export async function handleRemoveBrowser(
  browserId: string,
  removeBrowser: (browserId: string) => Promise<void>,
  onRemoved: (browserId: string) => void,
): Promise<void> {
  await removeBrowser(browserId);
  onRemoved(browserId);
}

/**
 * Parameters for handleUnhealthyBrowserWithEvent
 */
export interface HandleUnhealthyBrowserWithEventParams {
  browserId: string;
  browsers: Map<string, InternalBrowserInstance>;
  handleUnhealthy: (browserId: string) => Promise<void>;
  onRestarted: (browserId: string) => void;
  onRemoved: (browserId: string) => void;
}

/**
 * Handle unhealthy browser with event
 */
export async function handleUnhealthyBrowserWithEvent(
  params: HandleUnhealthyBrowserWithEventParams,
): Promise<void> {
  const { browserId, browsers, handleUnhealthy, onRestarted, onRemoved } = params;

  await handleUnhealthy(browserId);

  if (browsers.has(browserId)) {
    onRestarted(browserId);
  } else {
    onRemoved(browserId);
  }
}

/**
 * Perform pool maintenance with wrapper
 */
export async function performMaintenanceWrapper(
  performMaintenance: () => Promise<void>,
): Promise<void> {
  await performMaintenance();
}

/**
 * Parameters for handleUnhealthyBrowserDelegate
 */
export interface HandleUnhealthyBrowserDelegateParams {
  browserId: string;
  browsers: Map<string, InternalBrowserInstance>;
  maintenance: BrowserPoolMaintenance;
  healthMonitor: BrowserHealthMonitor;
  options: BrowserPoolOptions;
  emitEvent: (event: string, data: unknown) => void;
  handleUnhealthyBrowser: (browserId: string) => Promise<void>;
}

/**
 * Handle unhealthy browser
 */
export async function handleUnhealthyBrowserDelegate(
  params: HandleUnhealthyBrowserDelegateParams,
): Promise<void> {
  const {
    browserId,
    browsers,
    maintenance,
    healthMonitor,
    options,
    emitEvent,
    handleUnhealthyBrowser,
  } = params;

  await handleUnhealthyBrowserWithEvent({
    browserId,
    browsers,
    handleUnhealthy: async (id) => {
      await maintenance.handleUnhealthyBrowser({
        browserId: id,
        browsers,
        healthMonitor,
        options,
        onHealthCheckFailed: (bid) => void handleUnhealthyBrowser(bid),
      });
    },
    onRestarted: (id) => emitEvent('browser:restarted', { browserId: id }),
    onRemoved: (id) => emitEvent('browser:removed', { browserId: id }),
  });
}

/**
 * Parameters for performPoolMaintenance
 */
export interface PerformPoolMaintenanceParams {
  browsers: Map<string, InternalBrowserInstance>;
  options: BrowserPoolOptions;
  maintenance: BrowserPoolMaintenance;
  removeBrowser: (browserId: string) => Promise<void>;
  handleUnhealthyBrowser: (browserId: string) => Promise<void>;
  launchNewBrowser: () => Promise<{ browser: Browser; instance: InternalBrowserInstance }>;
}

/**
 * Perform pool maintenance
 */
export async function performPoolMaintenance(params: PerformPoolMaintenanceParams): Promise<void> {
  const {
    browsers,
    options,
    maintenance,
    removeBrowser,
    handleUnhealthyBrowser,
    launchNewBrowser,
  } = params;

  await performMaintenanceWrapper(() =>
    maintenance.performMaintenance({
      browsers,
      options,
      removeBrowser,
      handleUnhealthyBrowser,
      launchNewBrowser,
    }),
  );
}

/**
 * Parameters for removeBrowserFromPool
 */
export interface RemoveBrowserFromPoolParams {
  browserId: string;
  browsers: Map<string, InternalBrowserInstance>;
  healthMonitor: BrowserHealthMonitor;
  maintenance: BrowserPoolMaintenance;
  emitEvent: (event: string, data: unknown) => void;
}

/**
 * Remove browser from pool
 */
export async function removeBrowserFromPool(params: RemoveBrowserFromPoolParams): Promise<void> {
  const { browserId, browsers, healthMonitor, maintenance, emitEvent } = params;

  await handleRemoveBrowser(
    browserId,
    async (id) => {
      await maintenance.removeBrowser(id, browsers, healthMonitor);
    },
    (id) => {
      void emitEvent('browser:removed', { browserId: id });
    },
  );
}
