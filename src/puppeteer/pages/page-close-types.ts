/**
 * Types for page close operations
 * @module puppeteer/pages/page-close-types
 */

import type { Page } from 'puppeteer';
import type { PageInfo } from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';
import type { EventEmitter } from 'events';

/**
 * Parameters for close page operation
 */
export interface ClosePageOperationParams {
  pageId: string;
  sessionId: string;
  pages: Map<string, Page>;
  pageStore: PageInfoStore;
  getPageInfo: (pageId: string, sessionId: string) => Promise<PageInfo>;
  emitter: EventEmitter;
}

/**
 * Parameters for close pages for context operation
 */
export interface ClosePagesForContextParams {
  contextId: string;
  pages: Map<string, Page>;
  pageStore: PageInfoStore;
  emitter: EventEmitter;
}

/**
 * Parameters for close pages for session operation
 */
export interface ClosePagesForSessionParams {
  sessionId: string;
  pages: Map<string, Page>;
  pageStore: PageInfoStore;
  emitter: EventEmitter;
}
