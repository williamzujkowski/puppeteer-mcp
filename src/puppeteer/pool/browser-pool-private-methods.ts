/**
 * Browser pool private methods
 * @module puppeteer/pool/browser-pool-private-methods
 */

import { createLogger } from '../../utils/logger.js';
import type { BrowserInstance } from '../interfaces/browser-pool.interface.js';
import type { InternalBrowserInstance } from './browser-pool-maintenance.js';

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