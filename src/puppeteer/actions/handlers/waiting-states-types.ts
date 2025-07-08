/**
 * Types for waiting state handlers
 * @module puppeteer/actions/handlers/waiting-states-types
 */

import type { Page } from 'puppeteer';
import type { ActionContext } from '../../interfaces/action-executor.interface.js';

/**
 * Parameters for creating wait for element state result
 */
export interface WaitForElementStateResultParams {
  success: boolean;
  selector: string;
  sanitizedSelector: string;
  state: 'visible' | 'hidden' | 'attached' | 'detached';
  duration: number;
  error?: string;
}

/**
 * Parameters for logging wait for element state
 */
export interface WaitForElementStateLogParams {
  message: string;
  context: ActionContext;
  selector: string;
  state: string;
  additional?: Record<string, unknown>;
}

/**
 * Parameters for handling wait for element state
 */
export interface WaitForElementStateParams {
  selector: string;
  state: 'visible' | 'hidden' | 'attached' | 'detached';
  page: Page;
  context: ActionContext;
  timeout?: number;
}
