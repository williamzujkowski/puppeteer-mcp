/**
 * Helper functions for mouse action handlers
 * @module puppeteer/actions/handlers/mouse-helpers
 */

import type { Page } from 'puppeteer';
import type { MouseAction } from '../../interfaces/action-executor.interface.js';

/**
 * Validate mouse coordinates
 */
export function validateMouseCoordinates(x?: number, y?: number): void {
  if (x !== undefined && (x < 0 || x > 10000)) {
    throw new Error('Invalid X coordinate');
  }
  if (y !== undefined && (y < 0 || y > 10000)) {
    throw new Error('Invalid Y coordinate');
  }
}

/**
 * Execute mouse move action
 */
export async function executeMouseMove(page: Page, action: MouseAction): Promise<void> {
  if (action.x === undefined || action.y === undefined) {
    throw new Error('X and Y coordinates are required for mouse move');
  }
  await page.mouse.move(action.x, action.y);
}

/**
 * Execute mouse down action
 */
export async function executeMouseDown(page: Page, action: MouseAction): Promise<void> {
  await page.mouse.down({
    button: action.button ?? 'left',
  });
}

/**
 * Execute mouse up action
 */
export async function executeMouseUp(page: Page, action: MouseAction): Promise<void> {
  await page.mouse.up({
    button: action.button ?? 'left',
  });
}

/**
 * Execute mouse wheel action
 */
export async function executeMouseWheel(page: Page, action: MouseAction): Promise<void> {
  await page.mouse.wheel({
    deltaX: action.deltaX ?? 0,
    deltaY: action.deltaY ?? 0,
  });
}

/**
 * Execute mouse action based on type
 */
export async function executeMouseAction(page: Page, action: MouseAction): Promise<void> {
  switch (action.action) {
    case 'move':
      await executeMouseMove(page, action);
      break;
    case 'down':
      await executeMouseDown(page, action);
      break;
    case 'up':
      await executeMouseUp(page, action);
      break;
    case 'wheel':
      await executeMouseWheel(page, action);
      break;
    default:
      throw new Error(`Unsupported mouse action: ${String(action.action)}`);
  }
}