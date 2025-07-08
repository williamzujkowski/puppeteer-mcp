/**
 * Page management module exports
 * @module puppeteer/pages
 */

export { PageManager, getPageManager, type PageEvents } from './page-manager.js';
export { InMemoryPageInfoStore, pageInfoStore, type PageInfoStore } from './page-info-store.js';
export type {
  PageManager as IPageManager,
  PageInfo,
  PageOptions,
  NavigationOptions,
  ScreenshotOptions,
  Headers,
} from '../interfaces/page-manager.interface.js';
