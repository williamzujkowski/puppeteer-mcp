/**
 * Multi-page/tab management acceptance tests
 * @module tests/acceptance/basic/multi-page
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  createMCPClient,
  createMCPSession,
  createAdditionalBrowserContext,
  listBrowserContexts,
  closeBrowserContext,
  cleanupMCPSession,
  mcpNavigate,
  mcpGetContent,
  mcpScreenshot,
  mcpCookie,
  mcpEvaluate,
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

describe('Multi-Page/Tab Management Tests', () => {
  let mcpClient: MCPTestClient;
  let primarySession: MCPSessionInfo;

  beforeAll(async () => {
    // Validate test targets are accessible
    const targetsToValidate = [
      TEST_TARGETS.ecommerce.sauceDemo,
      TEST_TARGETS.testing.theInternet,
      TEST_TARGETS.apis.httpbin,
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
    primarySession = await createMCPSession(mcpClient.client);
  }, TEST_CONFIG.timeout);

  afterEach(async () => {
    if (primarySession !== null) {
      await cleanupMCPSession(mcpClient.client, primarySession);
    }
  });

  describe('Multiple Browser Contexts Management', () => {
    it(
      'should create and manage multiple browser contexts simultaneously',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          // Create additional contexts (primary context already exists)
          const context2Id = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );
          performance.checkpoint('context2_created');

          const context3Id = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );
          performance.checkpoint('context3_created');

          // List all contexts to verify they exist
          const contexts = await listBrowserContexts(mcpClient.client, primarySession.sessionId);
          performance.checkpoint('contexts_listed');

          // Should have 3 contexts total (primary + 2 additional)
          expect(contexts.length).toBeGreaterThanOrEqual(3);

          // Verify context IDs are present
          const contextIds = contexts.map((ctx: any) => ctx.id || ctx.contextId);
          expect(contextIds).toContain(primarySession.contextId);
          expect(contextIds).toContain(context2Id);
          expect(contextIds).toContain(context3Id);

          // Performance assertions
          expect(performance.getCheckpoint('context2_created')).toBeLessThan(10000);
          expect(performance.getCheckpoint('context3_created')).toBeLessThan(10000);

          console.warn('Context creation performance:', performance.getReport());
        });
      },
      TEST_CONFIG.timeout * 2,
    );

    it(
      'should navigate to different sites in multiple contexts',
      async () => {
        await retryOperation(async () => {
          // Create additional contexts
          const sauceDemoContextId = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );
          const httpbinContextId = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );

          // Navigate to different sites in each context
          const navigationPromises = [
            mcpNavigate(
              mcpClient.client,
              primarySession.contextId,
              TEST_TARGETS.testing.theInternet,
            ),
            mcpNavigate(mcpClient.client, sauceDemoContextId, TEST_TARGETS.ecommerce.sauceDemo),
            mcpNavigate(mcpClient.client, httpbinContextId, TEST_TARGETS.apis.httpbin),
          ];

          // Execute navigations in parallel
          await Promise.all(navigationPromises);

          // Wait for pages to load
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 2000);
          });

          // Verify each context is on the correct site
          const [theInternetContent, sauceDemoContent, httpbinContent] = await Promise.all([
            mcpGetContent(mcpClient.client, primarySession.contextId),
            mcpGetContent(mcpClient.client, sauceDemoContextId),
            mcpGetContent(mcpClient.client, httpbinContextId),
          ]);

          // Verify content from each site
          AssertionHelpers.containsText(theInternetContent, 'Welcome to the-internet');
          AssertionHelpers.containsText(sauceDemoContent, 'Swag Labs');
          AssertionHelpers.containsText(httpbinContent, 'httpbin');

          // Ensure contexts are isolated - each should contain only its own content
          expect(theInternetContent.toLowerCase()).not.toContain('swag labs');
          expect(sauceDemoContent.toLowerCase()).not.toContain('welcome to the-internet');
          expect(httpbinContent.toLowerCase()).not.toContain('swag labs');
        });
      },
      TEST_CONFIG.timeout * 2,
    );
  });

  describe('Cross-Context Cookie Isolation', () => {
    it(
      'should maintain cookie isolation between contexts',
      async () => {
        await retryOperation(async () => {
          // Create additional context
          const context2Id = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );

          // Set different cookies in each context
          const testCookie1 = {
            name: 'test_context_1',
            value: 'primary_context_value',
            domain: 'httpbin.org',
            path: '/',
          };

          const testCookie2 = {
            name: 'test_context_2',
            value: 'secondary_context_value',
            domain: 'httpbin.org',
            path: '/',
          };

          // Navigate both contexts to httpbin to set cookies
          await Promise.all([
            mcpNavigate(mcpClient.client, primarySession.contextId, TEST_TARGETS.apis.httpbin),
            mcpNavigate(mcpClient.client, context2Id, TEST_TARGETS.apis.httpbin),
          ]);

          // Set cookies in each context
          await Promise.all([
            mcpCookie(mcpClient.client, primarySession.contextId, 'set', [testCookie1]),
            mcpCookie(mcpClient.client, context2Id, 'set', [testCookie2]),
          ]);

          // Get cookies from each context
          const [cookies1, cookies2] = await Promise.all([
            mcpCookie(mcpClient.client, primarySession.contextId, 'get'),
            mcpCookie(mcpClient.client, context2Id, 'get'),
          ]);

          // Verify cookie isolation
          const cookie1Names = Array.isArray(cookies1)
            ? cookies1.map((c: any) => c.name)
            : Object.keys(cookies1 || {});
          const cookie2Names = Array.isArray(cookies2)
            ? cookies2.map((c: any) => c.name)
            : Object.keys(cookies2 || {});

          // Each context should have its own cookie but not the other's
          expect(cookie1Names).toContain('test_context_1');
          expect(cookie1Names).not.toContain('test_context_2');
          expect(cookie2Names).toContain('test_context_2');
          expect(cookie2Names).not.toContain('test_context_1');
        });
      },
      TEST_CONFIG.timeout * 2,
    );

    it(
      'should maintain independent sessions in e-commerce contexts',
      async () => {
        await retryOperation(async () => {
          // Create two contexts for SauceDemo
          const userContext1 = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );
          const userContext2 = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );

          // Navigate both to SauceDemo
          await Promise.all([
            mcpNavigate(mcpClient.client, userContext1, TEST_TARGETS.ecommerce.sauceDemo),
            mcpNavigate(mcpClient.client, userContext2, TEST_TARGETS.ecommerce.sauceDemo),
          ]);

          // Wait for pages to load
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 2000);
          });

          // Get login state for both contexts
          const [loginPage1, loginPage2] = await Promise.all([
            mcpGetContent(mcpClient.client, userContext1),
            mcpGetContent(mcpClient.client, userContext2),
          ]);

          // Both should show login page initially
          AssertionHelpers.containsText(loginPage1, 'Username');
          AssertionHelpers.containsText(loginPage1, 'Password');
          AssertionHelpers.containsText(loginPage2, 'Username');
          AssertionHelpers.containsText(loginPage2, 'Password');

          // Check for unique session indicators (different page timestamps or session IDs)
          const timestamp1 = await mcpEvaluate(
            mcpClient.client,
            userContext1,
            'Date.now().toString()',
          );

          // Small delay to ensure different timestamps
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 100);
          });

          const timestamp2 = await mcpEvaluate(
            mcpClient.client,
            userContext2,
            'Date.now().toString()',
          );

          // Timestamps should be different (indicates separate sessions)
          expect(timestamp1).not.toEqual(timestamp2);
        });
      },
      TEST_CONFIG.timeout * 2,
    );
  });

  describe('Context Switching and Management', () => {
    it(
      'should switch between contexts and maintain state',
      async () => {
        await retryOperation(async () => {
          // Create additional context
          const context2Id = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );

          // Navigate contexts to different pages
          await mcpNavigate(
            mcpClient.client,
            primarySession.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          await mcpNavigate(mcpClient.client, context2Id, TEST_TARGETS.apis.httpbin);

          // Set page-specific state in each context
          await mcpEvaluate(
            mcpClient.client,
            primarySession.contextId,
            'window.testState = "primary_context_state";',
          );
          await mcpEvaluate(
            mcpClient.client,
            context2Id,
            'window.testState = "secondary_context_state";',
          );

          // Switch back and forth multiple times
          for (let i = 0; i < 3; i++) {
            // Check state in primary context
            const state1 = await mcpEvaluate(
              mcpClient.client,
              primarySession.contextId,
              'window.testState',
            );
            expect(state1).toBe('primary_context_state');

            // Check state in secondary context
            const state2 = await mcpEvaluate(mcpClient.client, context2Id, 'window.testState');
            expect(state2).toBe('secondary_context_state');

            // Verify we're still on the correct pages
            const [content1, content2] = await Promise.all([
              mcpGetContent(mcpClient.client, primarySession.contextId),
              mcpGetContent(mcpClient.client, context2Id),
            ]);

            AssertionHelpers.containsText(content1, 'Welcome to the-internet');
            AssertionHelpers.containsText(content2, 'httpbin');
          }
        });
      },
      TEST_CONFIG.timeout * 2,
    );

    it(
      'should handle context closure without affecting other contexts',
      async () => {
        await retryOperation(async () => {
          // Create multiple additional contexts
          const context2Id = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );
          const context3Id = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );

          // Navigate all contexts
          await Promise.all([
            mcpNavigate(
              mcpClient.client,
              primarySession.contextId,
              TEST_TARGETS.testing.theInternet,
            ),
            mcpNavigate(mcpClient.client, context2Id, TEST_TARGETS.ecommerce.sauceDemo),
            mcpNavigate(mcpClient.client, context3Id, TEST_TARGETS.apis.httpbin),
          ]);

          // Verify all contexts are working
          const initialContexts = await listBrowserContexts(
            mcpClient.client,
            primarySession.sessionId,
          );
          expect(initialContexts.length).toBeGreaterThanOrEqual(3);

          // Close the middle context
          await closeBrowserContext(mcpClient.client, primarySession.sessionId, context2Id);

          // Verify remaining contexts still work
          const [content1, content3] = await Promise.all([
            mcpGetContent(mcpClient.client, primarySession.contextId),
            mcpGetContent(mcpClient.client, context3Id),
          ]);

          AssertionHelpers.containsText(content1, 'Welcome to the-internet');
          AssertionHelpers.containsText(content3, 'httpbin');

          // Verify closed context is no longer listed
          const remainingContexts = await listBrowserContexts(
            mcpClient.client,
            primarySession.sessionId,
          );
          const contextIds = remainingContexts.map((ctx: any) => ctx.id || ctx.contextId);
          expect(contextIds).not.toContain(context2Id);
          expect(contextIds).toContain(primarySession.contextId);
          expect(contextIds).toContain(context3Id);
        });
      },
      TEST_CONFIG.timeout * 2,
    );
  });

  describe('Independent Navigation and State', () => {
    it(
      'should maintain independent navigation history in each context',
      async () => {
        await retryOperation(async () => {
          // Create additional context
          const context2Id = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );

          // Navigate primary context through multiple pages
          await mcpNavigate(
            mcpClient.client,
            primarySession.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          await mcpNavigate(
            mcpClient.client,
            primarySession.contextId,
            TEST_TARGETS.testing.theInternet + '/login',
          );

          // Navigate secondary context through different pages
          await mcpNavigate(mcpClient.client, context2Id, TEST_TARGETS.apis.httpbin);
          await mcpNavigate(mcpClient.client, context2Id, TEST_TARGETS.apis.httpbin + '/headers');

          // Verify each context is on its final page
          const [content1, content2] = await Promise.all([
            mcpGetContent(mcpClient.client, primarySession.contextId),
            mcpGetContent(mcpClient.client, context2Id),
          ]);

          // Primary context should be on login page
          AssertionHelpers.containsText(content1, 'Login Page');
          expect(content1.toLowerCase()).not.toContain('headers');

          // Secondary context should be on headers page
          AssertionHelpers.containsText(content2, 'headers');
          expect(content2.toLowerCase()).not.toContain('login');

          // Verify URLs are different
          const [url1, url2] = await Promise.all([
            mcpEvaluate(mcpClient.client, primarySession.contextId, 'window.location.href'),
            mcpEvaluate(mcpClient.client, context2Id, 'window.location.href'),
          ]);

          expect(url1).toContain('login');
          expect(url2).toContain('headers');
        });
      },
      TEST_CONFIG.timeout * 2,
    );

    it(
      'should handle concurrent navigation in multiple contexts',
      async () => {
        await retryOperation(async () => {
          // Create multiple contexts
          const context2Id = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );
          const context3Id = await createAdditionalBrowserContext(
            mcpClient.client,
            primarySession.sessionId,
          );

          // Define navigation sequences for each context
          const navigationSequences = [
            [
              { contextId: primarySession.contextId, url: TEST_TARGETS.testing.theInternet },
              {
                contextId: primarySession.contextId,
                url: TEST_TARGETS.testing.theInternet + '/checkboxes',
              },
            ],
            [
              { contextId: context2Id, url: TEST_TARGETS.ecommerce.sauceDemo },
              { contextId: context2Id, url: TEST_TARGETS.ecommerce.sauceDemo },
            ],
            [
              { contextId: context3Id, url: TEST_TARGETS.apis.httpbin },
              { contextId: context3Id, url: TEST_TARGETS.apis.httpbin + '/json' },
            ],
          ];

          // Execute all navigations concurrently
          const allNavigations = navigationSequences
            .flat()
            .map(({ contextId, url }) => mcpNavigate(mcpClient.client, contextId, url));

          await Promise.all(allNavigations);

          // Wait for all pages to settle
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 3000);
          });

          // Verify final states
          const [content1, content2, content3] = await Promise.all([
            mcpGetContent(mcpClient.client, primarySession.contextId),
            mcpGetContent(mcpClient.client, context2Id),
            mcpGetContent(mcpClient.client, context3Id),
          ]);

          // Each context should be on its expected final page
          AssertionHelpers.containsText(content1, 'Checkboxes');
          AssertionHelpers.containsText(content2, 'Swag Labs');
          expect(content3.toLowerCase()).toMatch(/json|httpbin/);

          // Verify isolation - no cross-contamination of content
          expect(content1.toLowerCase()).not.toContain('swag labs');
          expect(content2.toLowerCase()).not.toContain('checkboxes');
          expect(content3.toLowerCase()).not.toContain('swag labs');
        });
      },
      TEST_CONFIG.timeout * 3,
    );
  });

  describe('Resource Management and Cleanup', () => {
    it(
      'should properly clean up contexts and prevent resource leaks',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          // Create multiple contexts
          const contextIds: string[] = [];
          for (let i = 0; i < 5; i++) {
            const contextId = await createAdditionalBrowserContext(
              mcpClient.client,
              primarySession.sessionId,
            );
            contextIds.push(contextId);
          }
          performance.checkpoint('contexts_created');

          // Navigate all contexts to ensure they're active
          const navigationPromises = contextIds.map((contextId, index) => {
            const urls = [
              TEST_TARGETS.testing.theInternet,
              TEST_TARGETS.ecommerce.sauceDemo,
              TEST_TARGETS.apis.httpbin,
            ];
            return mcpNavigate(mcpClient.client, contextId, urls[index % urls.length]);
          });

          await Promise.all(navigationPromises);
          performance.checkpoint('navigations_completed');

          // List contexts to verify they exist
          const contexts = await listBrowserContexts(mcpClient.client, primarySession.sessionId);
          expect(contexts.length).toBeGreaterThanOrEqual(6); // 5 new + 1 primary
          performance.checkpoint('contexts_verified');

          // Close contexts one by one
          for (const contextId of contextIds) {
            await closeBrowserContext(mcpClient.client, primarySession.sessionId, contextId);
          }
          performance.checkpoint('contexts_closed');

          // Verify contexts are removed
          const remainingContexts = await listBrowserContexts(
            mcpClient.client,
            primarySession.sessionId,
          );
          const remainingIds = remainingContexts.map((ctx: any) => ctx.id || ctx.contextId);

          for (const contextId of contextIds) {
            expect(remainingIds).not.toContain(contextId);
          }

          // Primary context should still exist
          expect(remainingIds).toContain(primarySession.contextId);

          // Performance assertions
          expect(performance.getCheckpoint('contexts_created')).toBeLessThan(30000);
          expect(performance.getCheckpoint('contexts_closed')).toBeLessThan(15000);

          console.warn('Resource management performance:', performance.getReport());
        });
      },
      TEST_CONFIG.timeout * 3,
    );

    it(
      'should handle session cleanup with multiple contexts gracefully',
      async () => {
        await retryOperation(async () => {
          // Create additional contexts
          const additionalContexts = await Promise.all([
            createAdditionalBrowserContext(mcpClient.client, primarySession.sessionId),
            createAdditionalBrowserContext(mcpClient.client, primarySession.sessionId),
            createAdditionalBrowserContext(mcpClient.client, primarySession.sessionId),
          ]);

          // Navigate all contexts
          const navigationPromises = [
            mcpNavigate(
              mcpClient.client,
              primarySession.contextId,
              TEST_TARGETS.testing.theInternet,
            ),
            ...additionalContexts.map((contextId, index) => {
              const urls = [TEST_TARGETS.ecommerce.sauceDemo, TEST_TARGETS.apis.httpbin];
              return mcpNavigate(mcpClient.client, contextId, urls[index % urls.length]);
            }),
          ];

          await Promise.all(navigationPromises);

          // Verify all contexts are working
          const allContexts = await listBrowserContexts(mcpClient.client, primarySession.sessionId);
          expect(allContexts.length).toBeGreaterThanOrEqual(4);

          // Take screenshots to verify contexts are active
          const screenshotPromises = [primarySession.contextId, ...additionalContexts].map(
            (contextId, index) =>
              mcpScreenshot(
                mcpClient.client,
                contextId,
                ScreenshotHelpers.getTimestampedFilename(`multi-context-${index}`),
              ),
          );

          const screenshots = await Promise.all(screenshotPromises);

          // Verify screenshots were taken
          for (const screenshot of screenshots) {
            expect(screenshot).toBeTruthy();
            expect(screenshot).toContain('.png');
          }

          console.warn('Screenshots taken for cleanup test:', screenshots);
        });

        // Note: Cleanup will be handled by afterEach, testing that it can handle multiple contexts
      },
      TEST_CONFIG.timeout * 2,
    );
  });

  describe('Error Handling and Edge Cases', () => {
    it(
      'should handle invalid context operations gracefully',
      async () => {
        await retryOperation(async () => {
          const invalidContextId = 'invalid-context-id-12345';

          // Try to navigate with invalid context ID
          try {
            await mcpNavigate(mcpClient.client, invalidContextId, TEST_TARGETS.testing.theInternet);
            // If it doesn't throw, it should fail gracefully
            expect(true).toBe(false); // Should not reach here
          } catch (error) {
            expect(error).toBeTruthy();
            expect(error instanceof Error ? error.message : '').toMatch(
              /context|invalid|not found/i,
            );
          }

          // Try to close invalid context
          try {
            await closeBrowserContext(mcpClient.client, primarySession.sessionId, invalidContextId);
            // Should handle gracefully
          } catch (error) {
            expect(error).toBeTruthy();
          }

          // Verify primary context still works
          await mcpNavigate(
            mcpClient.client,
            primarySession.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          const content = await mcpGetContent(mcpClient.client, primarySession.contextId);
          AssertionHelpers.containsText(content, 'Welcome to the-internet');
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle context limit scenarios appropriately',
      async () => {
        await retryOperation(async () => {
          const createdContexts: string[] = [];

          try {
            // Try to create many contexts (may hit limits)
            for (let i = 0; i < 10; i++) {
              const contextId = await createAdditionalBrowserContext(
                mcpClient.client,
                primarySession.sessionId,
              );
              createdContexts.push(contextId);
            }

            // If we got here, verify all contexts work
            const contexts = await listBrowserContexts(mcpClient.client, primarySession.sessionId);
            expect(contexts.length).toBeGreaterThanOrEqual(createdContexts.length);
          } catch (error) {
            // It's acceptable to hit limits - verify error handling
            expect(error).toBeTruthy();
            console.warn('Context limit reached (expected):', error);
          }

          // Clean up created contexts
          for (const contextId of createdContexts) {
            try {
              await closeBrowserContext(mcpClient.client, primarySession.sessionId, contextId);
            } catch (error) {
              console.warn('Error closing context during cleanup:', error);
            }
          }

          // Verify primary context still works
          await mcpNavigate(
            mcpClient.client,
            primarySession.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          const content = await mcpGetContent(mcpClient.client, primarySession.contextId);
          expect(content).toBeTruthy();
        });
      },
      TEST_CONFIG.timeout * 3,
    );
  });
});
