/**
 * Browser pool private methods
 * @module puppeteer/pool/browser-pool-private-methods
 */

import type { Browser } from 'puppeteer';
import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance, BrowserPoolOptions } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';
import { BrowserPoolMaintenance } from './browser-pool-maintenance.js';
import { BrowserHealthMonitor } from './browser-health.js';

const logger = createLogger('browser-pool-private-methods');

/**
 * Activate a browser for a session
 */
export function activateBrowserForSession(
  instance: InternalBrowserInstance,
  sessionId: string,
  onActivated: (browserId: string, sessionId: string) => void
): InternalBrowserInstance {
  instance.state = 'active';
  instance.sessionId = sessionId;
  instance.lastUsedAt = new Date();

  logger.debug({
    browserId: instance.id,
    sessionId,
  }, 'Browser activated for session');

  onActivated(instance.id, sessionId);

  return instance;
}

/**
 * Handle removal of browser
 */
export async function handleRemoveBrowser(
  browserId: string,
  removeBrowser: (browserId: string) => Promise<void>,
  onRemoved: (browserId: string) => void
): Promise<void> {
  await removeBrowser(browserId);
  onRemoved(browserId);
}

/**
 * Handle unhealthy browser with event
 */
export async function handleUnhealthyBrowserWithEvent(
  browserId: string,
  browsers: Map<string, InternalBrowserInstance>,
  handleUnhealthy: (browserId: string) => Promise<void>,
  onRestarted: (browserId: string) => void,
  onRemoved: (browserId: string) => void
): Promise<void> {
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
  performMaintenance: () => Promise<void>
): Promise<void> {
  await performMaintenance();
}

/**
 * Handle unhealthy browser
 */
export async function handleUnhealthyBrowserDelegate(
  browserId: string,
  browsers: Map<string, InternalBrowserInstance>,
  maintenance: BrowserPoolMaintenance,
  healthMonitor: BrowserHealthMonitor,
  options: BrowserPoolOptions,
  emitEvent: (event: string, data: any) => void,
  handleUnhealthyBrowser: (browserId: string) => Promise<void>
): Promise<void> {
  await handleUnhealthyBrowserWithEvent(
    browserId,
    browsers,
    async (id) => {
      await maintenance.handleUnhealthyBrowser(
        id,
        browsers,
        healthMonitor,
        options,
        (bid) => void handleUnhealthyBrowser(bid)
      );
    },
    (id) => emitEvent('browser:restarted', { browserId: id }),
    (id) => emitEvent('browser:removed', { browserId: id })
  );
}

/**
 * Perform pool maintenance
 */
export async function performPoolMaintenance(
  browsers: Map<string, InternalBrowserInstance>,
  options: BrowserPoolOptions,
  maintenance: BrowserPoolMaintenance,
  removeBrowser: (browserId: string) => Promise<void>,
  handleUnhealthyBrowser: (browserId: string) => Promise<void>,
  launchNewBrowser: () => Promise<{ browser: Browser; instance: InternalBrowserInstance }>
): Promise<void> {
  await performMaintenanceWrapper(
    () => maintenance.performMaintenance(
      browsers,
      options,
      removeBrowser,
      handleUnhealthyBrowser,
      launchNewBrowser
    )
  );
}

/**
 * Remove browser from pool
 */
export async function removeBrowserFromPool(
  browserId: string,
  browsers: Map<string, InternalBrowserInstance>,
  healthMonitor: BrowserHealthMonitor,
  maintenance: BrowserPoolMaintenance,
  emitEvent: (event: string, data: any) => void
): Promise<void> {
  await handleRemoveBrowser(
    browserId,
    (id) => maintenance.removeBrowser(id, browsers, healthMonitor),
    (id) => emitEvent('browser:removed', { browserId: id })
  );
}