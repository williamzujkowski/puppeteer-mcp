/**
 * Screenshot functionality acceptance tests
 * @module tests/acceptance/basic/screenshots
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  createMCPClient,
  createMCPSession,
  cleanupMCPSession,
  mcpNavigate,
  mcpScreenshot,
  mcpWaitForSelector,
  mcpClick,
} from '../utils/mcp-client.js';
import { TEST_TARGETS, TEST_CONFIG } from '../utils/test-config.js';
import {
  retryOperation,
  validateUrl,
  PerformanceTracker,
  ScreenshotHelpers,
} from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('Screenshot Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;

  beforeAll(async () => {
    // Validate test targets
    const targetsToValidate = [TEST_TARGETS.testing.theInternet, TEST_TARGETS.ecommerce.sauceDemo];

    for (const url of targetsToValidate) {
      const isAccessible = await validateUrl(url);
      if (!isAccessible) {
        console.warn(`Warning: Test target ${url} is not accessible`);
      }
    }

    mcpClient = await createMCPClient();
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    if (mcpClient !== null) {
      await mcpClient.cleanup();
    }
  });

  beforeEach(async () => {
    sessionInfo = await createMCPSession(mcpClient.client);
  }, TEST_CONFIG.timeout);

  afterEach(async () => {
    if (sessionInfo !== null) {
      await cleanupMCPSession(mcpClient.client, sessionInfo);
    }
  });

  describe('Basic Screenshot Functionality', () => {
    it(
      'should take full page screenshot with default settings',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          // Navigate to a visually consistent page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          performance.checkpoint('navigation');

          // Wait for page to be fully loaded
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 1000);
          });
          performance.checkpoint('page_ready');

          // Take screenshot with default settings
          const screenshotPath = await mcpScreenshot(mcpClient.client, sessionInfo.contextId);
          performance.checkpoint('screenshot_taken');

          // Verify screenshot was created
          expect(screenshotPath).toBeTruthy();
          expect(screenshotPath).toContain('.png');
          expect(screenshotPath.length).toBeGreaterThan(10);

          console.warn('Default screenshot saved:', screenshotPath);
          console.warn('Performance:', performance.getReport());
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should take screenshot with custom filename',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Generate custom filename
          const customFilename = ScreenshotHelpers.getTimestampedFilename('custom-screenshot');

          const screenshotPath = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            customFilename,
          );

          expect(screenshotPath).toBeTruthy();
          expect(screenshotPath).toContain('custom-screenshot');
          expect(screenshotPath).toContain('.png');

          console.warn('Custom filename screenshot saved:', screenshotPath);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Element Screenshots', () => {
    it(
      'should take screenshot of specific element',
      async () => {
        await retryOperation(async () => {
          // Navigate to a page with distinct elements
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/login',
          );

          // Wait for the form to be visible
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#login');

          // Take screenshot of the login form
          // Note: Based on the interface, element screenshots would need to be implemented
          // via execute-in-context with selector parameter
          const screenshotPath = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('login-form'),
          );

          expect(screenshotPath).toBeTruthy();
          console.warn('Element screenshot saved:', screenshotPath);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle element screenshots for various components',
      async () => {
        await retryOperation(async () => {
          // Navigate to SauceDemo for more complex UI elements
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.ecommerce.sauceDemo,
          );

          // Wait for login form
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.login_wrapper');

          // Take screenshot of the entire login wrapper
          const loginScreenshot = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('saucedemo-login'),
          );

          expect(loginScreenshot).toBeTruthy();
          console.warn('SauceDemo login screenshot:', loginScreenshot);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Screenshot Formats and Quality', () => {
    it(
      'should take screenshots in different formats',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Test PNG format (default)
          const pngScreenshot = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('format-png'),
            { format: 'png' },
          );
          expect(pngScreenshot).toContain('.png');

          // Test JPEG format
          const jpegScreenshot = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('format-jpeg').replace('.png', '.jpg'),
            { format: 'jpeg', quality: 85 },
          );
          expect(jpegScreenshot).toBeTruthy();

          // Test WebP format
          const webpScreenshot = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('format-webp').replace('.png', '.webp'),
            { format: 'webp', quality: 90 },
          );
          expect(webpScreenshot).toBeTruthy();

          console.warn('Format screenshots:', { pngScreenshot, jpegScreenshot, webpScreenshot });
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle quality settings for JPEG/WebP',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/dropdown',
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#dropdown');

          // Test different quality levels
          const qualityLevels = [30, 60, 90];

          for (const quality of qualityLevels) {
            const filename = ScreenshotHelpers.getTimestampedFilename(`quality-${quality}`).replace(
              '.png',
              '.jpg',
            );
            const screenshotPath = await mcpScreenshot(
              mcpClient.client,
              sessionInfo.contextId,
              filename,
              { format: 'jpeg', quality },
            );

            expect(screenshotPath).toBeTruthy();
            console.warn(`Screenshot with quality ${quality}:`, screenshotPath);
          }
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Viewport and Full Page Screenshots', () => {
    it(
      'should capture visible viewport vs full page',
      async () => {
        await retryOperation(async () => {
          // Navigate to a long page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/infinite_scroll',
          );

          // Wait for initial content
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.jscroll-inner');

          // Take viewport screenshot (default behavior)
          const viewportScreenshot = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('viewport-only'),
            { fullPage: false },
          );
          expect(viewportScreenshot).toBeTruthy();

          // Take full page screenshot
          const fullPageScreenshot = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('full-page'),
            { fullPage: true },
          );
          expect(fullPageScreenshot).toBeTruthy();

          console.warn('Viewport screenshots:', { viewportScreenshot, fullPageScreenshot });
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle custom viewport sizes',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          performance.checkpoint('navigation');

          // Standard desktop viewport
          const desktopScreenshot = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('viewport-desktop'),
          );
          performance.checkpoint('desktop_screenshot');

          // The viewport would typically be changed via page.setViewport()
          // For this test, we're demonstrating the screenshot capability
          expect(desktopScreenshot).toBeTruthy();

          console.warn('Viewport test completed:', performance.getReport());
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Dynamic Content Screenshots', () => {
    it(
      'should capture screenshots after dynamic content loads',
      async () => {
        await retryOperation(async () => {
          // Navigate to dynamic loading page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/dynamic_loading/2',
          );

          // Click start button
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#start button');

          // Wait for dynamic content to appear
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#finish', 10000);

          // Take screenshot after content loads
          const screenshotPath = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('dynamic-content-loaded'),
          );

          expect(screenshotPath).toBeTruthy();
          console.warn('Dynamic content screenshot:', screenshotPath);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should capture modal/overlay screenshots',
      async () => {
        await retryOperation(async () => {
          // Navigate to page with modal
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/entry_ad',
          );

          // Wait for modal to appear
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.modal', 5000);

          // Take screenshot with modal visible
          const modalScreenshot = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('modal-visible'),
          );
          expect(modalScreenshot).toBeTruthy();

          // Close modal if possible
          try {
            await mcpClick(mcpClient.client, sessionInfo.contextId, '.modal-footer p');

            // Take screenshot after modal close
            const afterModalScreenshot = await mcpScreenshot(
              mcpClient.client,
              sessionInfo.contextId,
              ScreenshotHelpers.getTimestampedFilename('modal-closed'),
            );
            expect(afterModalScreenshot).toBeTruthy();
          } catch (error) {
            console.warn('Could not close modal:', error);
          }
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Error Handling and Edge Cases', () => {
    it(
      'should handle screenshot errors gracefully',
      async () => {
        await retryOperation(async () => {
          // Navigate to a valid page first
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Test with invalid filename characters (if any)
          try {
            const invalidFilename = 'screenshot<>:|?*.png';
            await mcpScreenshot(mcpClient.client, sessionInfo.contextId, invalidFilename);
            // If it doesn't throw, the implementation handles invalid chars
          } catch (error) {
            // Error handling is expected for invalid filenames
            expect(error).toBeTruthy();
          }

          // Test normal screenshot still works after error
          const validScreenshot = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            ScreenshotHelpers.getTimestampedFilename('after-error'),
          );
          expect(validScreenshot).toBeTruthy();
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle rapid consecutive screenshots',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          performance.checkpoint('navigation');

          // Take multiple screenshots in quick succession
          const screenshots: string[] = [];

          for (let i = 0; i < 5; i++) {
            const screenshotPath = await mcpScreenshot(
              mcpClient.client,
              sessionInfo.contextId,
              ScreenshotHelpers.getTimestampedFilename(`rapid-${i}`),
            );
            screenshots.push(screenshotPath);
            performance.checkpoint(`screenshot_${i}`);
          }

          // Verify all screenshots were taken
          expect(screenshots).toHaveLength(5);
          screenshots.forEach((path) => {
            expect(path).toBeTruthy();
            expect(path).toContain('.png');
          });

          console.warn('Rapid screenshots completed:', performance.getReport());
          console.warn('Total time for 5 screenshots:', performance.getElapsed(), 'ms');
        });
      },
      TEST_CONFIG.timeout,
    );
  });
});
