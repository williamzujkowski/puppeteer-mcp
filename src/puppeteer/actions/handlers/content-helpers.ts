/**
 * Helper functions for content actions
 * @module puppeteer/actions/handlers/content-helpers
 */

import type { Page } from 'puppeteer';
import type {
  ScreenshotAction,
  PDFAction,
  ActionResult,
  ActionContext,
} from '../../interfaces/action-executor.interface.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:content-helpers');

/**
 * Build screenshot options from action
 */
export function buildScreenshotOptions(
  action: ScreenshotAction,
): Parameters<Page['screenshot']>[0] {
  const options: Parameters<Page['screenshot']>[0] = {
    type: action.format ?? 'png',
    fullPage: action.fullPage ?? false,
    encoding: 'binary',
  };

  // Add quality for JPEG/WebP
  if (
    (action.format === 'jpeg' || action.format === 'webp') &&
    action.quality !== null &&
    action.quality !== undefined
  ) {
    const qualityOptions = options as { quality?: number };
    qualityOptions.quality = Math.max(1, Math.min(100, action.quality));
  }

  return options;
}

/**
 * Build PDF margin options
 */
export function buildPdfMargins(
  margin?: PDFAction['margin'],
): NonNullable<Parameters<Page['pdf']>[0]>['margin'] {
  if (!margin) {
    return undefined;
  }

  return {
    top: margin.top ?? '0.5in',
    bottom: margin.bottom ?? '0.5in',
    left: margin.left ?? '0.5in',
    right: margin.right ?? '0.5in',
  };
}

/**
 * Build base PDF options
 */
function buildBasePdfOptions(action: PDFAction): NonNullable<Parameters<Page['pdf']>[0]> {
  return {
    format: action.format ?? 'letter',
    landscape: action.landscape ?? false,
    printBackground: action.printBackground ?? true,
    scale: action.scale ?? 1,
    displayHeaderFooter: action.displayHeaderFooter ?? false,
    headerTemplate: action.headerTemplate,
    footerTemplate: action.footerTemplate,
    preferCSSPageSize: action.preferCSSPageSize ?? false,
  };
}

/**
 * Add optional PDF properties
 */
function addOptionalPdfProperties(
  pdfOptions: NonNullable<Parameters<Page['pdf']>[0]>,
  action: PDFAction,
): void {
  // Add page ranges if specified
  if (action.pageRanges !== undefined && action.pageRanges !== '') {
    pdfOptions.pageRanges = action.pageRanges;
  }

  // Add margins if specified
  const margins = buildPdfMargins(action.margin);
  if (margins) {
    pdfOptions.margin = margins;
  }
}

/**
 * Build PDF options from action
 */
export function buildPdfOptions(action: PDFAction): NonNullable<Parameters<Page['pdf']>[0]> {
  const pdfOptions = buildBasePdfOptions(action);
  addOptionalPdfProperties(pdfOptions, action);
  return pdfOptions;
}

/**
 * Capture element screenshot
 */
export async function captureElementScreenshot(
  action: ScreenshotAction,
  page: Page,
  screenshotOptions: Parameters<Page['screenshot']>[0],
  context: ActionContext,
): Promise<Omit<ActionResult<Buffer>, 'duration' | 'timestamp'>> {
  if (action.selector === undefined || action.selector === '') {
    throw new Error('Selector is required for element screenshot');
  }
  const sanitizedSelector = sanitizeSelector(action.selector);

  // Wait for element to be visible
  await page.waitForSelector(sanitizedSelector, {
    timeout: action.timeout ?? 30000,
    visible: true,
  });

  const element = await page.$(sanitizedSelector);
  if (!element) {
    throw new Error(`Element not found: ${sanitizedSelector}`);
  }

  // Take element screenshot
  const screenshot = (await element.screenshot(screenshotOptions)) as Buffer;

  logger.info('Element screenshot action completed', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    pageId: action.pageId,
    selector: sanitizedSelector,
    size: screenshot.length,
  });

  return {
    success: true,
    actionType: 'screenshot',
    data: screenshot,
    metadata: {
      type: 'element',
      selector: sanitizedSelector,
      originalSelector: action.selector,
      format: action.format ?? 'png',
      size: screenshot.length,
    },
  };
}

/**
 * Capture page screenshot
 */
export async function capturePageScreenshot(
  action: ScreenshotAction,
  page: Page,
  screenshotOptions: Parameters<Page['screenshot']>[0],
  context: ActionContext,
): Promise<Omit<ActionResult<Buffer>, 'duration' | 'timestamp'>> {
  const screenshot = (await page.screenshot(screenshotOptions)) as Buffer;

  logger.info('Page screenshot action completed', {
    sessionId: context.sessionId,
    contextId: context.contextId,
    pageId: action.pageId,
    fullPage: action.fullPage,
    size: screenshot.length,
  });

  return {
    success: true,
    actionType: 'screenshot',
    data: screenshot,
    metadata: {
      type: action.fullPage === true ? 'fullPage' : 'viewport',
      format: action.format ?? 'png',
      size: screenshot.length,
      viewport: page.viewport(),
    },
  };
}
