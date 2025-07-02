/**
 * Helper functions for interaction handlers
 * @module puppeteer/actions/handlers/interaction-helpers
 */

import type { Page, ElementHandle } from 'puppeteer';
import { sanitizeSelector } from '../validation.js';

/**
 * Prepare element for interaction
 * Waits for element, ensures visibility, and scrolls if needed
 */
export async function prepareElementForInteraction(
  page: Page,
  selector: string,
  timeout?: number
): Promise<ElementHandle> {
  // Sanitize selector for security
  const sanitizedSelector = sanitizeSelector(selector);

  // Wait for element to be available
  await page.waitForSelector(sanitizedSelector, {
    timeout: timeout || 30000,
    visible: true,
  });

  // Get element
  const element = await page.$(sanitizedSelector);
  if (!element) {
    throw new Error(`Element not found: ${sanitizedSelector}`);
  }

  // Ensure element is visible
  const isVisible = await element.isIntersectingViewport();
  if (!isVisible) {
    await element.scrollIntoView();
  }

  return element;
}