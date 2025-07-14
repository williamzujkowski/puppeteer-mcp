/**
 * Delay utility to replace deprecated page.waitForTimeout
 * @module tests/helpers/delay
 */

/**
 * Delay execution for specified milliseconds
 * @param ms - Number of milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
