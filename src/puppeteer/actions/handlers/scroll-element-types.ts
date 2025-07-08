/**
 * Types for scroll element handlers
 * @module puppeteer/actions/handlers/scroll-element-types
 */

import type { Page } from 'puppeteer';
import type { ActionContext } from '../../interfaces/action-executor.interface.js';

/**
 * Parameters for scroll within element
 */
export interface ScrollWithinElementParams {
  selector: string;
  direction: 'up' | 'down' | 'left' | 'right';
  distance: number;
  page: Page;
  context: ActionContext;
}
