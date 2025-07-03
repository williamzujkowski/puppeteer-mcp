/**
 * Page Manager Delegate Method Implementations
 * @module puppeteer/pages/page-delegate-methods
 * @nist ac-3 "Access enforcement"
 */

import type { Page } from 'puppeteer';
import type {
  PageOptions,
} from '../interfaces/page-manager.interface.js';
import type { PageInfoStore } from './page-info-store.js';
import {
  getPageWithAccessControl,
  getPageInfoWithAccessControl
} from './page-access-control.js';
import {
  navigatePage as navigatePageImpl,
  updatePageOptions as updatePageOptionsImpl,
} from './page-navigation.js';
import {
  getPageMetrics as getPageMetricsImpl,
  setCookies as setCookiesImpl,
  getCookies as getCookiesImpl,
  clearPageData as clearPageDataImpl,
  takeScreenshot as takeScreenshotImpl,
  isPageActive as isPageActiveImpl,
} from './page-operations.js';
import {
  listPagesForSession as listPagesForSessionImpl,
  listPagesForContext as listPagesForContextImpl,
} from './page-list-operations.js';
import { configurePageOptions } from './page-configuration.js';

/**
 * Delegate methods object containing all delegated method implementations
 */
export const delegateMethods = {
  getPage: getPageWithAccessControl,
  getPageInfo: getPageInfoWithAccessControl,
  navigatePage: navigatePageImpl,
  updatePageOptions: (params: {
    pageId: string;
    options: Partial<PageOptions>;
    sessionId: string;
    pages: Map<string, Page>;
    pageStore: PageInfoStore;
  }) => updatePageOptionsImpl({
    pageId: params.pageId,
    options: params.options,
    sessionId: params.sessionId,
    pages: params.pages,
    pageStore: params.pageStore,
    configurePageOptions
  }),
  takeScreenshot: takeScreenshotImpl,
  listPagesForSession: listPagesForSessionImpl,
  listPagesForContext: listPagesForContextImpl,
  getPageMetrics: getPageMetricsImpl,
  setCookies: setCookiesImpl,
  getCookies: getCookiesImpl,
  clearPageData: clearPageDataImpl,
  isPageActive: isPageActiveImpl,
};