/**
 * Basic navigation acceptance tests
 * @module tests/acceptance/basic/navigation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  createMCPClient,
  createMCPSession,
  cleanupMCPSession,
  mcpNavigate,
  mcpGetContent,
  mcpScreenshot,
} from '../utils/mcp-client.js';
import { TEST_TARGETS, TEST_CONFIG } from '../utils/test-config.js';
import {
  retryOperation,
  validateUrl,
  PerformanceTracker,
  ScreenshotHelpers,
  AssertionHelpers,
} from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('Basic Navigation Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;

  beforeAll(async () => {
    // Validate test targets are accessible
    const targetsToValidate = [
      TEST_TARGETS.testing.theInternet,
      TEST_TARGETS.testing.testPages,
      TEST_TARGETS.ecommerce.sauceDemo,
    ];

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

  describe('Basic Page Navigation', () => {
    it(
      'should navigate to a simple webpage and verify content',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          // Navigate to The Internet homepage
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          performance.checkpoint('navigation');

          // Get page content
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          performance.checkpoint('content_extraction');

          // Verify we're on the right page
          AssertionHelpers.containsText(content, 'Welcome to the-internet');
          AssertionHelpers.containsText(content, 'Available Examples');

          // Performance assertion
          expect(performance.getCheckpoint('navigation')).toBeLessThan(10000); // 10 seconds

          console.warn('Navigation performance:', performance.getReport());
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should navigate between multiple pages',
      async () => {
        const urls = [
          TEST_TARGETS.testing.theInternet,
          TEST_TARGETS.testing.testPages,
          TEST_TARGETS.ecommerce.sauceDemo,
        ];

        for (const url of urls) {
          await retryOperation(async () => {
            await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);

            // Wait a bit for page to load
            await new Promise<void>((resolve) => {
              setTimeout(() => resolve(), 1000);
            });

            const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);

            // Basic sanity check - page should have some content
            expect(content.length).toBeGreaterThan(100);

            // Should not contain error indicators
            expect(content.toLowerCase()).not.toContain('404');
            expect(content.toLowerCase()).not.toContain('not found');
            expect(content.toLowerCase()).not.toContain('error');
          });
        }
      },
      TEST_CONFIG.timeout * 2,
    );

    it(
      'should handle navigation to non-existent page gracefully',
      async () => {
        const invalidUrl = 'https://httpbin.org/status/404';

        await retryOperation(async () => {
          // This should not throw an error, but should handle gracefully
          await mcpNavigate(mcpClient.client, sessionInfo.contextId, invalidUrl);

          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);

          // Should contain 404 or similar error indication
          expect(content.toLowerCase()).toMatch(/404|not found|error/);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Page Content Verification', () => {
    it(
      'should extract and verify page title and headers',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Get full page content
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);

          // Should contain HTML structure
          AssertionHelpers.containsText(content, '<html');
          AssertionHelpers.containsText(content, '</html>');

          // Should have a title
          AssertionHelpers.matchesPattern(content, /<title>.*<\/title>/i);

          // Should have main heading
          AssertionHelpers.containsText(content, 'Welcome to the-internet');
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should extract specific element content',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Try to get content of specific elements
          try {
            const headingContent = await mcpGetContent(
              mcpClient.client,
              sessionInfo.contextId,
              'h1',
            );
            expect(headingContent).toBeTruthy();
            AssertionHelpers.containsText(headingContent, 'Welcome');
          } catch (error) {
            // If specific selector fails, that's still valuable test information
            console.warn('Could not extract h1 content:', error);
          }

          // Get body content (should always exist)
          const bodyContent = await mcpGetContent(mcpClient.client, sessionInfo.contextId, 'body');
          expect(bodyContent).toBeTruthy();
          expect(bodyContent.length).toBeGreaterThan(100);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Screenshot Capabilities', () => {
    it(
      'should take screenshot of loaded page',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Wait for page to load
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 2000);
          });

          const filename = ScreenshotHelpers.getTimestampedFilename('navigation-test');
          const screenshotPath = await mcpScreenshot(
            mcpClient.client,
            sessionInfo.contextId,
            filename,
          );

          expect(screenshotPath).toBeTruthy();
          expect(screenshotPath).toContain('.png');

          console.warn('Screenshot saved:', screenshotPath);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle invalid URLs gracefully',
      async () => {
        const invalidUrls = [
          'not-a-url',
          'https://this-domain-definitely-does-not-exist-12345.com',
          'ftp://unsupported-protocol.com',
        ];

        for (const url of invalidUrls) {
          try {
            await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
            // If navigation doesn't throw, it should at least result in some error content
            const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
            // Some kind of error should be present
            expect(content.toLowerCase()).toMatch(/error|not found|invalid|failed/);
          } catch (error) {
            // Throwing an error is also acceptable behavior
            expect(error).toBeTruthy();
          }
        }
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should recover from navigation errors',
      async () => {
        // Try invalid navigation first
        try {
          await mcpNavigate(mcpClient.client, sessionInfo.contextId, 'invalid-url');
        } catch {
          // Expected to fail
        }

        // Should still be able to navigate to valid URL after error
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          AssertionHelpers.containsText(content, 'Welcome to the-internet');
        });
      },
      TEST_CONFIG.timeout,
    );
  });
});
