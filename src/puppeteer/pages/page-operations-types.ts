/**
 * Types for page operations
 * @module puppeteer/pages/page-operations-types
 */

import type { Page, Browser, Viewport, WaitForOptions } from 'puppeteer';
import type { BrowserEvent } from '../interfaces/browser-events.interface.js';
import type { PageInfo } from '../interfaces/page-manager.interface.js';
import type { ActionContext } from '../interfaces/action-executor.interface.js';
import type { Logger as PinoLogger } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';

/**
 * Parameters for close page operation
 */
export interface ClosePageOperationParams {
  page: Page;
  pageInfo: PageInfo;
  browser: Browser;
  sessionStore: SessionStore;
  logger: PinoLogger;
  pageEventHandler?: (event: BrowserEvent['type'], data: unknown) => void;
}

/**
 * Parameters for create and configure page
 */
export interface CreateAndConfigurePageParams {
  browser: Browser;
  contextId: string;
  sessionId: string;
  pageUrl?: string;
  viewport?: Viewport;
  waitUntil?: WaitForOptions['waitUntil'];
  userAgent?: string;
  headers?: Record<string, string>;
}

/**
 * Parameters for update page options
 */
export interface UpdatePageOptionsParams {
  page: Page;
  viewport?: Viewport;
  userAgent?: string;
  headers?: Record<string, string>;
  cookies?: Array<{ name: string; value: string; domain?: string }>;
}

/**
 * Parameters for navigate page
 */
export interface NavigatePageParams {
  page: Page;
  url: string;
  waitUntil?: WaitForOptions['waitUntil'];
  timeout?: number;
  referer?: string;
  pageEventHandler?: (event: BrowserEvent['type'], data: unknown) => void;
}

/**
 * Parameters for navigate to
 */
export interface NavigateToParams {
  page: Page;
  pageInfo: PageInfo;
  url: string;
  waitUntil?: WaitForOptions['waitUntil'];
  timeout?: number;
  pageEventHandler?: (event: BrowserEvent['type'], data: unknown) => void;
}

/**
 * Parameters for navigate to with events
 */
export interface NavigateToWithEventsParams {
  page: Page;
  pageInfo: PageInfo;
  url: string;
  context: ActionContext;
  waitUntil?: WaitForOptions['waitUntil'];
  timeout?: number;
  pageEventHandler?: (event: BrowserEvent['type'], data: unknown) => void;
}

/**
 * Parameters for set cookies
 */
export interface SetCookiesParams {
  page: Page;
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>;
  context: ActionContext;
  pageId: string;
  logger: PinoLogger;
}

/**
 * Parameters for clear page data
 */
export interface ClearPageDataParams {
  page: Page;
  clearCookies: boolean;
  clearStorage: boolean;
  clearCache: boolean;
  context: ActionContext;
}

/**
 * Parameters for take screenshot
 */
export interface TakeScreenshotParams {
  page: Page;
  fullPage: boolean;
  quality?: number;
  context: ActionContext;
  logger: PinoLogger;
}
